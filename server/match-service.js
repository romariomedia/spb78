import {randomUUID} from 'node:crypto';
import {hasPremiumAccess as premiumActive} from '../shared/access-policy.js';
import {enqueueNotification} from './notification-policy.js';
import {buildServerChatId} from './chat-policy.js';
import {publicDiscoveryProfile} from './public-profile.js';
const cleanArray=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'):[];
export function assertMatchEligible(me,target,uid,targetId){
  if(me.isSuspended || target.isSuspended || me.isDemo || target.isDemo || cleanArray(me.blockedUserIds).includes(targetId) || cleanArray(target.blockedUserIds).includes(uid)) throw Object.assign(new Error('Знакомство с этим пользователем недоступно'),{status:403});
  for(const [id,user] of [[uid,me],[targetId,target]]) {
    const published=publicDiscoveryProfile(id,user);
    if(!published?.name || !published.activeLooking || !['male','female'].includes(published.gender) || user.genderSet===false || !published.avatar || /ui-avatars|placeholder|dicebear|gravatar.com\/avatar\/00000/.test(published.avatar)) throw Object.assign(new Error('Для знакомств нужна открытая анкета с личным фото и включённым поиском напарника'),{status:409});
  }
  if(me.gender===target.gender) throw Object.assign(new Error('Эта анкета недоступна в знакомствах'),{status:409});
}
export async function matchMutation(db, uid, targetUserId, operation = 'like') {
  if (!['like','remove'].includes(operation) || !targetUserId || targetUserId.includes('/') || targetUserId.length > 128 || targetUserId === uid) throw Object.assign(new Error('Некорректный пользователь'), { status: 400 });
  const configSnap = await db.collection('appConfig').doc('main').get().catch(() => null);
  const product = configSnap?.exists ? (configSnap.data()?.product || {}) : {};
  const freeMatchLimit = Number.isInteger(Number(product.freeMatches)) && Number(product.freeMatches) >= 0 && Number(product.freeMatches) <= 100 ? Number(product.freeMatches) : 5;
  const matchWindowDays = Number.isInteger(Number(product.matchWindowDays)) && Number(product.matchWindowDays) >= 1 && Number(product.matchWindowDays) <= 365 ? Number(product.matchWindowDays) : 7;
  const meRef = db.collection('users').doc(uid), targetRef = db.collection('users').doc(targetUserId);
  return db.runTransaction(async tx => {
    const meSnap = await tx.get(meRef); const targetSnap = await tx.get(targetRef);
    if (!meSnap.exists || !targetSnap.exists) throw Object.assign(new Error('Пользователь не найден'), { status: 404 });
    const me = meSnap.data(), target = targetSnap.data();
    const liked = cleanArray(me.likedUserIds), targetLiked = cleanArray(target.likedUserIds);
    const myMatches = cleanArray(me.matchIds), targetMatches = cleanArray(target.matchIds);
    const now = Date.now(), cutoff = now - matchWindowDays * 24 * 60 * 60 * 1000;
    const history = (Array.isArray(me.matchHistory) ? me.matchHistory : []).filter(x => x && typeof x.userId === 'string' && Number(x.at) > cutoff);
    const targetHistory = (Array.isArray(target.matchHistory) ? target.matchHistory : []).filter(x => x && typeof x.userId === 'string' && Number(x.at) > cutoff);
    if (operation === 'remove') {
      const matchIds=myMatches.filter(id=>id!==targetUserId), likedUserIds=liked.filter(id=>id!==targetUserId);
      tx.update(meRef,{matchIds,likedUserIds});
      tx.update(targetRef,{matchIds:targetMatches.filter(id=>id!==uid),likedUserIds:targetLiked.filter(id=>id!==uid)});
      tx.set(db.collection('matchPairs').doc(buildServerChatId(uid,targetUserId)),{active:false});
      // Keep quota history: removing a match must not bypass the rolling limit.
      return {isLiked:false,isMatch:false,isNewMatch:false,matchIds,likedUserIds};
    }
    assertMatchEligible(me,target,uid,targetUserId);
    if (liked.includes(targetUserId) && (!targetLiked.includes(uid) || (myMatches.includes(targetUserId) && targetMatches.includes(uid)))) {
      return {isLiked:true,isMatch:myMatches.includes(targetUserId)&&targetMatches.includes(uid),isNewMatch:false,matchIds:myMatches,likedUserIds:liked};
    }
    if(myMatches.includes(targetUserId)&&targetMatches.includes(uid)){
      const nextLiked=[...new Set([...liked,targetUserId])];
      tx.update(meRef,{likedUserIds:nextLiked});
      return {isLiked:true,isMatch:true,isNewMatch:false,matchIds:myMatches,likedUserIds:nextLiked};
    }
    const mutual = targetLiked.includes(uid);
    if (mutual && !myMatches.includes(targetUserId) && !premiumActive(me) && history.length >= freeMatchLimit) {
      throw Object.assign(new Error(`Бесплатный тариф: максимум ${freeMatchLimit} взаимных мэтчей за ${matchWindowDays} дней`), { status: 409, code: 'MATCH_LIMIT' });
    }
    if (mutual && !targetMatches.includes(uid) && !premiumActive(target) && targetHistory.length >= freeMatchLimit) {
      throw Object.assign(new Error(`У второго участника исчерпан лимит мэтчей за ${matchWindowDays} дней`), { status: 409, code: 'MATCH_LIMIT' });
    }
    const nextLiked = [...new Set([...liked, targetUserId])];
    if (!mutual) {
      tx.update(meRef, { likedUserIds: nextLiked, matchHistory: history });
      return { isLiked: true, isMatch: false, isNewMatch:false, matchIds: myMatches, likedUserIds: nextLiked };
    }
    const nextMyMatches = myMatches.includes(targetUserId) ? myMatches : [...myMatches, targetUserId];
    const nextTargetMatches = targetMatches.includes(uid) ? targetMatches : [...targetMatches, uid];
    const nextHistory = history.some(x => x.userId === targetUserId) ? history : [...history, { userId: targetUserId, at: now }];
    const nextTargetHistory = targetHistory.some(x => x.userId === uid) ? targetHistory : [...targetHistory, { userId: uid, at: now }];
    tx.update(meRef, { likedUserIds: nextLiked, matchIds: nextMyMatches, matchHistory: nextHistory });
    tx.update(targetRef, { matchIds: nextTargetMatches, matchHistory: nextTargetHistory });
    const version=randomUUID();
    const pairId=buildServerChatId(uid,targetUserId);
    tx.set(db.collection('matchPairs').doc(pairId),{active:true,version,participantIds:[uid,targetUserId]});
    for (const [recipient,actor] of [[uid,targetUserId],[targetUserId,uid]]) {
      enqueueNotification(tx,db,{id:'match:'+version+':'+recipient,actorId:actor,recipients:[recipient],entityId:pairId,requestVersion:version,category:'friends',kind:'match',title:'Взаимная симпатия!',message:'У вас новый спортивный напарник. Напишите и договоритесь о тренировке.',link:'#chat='+encodeURIComponent(buildServerChatId(uid,targetUserId))});
    }
    return { isLiked: true, isMatch: true, isNewMatch:true, matchIds: nextMyMatches, likedUserIds: nextLiked };
  });
}

