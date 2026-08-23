import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';

function init() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not configured');
  initializeApp({ credential: cert(JSON.parse(raw)) });
}
function iso(v) { return v?.toDate ? v.toDate().toISOString() : String(v || ''); }
function premiumActive(u) { const t = Date.parse(iso(u.premiumUntil)); return Number.isFinite(t) && t > Date.now(); }
function dayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function cleanArray(v) { return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; }
async function verifyCaller(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw Object.assign(new Error('Требуется авторизация'), { status: 401 });
  return getAuth().verifyIdToken(token);
}


async function bootstrapProfile(db, uid, incoming, claims = {}) {
  const ref = db.collection('users').doc(uid);
  const privateRef = db.collection('usersPrivate').doc(uid);
  const authUser = await getAuth().getUser(uid);
  const createdAt = authUser.metadata.creationTime ? new Date(authUser.metadata.creationTime) : new Date();
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const privateSnap = await tx.get(privateRef);
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (snap.exists) {
      const user = snap.data();
      const existingPremium = user.premiumUntil?.toDate ? user.premiumUntil.toDate().getTime() : Date.parse(String(user.premiumUntil || ''));
      const registeredAt = user.registeredAt?.toDate ? user.registeredAt.toDate().getTime() : Date.parse(String(user.registeredAt || ''));
      const freshWithin24h = Number.isFinite(registeredAt) && Math.abs(Date.now() - registeredAt) <= 24 * 60 * 60 * 1000 && Number(user.totalWorkouts || 0) === 0 && Number(user.totalDailyMedals || 0) === 0;
      if (!user.welcomeTrialGrantedAt && (!Number.isFinite(existingPremium) || existingPremium <= Date.now()) && freshWithin24h) {
        tx.update(ref, { subscriptionPlan:'premium', premiumUntil:Timestamp.fromDate(trialEnd), trialPremiumEndsAt:trialEnd.toISOString(), rewardPremiumEndsAt:trialEnd.toISOString(), welcomeTrialGrantedAt:now.toISOString() });
        return { created:false, premiumGranted:true, profile:{ id:uid, ...user, ...(privateSnap.exists ? privateSnap.data() : {}), subscriptionPlan:'premium', premiumUntil:trialEnd.toISOString(), trialPremiumEndsAt:trialEnd.toISOString(), rewardPremiumEndsAt:trialEnd.toISOString(), welcomeTrialGrantedAt:now.toISOString() } };
      }
      return { created:false, premiumGranted:false, profile:{ id:uid, ...user, ...(privateSnap.exists ? privateSnap.data() : {}) } };
    }
    const body = incoming && typeof incoming === 'object' ? incoming : {};
    const gender = body.gender === 'female' ? 'female' : 'male';
    const cleanString=(v,max=500)=>String(v??'').trim().slice(0,max);
    const cleanArray=(v,max=20)=>Array.isArray(v)?v.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean).slice(0,max):[];
    const isVk = claims.vkVerified === true;
    const profile = {
      id:uid, name:cleanString(body.name,120)||'Новый спортсмен', age:Number.isFinite(Number(body.age))?Math.max(18,Math.min(100,Number(body.age))):25,
      gender, genderSet:body.genderSet===true, avatar:cleanString(body.avatar,2000), bio:cleanString(body.bio,1000), sports:cleanArray(body.sports,10),
      locationName:cleanString(body.locationName,200)||'Санкт-Петербург', lat:Number.isFinite(Number(body.lat))?Number(body.lat):59.9386, lng:Number.isFinite(Number(body.lng))?Number(body.lng):30.3141,
      rating:0,ratingSum:0,ratingCount:0,totalWorkouts:0,totalDailyMedals:0,dailyMedalStreak:0,medalTier:'bronze',activeLooking:true,
      likedUserIds:[],matchIds:[],matchHistory:[],friendIds:[],friendRequestsSent:[],friendRequestsReceived:[],subscriptionPlan:'premium',
      premiumUntil:Timestamp.fromDate(trialEnd),trialPremiumEndsAt:trialEnd.toISOString(),rewardPremiumEndsAt:trialEnd.toISOString(),welcomeTrialGrantedAt:now.toISOString(),
      registeredAt:createdAt.toISOString(),claimedBoxTiers:[],rewardItems:[],photoPortfolio:[],redeemedPromoCodes:[],
      isVerified:isVk, hasRealPhoto:isVk || body.hasRealPhoto===true, verifiedAt:isVk?now.toISOString():undefined, provider:isVk?'vk':'email'
    };
    Object.keys(profile).forEach(k=>profile[k]===undefined&&delete profile[k]);
    const privateData={ uid, email:String(authUser.email||body.email||'').trim().toLowerCase()||undefined, phone:typeof body.phone==='string'?body.phone.trim():undefined, birthDate:typeof body.birthDate==='string'?body.birthDate:undefined, hideBirthDate:body.hideBirthDate===true, hidePhone:body.hidePhone===true, deviceId:typeof body.deviceId==='string'?body.deviceId:undefined };
    Object.keys(privateData).forEach(k=>privateData[k]===undefined&&delete privateData[k]);
    tx.create(ref,profile); tx.create(privateRef,privateData);
    return {created:true,premiumGranted:true,profile:{...profile,...privateData,premiumUntil:trialEnd.toISOString()}};
  });
}

async function profileMutation(db, uid, updates) {
  const publicAllowed = new Set(['age','gender','genderSet','bio','sports','locationName','lat','lng','activeLooking','avatar','photoPortfolio','legalAcceptedAt','themeAccent','themeSurface','hasUsedGeolocation','lastSeenAt','lastGeoAt']);
  const privateAllowed = new Set(['phone','hidePhone','birthDate','hideBirthDate','deviceId']);
  const pub={}, priv={};
  for (const [k,v] of Object.entries(updates||{})) { if(publicAllowed.has(k)) pub[k]=v; if(privateAllowed.has(k)) priv[k]=v; }
  if (pub.gender && !['male','female'].includes(pub.gender)) throw Object.assign(new Error('Некорректный пол'),{status:400});
  if (Object.keys(pub).length===0 && Object.keys(priv).length===0) return {profile:null};
  return db.runTransaction(async tx=>{
    const ref=db.collection('users').doc(uid), privateRef=db.collection('usersPrivate').doc(uid); const snap=await tx.get(ref), ps=await tx.get(privateRef);
    if(!snap.exists) throw Object.assign(new Error('Профиль не найден'),{status:404});
    if(Object.keys(pub).length) tx.update(ref,pub); if(Object.keys(priv).length) tx.set(privateRef,{uid,...(ps.exists?ps.data():{}),...priv},{merge:true});
    return {profile:{id:uid,...snap.data(),...pub,...(Object.keys(priv).length?priv:(ps.exists?ps.data():{}))}};
  });
}

async function friendMutation(db, uid, body) {
  const op=String(body.operation||''), target=String(body.targetUserId||''); if(!target||target===uid) throw Object.assign(new Error('Некорректный пользователь'),{status:400});
  const meRef=db.collection('users').doc(uid), targetRef=db.collection('users').doc(target), reqRef=db.collection('friendRequests').doc(`${uid}__${target}`), reverseRef=db.collection('friendRequests').doc(`${target}__${uid}`), friendshipRef=db.collection('friendships').doc([uid,target].sort().join('__'));
  return db.runTransaction(async tx=>{
    const meS=await tx.get(meRef), tarS=await tx.get(targetRef), reqS=await tx.get(reqRef), revS=await tx.get(reverseRef), frS=await tx.get(friendshipRef);
    if(!meS.exists||!tarS.exists) throw Object.assign(new Error('Пользователь не найден'),{status:404});
    const me=meS.data(), tar=tarS.data(), friends=cleanArray(me.friendIds), sent=cleanArray(me.friendRequestsSent), received=cleanArray(me.friendRequestsReceived), targetFriends=cleanArray(tar.friendIds);
    const now=Date.now();
    if(op==='send'){
      if(frS.exists) return {friendIds:friends,friendRequestsSent:sent,friendRequestsReceived:received};
      if(revS.exists && revS.data().status==='pending'){
        const nf=[...new Set([...friends,target])], nt=[...new Set([...targetFriends,uid])];
        tx.update(meRef,{friendIds:nf,friendRequestsReceived:received.filter(x=>x!==target),friendRequestsSent:sent.filter(x=>x!==target)});
        tx.update(targetRef,{friendIds:nt,friendRequestsReceived:cleanArray(tar.friendRequestsReceived).filter(x=>x!==uid),friendRequestsSent:cleanArray(tar.friendRequestsSent).filter(x=>x!==uid)});
        tx.update(reverseRef,{status:'accepted',updatedAt:now}); tx.create(friendshipRef,{participantIds:[uid,target],createdAt:now});
        return {friendIds:nf,friendRequestsSent:sent.filter(x=>x!==target),friendRequestsReceived:received.filter(x=>x!==target)};
      }
      tx.create(reqRef,{id:reqRef.id,fromId:uid,toId:target,status:'pending',createdAt:now});
      const ns=[...new Set([...sent,target])]; tx.update(meRef,{friendRequestsSent:ns});
      const nr=[...new Set([...cleanArray(tar.friendRequestsReceived),uid])]; tx.update(targetRef,{friendRequestsReceived:nr});
      return {friendIds:friends,friendRequestsSent:ns,friendRequestsReceived:received};
    }
    if(op==='accept'){
      if(!revS.exists||revS.data().status!=='pending') throw Object.assign(new Error('Заявка не найдена'),{status:404});
      const nf=[...new Set([...friends,target])], nt=[...new Set([...targetFriends,uid])];
      tx.update(reverseRef,{status:'accepted',updatedAt:now}); if(reqS.exists) tx.update(reqRef,{status:'accepted',updatedAt:now});
      tx.set(friendshipRef,{participantIds:[uid,target],createdAt:frS.exists?frS.data().createdAt:now},{merge:true});
      tx.update(meRef,{friendIds:nf,friendRequestsReceived:received.filter(x=>x!==target)}); tx.update(targetRef,{friendIds:nt,friendRequestsSent:cleanArray(tar.friendRequestsSent).filter(x=>x!==uid)});
      return {friendIds:nf,friendRequestsSent:sent,friendRequestsReceived:received.filter(x=>x!==target)};
    }
    if(op==='decline'||op==='cancel'){
      const r=op==='decline'?revS:reqS; if(r.exists) tx.update(r.ref,{status:'declined',updatedAt:now});
      if(op==='decline') tx.update(meRef,{friendRequestsReceived:received.filter(x=>x!==target)}); else tx.update(meRef,{friendRequestsSent:sent.filter(x=>x!==target)});
      return {friendIds:friends,friendRequestsSent:op==='cancel'?sent.filter(x=>x!==target):sent,friendRequestsReceived:op==='decline'?received.filter(x=>x!==target):received};
    }
    if(op==='remove'){
      const nf=friends.filter(x=>x!==target), nt=targetFriends.filter(x=>x!==uid); if(frS.exists) tx.delete(frS.ref); if(revS.exists) tx.delete(revS.ref); if(frS.exists||revS.exists||frS.exists||revS.exists) tx.delete(friendshipRef);
      tx.update(meRef,{friendIds:nf}); tx.update(targetRef,{friendIds:nt}); return {friendIds:nf,friendRequestsSent:sent.filter(x=>x!==target),friendRequestsReceived:received.filter(x=>x!==target)};
    }
    throw Object.assign(new Error('Неизвестная операция друзей'),{status:400});
  });
}

async function eventMutation(db, uid, body) {
  const eventId=String(body.eventId||''); if(!eventId) throw Object.assign(new Error('Мероприятие не найдено'),{status:400});
  const ref=db.collection('events').doc(eventId); return db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw Object.assign(new Error('Мероприятие не найдено'),{status:404});const e=snap.data(), ids=cleanArray(e.participantIds), joined=ids.includes(uid);if(joined){const next=ids.filter(x=>x!==uid);tx.update(ref,{participantIds:next});return {registered:false,event:{...e,participantIds:next}};}if(ids.length>=Number(e.participantsMax))throw Object.assign(new Error('Все места уже заняты'),{status:409});const next=[...ids,uid];tx.update(ref,{participantIds:next});return {registered:true,event:{...e,participantIds:next}};});
}

async function feedMutation(db, uid, body) {
  const postId=String(body.postId||''); const ref=db.collection('feed').doc(postId);
  if(!postId) throw Object.assign(new Error('Пост не найден'),{status:400});
  return db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw Object.assign(new Error('Пост не найден'),{status:404});const post=snap.data(), likes=cleanArray(post.likes), comments=Array.isArray(post.comments)?post.comments:[];
    if(body.operation==='like'){const liked=likes.includes(uid), next=liked?likes.filter(x=>x!==uid):[...likes,uid];tx.update(ref,{likes:next});return {liked:!liked,post:{...post,likes:next}};}
    if(body.operation==='comment'){const content=String(body.content||'').trim().slice(0,500);if(content.length<1)throw Object.assign(new Error('Комментарий пуст'),{status:400});const user=(await tx.get(db.collection('users').doc(uid))).data()||{};const c={id:`c_${randomUUID()}`,postId,authorId:uid,authorName:String(user.name||'Спортсмен'),authorAvatar:String(user.avatar||''),content,createdAt:new Date().toISOString()};const next=[...comments,c];tx.update(ref,{comments:next,commentsCount:next.length});return {comment:c,post:{...post,comments:next,commentsCount:next.length}};}
    throw Object.assign(new Error('Неизвестная операция ленты'),{status:400});
  });
}

async function chatMutation(db, uid, body) {
  const chatId=String(body.chatId||''), companionId=String(body.companionId||''), text=String(body.text||'').trim().slice(0,2000); if(!chatId||!companionId||!text)throw Object.assign(new Error('Некорректное сообщение'),{status:400});
  const meRef=db.collection('users').doc(uid), otherRef=db.collection('users').doc(companionId), chatRef=db.collection('chats').doc(chatId);
  return db.runTransaction(async tx=>{const meS=await tx.get(meRef),oS=await tx.get(otherRef),cS=await tx.get(chatRef);if(!meS.exists||!oS.exists)throw Object.assign(new Error('Пользователь не найден'),{status:404});const me=meS.data(),other=oS.data();const allowed=cleanArray(me.matchIds).includes(companionId)||cleanArray(me.friendIds).includes(companionId);if(!allowed)throw Object.assign(new Error('Чат доступен только после мэтча или дружбы'),{status:403});const ts=Date.now(),message={id:`msg_${randomUUID()}`,chatId,senderId:uid,text,timestamp:ts,createdAt:new Date(ts).toISOString(),read:true};const current=cS.exists?cS.data():{id:chatId,participantIds:[uid,companionId],messages:[],createdAt:new Date(ts).toISOString()};if(!cleanArray(current.participantIds).includes(uid)||!cleanArray(current.participantIds).includes(companionId))throw Object.assign(new Error('Некорректный чат'),{status:403});const messages=Array.isArray(current.messages)?current.messages:[];tx.set(chatRef,{...current,participantIds:[uid,companionId],messages:[...messages,message],lastMessageAt:ts},{merge:true});return {message,thread:{...current,participantIds:[uid,companionId],messages:[...messages,message],lastMessageAt:ts}};});
}

async function matchMutation(db, uid, targetUserId) {
  if (!targetUserId || targetUserId === uid) throw Object.assign(new Error('Некорректный пользователь'), { status: 400 });
  const meRef = db.collection('users').doc(uid), targetRef = db.collection('users').doc(targetUserId);
  return db.runTransaction(async tx => {
    const meSnap = await tx.get(meRef); const targetSnap = await tx.get(targetRef);
    if (!meSnap.exists || !targetSnap.exists) throw Object.assign(new Error('Пользователь не найден'), { status: 404 });
    const me = meSnap.data(), target = targetSnap.data();
    const liked = cleanArray(me.likedUserIds), targetLiked = cleanArray(target.likedUserIds);
    const myMatches = cleanArray(me.matchIds), targetMatches = cleanArray(target.matchIds);
    const now = Date.now(), cutoff = now - 7 * 24 * 60 * 60 * 1000;
    const history = (Array.isArray(me.matchHistory) ? me.matchHistory : []).filter(x => x && typeof x.userId === 'string' && Number(x.at) > cutoff);
    const targetHistory = (Array.isArray(target.matchHistory) ? target.matchHistory : []).filter(x => x && typeof x.userId === 'string' && Number(x.at) > cutoff);
    if (liked.includes(targetUserId)) {
      const nextLiked = liked.filter(id => id !== targetUserId);
      tx.update(meRef, { likedUserIds: nextLiked, matchHistory: history });
      return { isLiked: false, isMatch: myMatches.includes(targetUserId), matchIds: myMatches, likedUserIds: nextLiked };
    }
    const mutual = targetLiked.includes(uid);
    if (mutual && !myMatches.includes(targetUserId) && !premiumActive(me) && history.length >= 5) {
      throw Object.assign(new Error('Бесплатный тариф: максимум 5 взаимных мэтчей за 7 дней'), { status: 409, code: 'MATCH_LIMIT' });
    }
    const nextLiked = [...liked, targetUserId];
    if (!mutual) {
      tx.update(meRef, { likedUserIds: nextLiked, matchHistory: history });
      return { isLiked: true, isMatch: false, matchIds: myMatches, likedUserIds: nextLiked };
    }
    const nextMyMatches = myMatches.includes(targetUserId) ? myMatches : [...myMatches, targetUserId];
    const nextTargetMatches = targetMatches.includes(uid) ? targetMatches : [...targetMatches, uid];
    const nextHistory = history.some(x => x.userId === targetUserId) ? history : [...history, { userId: targetUserId, at: now }];
    const nextTargetHistory = targetHistory.some(x => x.userId === uid) ? targetHistory : [...targetHistory, { userId: uid, at: now }];
    tx.update(meRef, { likedUserIds: nextLiked, matchIds: nextMyMatches, matchHistory: nextHistory });
    tx.update(targetRef, { matchIds: nextTargetMatches, matchHistory: nextTargetHistory });
    return { isLiked: true, isMatch: true, matchIds: nextMyMatches, likedUserIds: nextLiked };
  });
}

async function trainingMutation(db, uid, body) {
  if (body.operation === 'createTraining') {
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) throw Object.assign(new Error('Профиль не найден'), { status: 404 });
    if (!premiumActive(userSnap.data())) throw Object.assign(new Error('Создание тренировок доступно только Premium'), { status: 403 });
    const data = body.training || {}, max = Number(data.participantsMax);
    if (typeof data.title !== 'string' || data.title.trim().length < 2 || data.title.length > 120) throw Object.assign(new Error('Некорректное название тренировки'), { status: 400 });
    if (!Number.isInteger(max) || max < 2 || max > 100) throw Object.assign(new Error('Некорректный лимит участников'), { status: 400 });
    const id = `tr_${randomUUID()}`;
    const training = { ...data, id, createdBy: uid, participantIds: [uid], createdAt: new Date().toISOString() };
    await db.collection('trainings').doc(id).create(training);
    return { training };
  }
  const trainingId = String(body.trainingId || '');
  if (!trainingId) throw Object.assign(new Error('Не указана тренировка'), { status: 400 });
  const ref = db.collection('trainings').doc(trainingId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw Object.assign(new Error('Тренировка не найдена'), { status: 404 });
    const t = snap.data(), participants = cleanArray(t.participantIds), joined = participants.includes(uid);
    if (joined) {
      if (t.createdBy === uid) throw Object.assign(new Error('Организатор не может выйти из собственной тренировки'), { status: 409 });
      const next = participants.filter(id => id !== uid); tx.update(ref, { participantIds: next }); return { joined: false, participantIds: next };
    }
    if (participants.length >= Number(t.participantsMax)) throw Object.assign(new Error('Все места уже заняты'), { status: 409 });
    const next = [...participants, uid]; tx.update(ref, { participantIds: next }); return { joined: true, participantIds: next };
  });
}

async function workoutCredit(db, uid, body) {
  const trainingId = String(body.trainingId || ''), source = body.source === 'organizer-completion' ? 'organizer-completion' : 'participant-completion';
  const userRef = db.collection('users').doc(uid), trainingRef = db.collection('trainings').doc(trainingId), creditRef = db.collection('workoutCredits').doc(`${uid}_${dayKey()}`);
  return db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef), trainingSnap = await tx.get(trainingRef), creditSnap = await tx.get(creditRef);
    if (!userSnap.exists || !trainingSnap.exists) throw Object.assign(new Error('Данные тренировки не найдены'), { status: 404 });
    if (creditSnap.exists) throw Object.assign(new Error('Сегодня тренировка уже засчитана'), { status: 409, code: 'ALREADY_CREDITED' });
    const user = userSnap.data(), training = trainingSnap.data();
    const dateKey = String(training.dateKey || '');
    if (dateKey !== dayKey()) throw Object.assign(new Error('Тренировка не относится к сегодняшнему дню'), { status: 409 });
    if (training.isCompleted !== true) throw Object.assign(new Error('Тренировка ещё не завершена'), { status: 409 });
    if (source === 'organizer-completion' && training.createdBy !== uid) throw Object.assign(new Error('Только организатор может получить это начисление'), { status: 403 });
    if (source === 'participant-completion') {
      if (!cleanArray(training.participantIds).includes(uid) || training.createdBy === uid) throw Object.assign(new Error('Вы не являетесь участником этой тренировки'), { status: 403 });
      const checkinSnap = await db.collection('checkins').where('trainingId', '==', trainingId).where('userId', '==', uid).limit(1).get();
      if (checkinSnap.empty || checkinSnap.docs[0].data().verified !== true) throw Object.assign(new Error('Сначала подтвердите присутствие на тренировке'), { status: 403 });
    }
    const total = Number(user.totalWorkouts || 0) + 1;
    const credit = { id: creditRef.id, userId: uid, dayKey: dayKey(), timestamp: Date.now(), source, trainingId, trainingTitle: String(training.title || ''), sport: String(training.sport || '') };
    const mp = user.medalProgress ? { ...user.medalProgress, cycleWorkouts: Number(user.medalProgress.cycleWorkouts || 0) + 1, hasWorkoutEver: true } : null;
    tx.create(creditRef, credit); tx.update(userRef, { totalWorkouts: total, ...(mp ? { medalProgress: mp } : {}) });
    return { total, credit };
  });
}

async function dailyMedal(db, uid) {
  const ref = db.collection('users').doc(uid);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref); if (!snap.exists) throw Object.assign(new Error('Профиль не найден'), { status: 404 });
    const user = snap.data(), today = dayKey();
    const p = user.medalProgress || { tier: 'bronze', cycleDays: 0, cycleWorkouts: 0, totals: { bronze: 0, silver: 0, gold: 0 }, cyclesCompleted: { bronze: 0, silver: 0, gold: 0 }, lastClaimDayKey: null, lastClaimTimestamp: null, hasWorkoutEver: Number(user.totalWorkouts || 0) > 0 };
    if (p.lastClaimDayKey === today) throw Object.assign(new Error('Медаль за сегодня уже получена'), { status: 409 });
    const y = new Date(); y.setDate(y.getDate() - 1); const yesterday = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
    const base = p.lastClaimDayKey === yesterday ? { ...p } : { ...p, cycleDays: 0, cycleWorkouts: 0 };
    const cfgs = { bronze: { days: 7, workouts: 0, rewardDays: 5 }, silver: { days: 7, workouts: 3, rewardDays: 7 }, gold: { days: 7, workouts: 5, rewardDays: 30 } };
    const cfg = cfgs[base.tier] || cfgs.bronze;
    const next = { ...base, cycleDays: Number(base.cycleDays || 0) + 1, lastClaimDayKey: today, lastClaimTimestamp: Date.now(), totals: { ...base.totals, [base.tier]: Number(base.totals?.[base.tier] || 0) + 1 }, hasWorkoutEver: base.hasWorkoutEver || Number(user.totalWorkouts || 0) > 0 };
    let promoted = false, newTier = next.tier, promo = null;
    if (next.cycleDays >= cfg.days && next.cycleWorkouts >= cfg.workouts) {
      next.cyclesCompleted = { ...next.cyclesCompleted, [next.tier]: Number(next.cyclesCompleted?.[next.tier] || 0) + 1 };
      if (next.tier === 'bronze' && next.hasWorkoutEver) { newTier = 'silver'; promoted = true; } else if (next.tier === 'silver') { newTier = 'gold'; promoted = true; }
      const code = `GOLD-${Math.random().toString(36).slice(2,6).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
      promo = { code, days: cfg.rewardDays, source: 'streak', title: `Цикл «${next.tier}» — ${cfg.days} дней подряд`, createdAt: new Date().toISOString(), ownerId: uid };
      tx.create(db.collection('promoCodes').doc(code), promo); next.tier = newTier; next.cycleDays = 0; next.cycleWorkouts = 0;
    }
    const totalMedals = Object.values(next.totals).reduce((a,b) => a + Number(b || 0), 0);
    tx.update(ref, { medalProgress: next, totalDailyMedals: totalMedals, dailyMedalStreak: next.cycleDays, medalTier: next.tier, lastClaimedDate: today, lastLoginTimestamp: Date.now() });
    return { medals: totalMedals, streak: next.cycleDays, rewardGiven: true, progress: next, promoted, newTier, promo };
  });
}

async function checkinMutation(db, uid, body) {
  const trainingId=String(body.trainingId||''), lat=Number(body.lat), lng=Number(body.lng); if(!trainingId||!Number.isFinite(lat)||!Number.isFinite(lng))throw Object.assign(new Error('Некорректные координаты'),{status:400});
  const trainingRef=db.collection('trainings').doc(trainingId),checkRef=db.collection('checkins').doc(`chk_${trainingId}_${uid}`);
  return db.runTransaction(async tx=>{const tSnap=await tx.get(trainingRef),cSnap=await tx.get(checkRef);if(!tSnap.exists)throw Object.assign(new Error('Тренировка не найдена'),{status:404});if(cSnap.exists)throw Object.assign(new Error('Вы уже отметились на этой тренировке'),{status:409});const t=tSnap.data();if(t.isCompleted)throw Object.assign(new Error('Тренировка уже завершена — отметка недоступна'),{status:409});if(String(t.dateKey||'')!==dayKey())throw Object.assign(new Error('Отметиться можно только в календарный день тренировки'),{status:409});if(uid!==t.createdBy&&!cleanArray(t.participantIds).includes(uid))throw Object.assign(new Error('Отметка доступна только записанным участникам и организатору'),{status:403});
    const toRad=x=>x*Math.PI/180, dLat=toRad(Number(t.lat)-lat), dLng=toRad(Number(t.lng)-lng), a=Math.sin(dLat/2)**2+Math.cos(toRad(lat))*Math.cos(toRad(Number(t.lat)))*Math.sin(dLng/2)**2, distance=Math.round(6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))); if(distance>300)throw Object.assign(new Error(`Вы слишком далеко от места тренировки — ${distance} м. Подойдите ближе (не более 300 м).`),{status:409});
    const userSnap=await tx.get(db.collection('users').doc(uid));const user=userSnap.data()||{};const timestamp=Date.now(),check={id:checkRef.id,trainingId,userId:uid,userName:String(user.name||''),userAvatar:String(user.avatar||''),lat,lng,distanceMeters:distance,arrivedAt:new Date(timestamp).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),timestamp,note:String(body.note||'').trim()||undefined,verified:true};const checked=[...cleanArray(t.checkedInUserIds),uid];tx.create(checkRef,check);tx.update(trainingRef,{checkedInUserIds:checked});return {checkIn:check,training:{...t,checkedInUserIds:checked},distanceMeters:distance};});
}

async function completeTraining(db, uid, trainingId) {
  const ref=db.collection('trainings').doc(String(trainingId));
  return db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw Object.assign(new Error('Тренировка не найдена'),{status:404});const t=snap.data();if(t.createdBy!==uid)throw Object.assign(new Error('Только организатор может завершить тренировку'),{status:403});if(t.isCompleted===true)return {training:t};if(String(t.dateKey||'')!==dayKey())throw Object.assign(new Error('Тренировка не относится к сегодняшнему дню'),{status:409});if(!(Array.isArray(t.checkedInUserIds)&&t.checkedInUserIds.includes(uid)))throw Object.assign(new Error('Организатор должен подтвердить присутствие'),{status:409});const updated={isCompleted:true,completedAt:new Date().toISOString(),ratedParticipantIds:Array.isArray(t.ratedParticipantIds)?t.ratedParticipantIds:[],organizerRatedByParticipantIds:Array.isArray(t.organizerRatedByParticipantIds)?t.organizerRatedByParticipantIds:[]};tx.update(ref,updated);return {training:{...t,...updated}};});
}

async function ratingMutation(db,uid,body){
  const trainingId=String(body.trainingId||''), targetId=String(body.targetUserId||''), stars=Number(body.stars); if(!trainingId||!targetId||!Number.isInteger(stars)||stars<1||stars>5)throw Object.assign(new Error('Некорректная оценка'),{status:400});
  const trainingRef=db.collection('trainings').doc(trainingId), targetRef=db.collection('users').doc(targetId), reviewerRef=db.collection('users').doc(uid), ratingRef=db.collection('ratings').doc(`rate_${trainingId}_${uid}_${targetId}`);
  return db.runTransaction(async tx=>{
    const tSnap=await tx.get(trainingRef); const targetSnap=await tx.get(targetRef); const reviewerSnap=await tx.get(reviewerRef); const existing=await tx.get(ratingRef); if(!tSnap.exists||!targetSnap.exists||!reviewerSnap.exists)throw Object.assign(new Error('Данные оценки не найдены'),{status:404}); if(existing.exists)throw Object.assign(new Error('Оценка уже выставлена'),{status:409}); const t=tSnap.data(),target=targetSnap.data(),reviewer=reviewerSnap.data(); const organizerSnap=uid===String(t.createdBy)?null:await tx.get(db.collection('users').doc(String(t.createdBy))); const organizer=uid===String(t.createdBy)?reviewer:(organizerSnap?.data()||{});if(!t.isCompleted)throw Object.assign(new Error('Тренировка ещё не завершена'),{status:409});if(!cleanArray(t.participantIds).includes(uid))throw Object.assign(new Error('Вы не участник тренировки'),{status:403});if(!cleanArray(t.checkedInUserIds).includes(uid))throw Object.assign(new Error('Сначала подтвердите присутствие'),{status:403});
    const organizerToParticipant=uid===t.createdBy, allowedTarget=organizerToParticipant?cleanArray(t.participantIds).includes(targetId)&&targetId!==uid:targetId===t.createdBy; if(!allowedTarget)throw Object.assign(new Error('Недопустимый адресат оценки'),{status:403});
    if(organizerToParticipant&&cleanArray(t.ratedParticipantIds).includes(targetId))throw Object.assign(new Error('Участник уже оценён'),{status:409}); if(!organizerToParticipant&&cleanArray(t.organizerRatedByParticipantIds).includes(uid))throw Object.assign(new Error('Организатор уже оценён'),{status:409});
    const rating={id:ratingRef.id,trainingId,trainingTitle:String(t.title||''),sport:String(t.sport||''),organizerId:String(t.createdBy),organizerName:String(organizer.name||''),organizerAvatar:String(organizer.avatar||''),participantId:organizerToParticipant?targetId:uid,stars,tags:Array.isArray(body.tags)?body.tags.slice(0,10):[],comment:String(body.comment||'').trim().slice(0,500)||undefined,createdAt:new Date().toLocaleDateString('ru-RU'),timestamp:Date.now(),kind:organizerToParticipant?'organizer_to_participant':'participant_to_organizer',reviewerId:uid,reviewerName:String(reviewer.name||''),reviewerAvatar:String(reviewer.avatar||''),targetUserId:targetId};
    const nextCount=Number(target.ratingCount||0)+1,nextSum=Number(target.ratingSum||0)+stars;const trainingUpdate=organizerToParticipant?{ratedParticipantIds:[...cleanArray(t.ratedParticipantIds),targetId]}:{organizerRatedByParticipantIds:[...cleanArray(t.organizerRatedByParticipantIds),uid]};tx.create(ratingRef,rating);tx.update(targetRef,{ratingCount:nextCount,ratingSum:nextSum,rating:Number((nextSum/nextCount).toFixed(1)),ratingsReceived:[rating,...(Array.isArray(target.ratingsReceived)?target.ratingsReceived:[])]});tx.update(trainingRef,trainingUpdate);return {rating,training:{...t,...trainingUpdate},target:{...target,ratingCount:nextCount,ratingSum:nextSum,rating:Number((nextSum/nextCount).toFixed(1))}};
  });
}

async function redeemPromo(db, uid, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  const partners = { 'SPB-ZENIT-2026': { days:14, title:'Промо от ФК «Зенит»' }, 'SPB-BELIENOCHI': { days:7, title:'Марафон «Белые Ночи СПб»' }, 'SPB-PADEL-CLUB': { days:10, title:'Падел-клуб на Крестовском' }, 'SPORTBUDDY30': { days:30, title:'Приветственный бонус SportBuddy' } };
  const ref = db.collection('users').doc(uid);
  return db.runTransaction(async tx => {
    const userSnap = await tx.get(ref); if (!userSnap.exists) throw Object.assign(new Error('Профиль не найден'), {status:404});
    const user = userSnap.data(); const used = Array.isArray(user.redeemedPromoCodes) ? user.redeemedPromoCodes : [];
    if (used.includes(code)) throw Object.assign(new Error('Этот промокод уже был активирован'), {status:409});
    let promo = partners[code]; let promoRef = null;
    if (!promo) {
      promoRef = db.collection('promoCodes').doc(code); const snap = await tx.get(promoRef);
      if (!snap.exists || snap.data().usedAt || snap.data().ownerId !== uid) throw Object.assign(new Error('Промокод не найден или уже использован'), {status:404});
      promo = snap.data();
    }
    const current = user.premiumUntil?.toDate ? user.premiumUntil.toDate().getTime() : Date.parse(String(user.premiumUntil || ''));
    const base = Number.isFinite(current) && current > Date.now() ? current : Date.now();
    const end = new Date(base + Number(promo.days) * 86400000);
    tx.update(ref,{subscriptionPlan:'premium',premiumUntil:Timestamp.fromDate(end),rewardPremiumEndsAt:end.toISOString(),redeemedPromoCodes:[...used,code]});
    if (promoRef) tx.update(promoRef,{usedAt:new Date().toISOString()});
    return {days:Number(promo.days),title:String(promo.title),premiumUntil:end.toISOString()};
  });
}

async function openBox(db, uid, tierIndex) {
  const required = [7,14,28][Number(tierIndex)]; if (!required) throw Object.assign(new Error('Бокс не найден'), { status: 400 });
  const rewards = [
    [{ title:'Билет на домашний матч ФК «Зенит»',category:'ticket',description:'Официальный билет на домашний матч.',location:'Санкт-Петербург',icon:'⚽️' },{ title:'Фирменный шейкер SportBuddy PRO',category:'gear',description:'Спортивный термошейкер.',location:'Санкт-Петербург',icon:'🥤' },{ title:'Скидочный ваучер 1000₽',category:'coupon',description:'Партнёрский ваучер SportBuddy.',location:'Санкт-Петербург',icon:'🏷️' }],
    [{ title:'Слот на беговой марафон «Белые Ночи СПб»',category:'ticket',description:'Стартовый пакет партнёрского забега.',location:'Санкт-Петербург',icon:'🏃‍♂️' },{ title:'Комплект фитнес-резинок Pro-Loop Ultimate',category:'gear',description:'Набор эластичных лент.',location:'Санкт-Петербург',icon:'🏋️‍♀️' },{ title:'VIP-посещение бассейна на Крестовском',category:'ticket',description:'Партнёрское посещение бассейна.',location:'Санкт-Петербург',icon:'🏊‍♂️' }],
    [{ title:'Абонемент на 1 месяц в фитнес-клуб',category:'premium',description:'Партнёрский абонемент.',location:'Санкт-Петербург',icon:'💎' },{ title:'Беспроводные спортивные наушники',category:'gear',description:'Спортивные наушники.',location:'Доставка',icon:'🎧' },{ title:'VIP-билет на баскетбольное дерби',category:'ticket',description:'Партнёрский билет.',location:'Санкт-Петербург',icon:'🏀' }]
  ];
  return db.runTransaction(async tx => {
    const ref = db.collection('users').doc(uid), snap = await tx.get(ref); if (!snap.exists) throw Object.assign(new Error('Профиль не найден'), { status: 404 });
    const user = snap.data(); if (!premiumActive(user)) throw Object.assign(new Error('Открытие BOX доступно только Premium'), { status: 403 });
    if (Number(user.totalWorkouts || 0) < required) throw Object.assign(new Error(`Для открытия BOX нужно ${required} тренировок`), { status: 409 });
    const claimed = Array.isArray(user.claimedBoxTiers) ? user.claimedBoxTiers : []; if (claimed.includes(required)) throw Object.assign(new Error('Этот BOX уже открыт'), { status: 409 });
    const selected = rewards[Number(tierIndex)][Math.floor(Math.random()*rewards[Number(tierIndex)].length)];
    const reward = { ...selected, id:`rew_${randomUUID()}`, dateEarned:new Date().toLocaleDateString('ru-RU'), code:`SPB-${Math.floor(100000+Math.random()*900000)}` };
    const items = [reward, ...(Array.isArray(user.rewardItems) ? user.rewardItems : [])]; tx.update(ref, { claimedBoxTiers:[...claimed,required], rewardItems:items }); return { reward, claimedBoxTiers:[...claimed,required], rewardItems:items };
  });
}

export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  try {
    init(); const decoded = await verifyCaller(req), db = getFirestore(), body = req.body || {}; let result;
    switch(body.action) {
      case 'bootstrapProfile': result = await bootstrapProfile(db, decoded.uid, body.profile, decoded); break;
      case 'match': result = await matchMutation(db, decoded.uid, String(body.targetUserId || '')); break;
      case 'training': result = await trainingMutation(db, decoded.uid, body); break;
      case 'workoutCredit': result = await workoutCredit(db, decoded.uid, body); break;
      case 'dailyMedal': result = await dailyMedal(db, decoded.uid); break;
      case 'openBox': result = await openBox(db, decoded.uid, body.tierIndex); break;
      case 'redeemPromo': result = await redeemPromo(db, decoded.uid, body.code); break;
      case 'checkin': result = await checkinMutation(db, decoded.uid, body); break;
      case 'completeTraining': result = await completeTraining(db, decoded.uid, body.trainingId); break;
      case 'rating': result = await ratingMutation(db, decoded.uid, body); break;
      case 'profile': result = await profileMutation(db, decoded.uid, body.updates || {}); break;
      case 'friend': result = await friendMutation(db, decoded.uid, body); break;
      case 'event': result = await eventMutation(db, decoded.uid, body); break;
      case 'feed': result = await feedMutation(db, decoded.uid, body); break;
      case 'chat': result = await chatMutation(db, decoded.uid, body); break;
      default: throw Object.assign(new Error('Неизвестная операция'), { status:400 });
    }
    return res.status(200).json({ ok:true, ...result });
  } catch(error) { console.error('[sportbuddy-mutation]',error); return res.status(error.status || 500).json({ error:error.message || 'Server error', code:error.code }); }
}
