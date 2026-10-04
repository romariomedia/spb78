// Run on the VPS from the active release. Never print credential or avatar URLs.
import 'dotenv/config';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
const db=getFirestore(),auth=getAuth();
const args=process.argv.slice(2),archive=args[0]==='--archive',uids=archive?args.slice(1):[];
if(archive&&!uids.length)throw new Error('Укажите проверенные UID: --archive UID1 UID2');
const safeHost=host=>host==='res.cloudinary.com'||host.endsWith('.userapi.com')||host.endsWith('.vkuserphoto.ru')||host==='sun9-1.userapi.com';
async function photoStatus(url){
 if(!url)return 'не задан';let u;try{u=new URL(url);}catch{return 'локальный/некорректный адрес';}
 if(u.protocol!=='https:'||!safeHost(u.hostname))return `проверить вручную (${u.hostname})`;
 try{const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(8000),headers:{Range:'bytes=0-0'}});await r.body?.cancel();return `${u.hostname}: HTTP ${r.status}`;}catch{return `${u.hostname}: недоступно/таймаут`;}
}
const createdTime=p=>{const value=p.registeredAt??p.createdAt;return value?.toMillis?value.toMillis():typeof value==='number'?value:Date.parse(value||'');};
function eligible(p){return p.name?.trim()==='Новый спортсмен'&&p.isVerified!==true&&!(p.photoPortfolio?.length)&&(!p.avatar||p.avatar.includes('avatar-placeholder'))&&Date.now()-createdTime(p)>86400000;}
const docs=archive?await Promise.all(uids.map(id=>db.collection('users').doc(id).get())):(await db.collection('users').get()).docs;
for(const doc of docs){
 if(!doc.exists)continue;const p=doc.data();
 if(!archive){console.log(JSON.stringify({uid:doc.id,name:p.name,avatar:await photoStatus(p.avatar),thumbnail:p.avatar?.includes('res.cloudinary.com')?await photoStatus(p.avatar.replace('/image/upload/','/image/upload/f_auto,q_auto,w_160,h_160,c_thumb,g_face,r_max,dpr_auto/')):'не Cloudinary',candidate:eligible(p),verified:p.isVerified===true,portfolio:p.photoPortfolio?.length||0}));continue;}
 if(!eligible(p))throw new Error(`Профиль ${doc.id} не соответствует пустому тестовому профилю. Пропущен.`);
 // Any business activity blocks automatic archival, even for the placeholder name.
 for(const [collection,field,op] of [['feed','authorId','=='],['stories','authorId','=='],['trainings','createdBy','=='],['trainings','participantIds','array-contains'],['chats','participantIds','array-contains'],['friendships','participantIds','array-contains'],['friendRequests','fromId','=='],['friendRequests','toId','=='],['payments','userId','=='],['checkins','userId','==']]){
  if(!(await db.collection(collection).where(field,op,doc.id).limit(1).get()).empty)throw new Error(`У ${doc.id} есть активность (${collection}). Архивирование остановлено.`);
 }
 const privateRef=db.collection('usersPrivate').doc(doc.id),archiveRef=db.collection('archivedTestProfiles').doc(doc.id);
 // Retain Auth identity for recovery; revoke access before removing the public card.
 const account=await auth.getUser(doc.id).catch(e=>{if(e.code==='auth/user-not-found')return null;throw e;});
 if(account){await auth.updateUser(doc.id,{disabled:true});await auth.revokeRefreshTokens(doc.id);}
 try{await db.runTransaction(async tx=>{
  const latest=await tx.get(doc.ref),priv=await tx.get(privateRef);
  if(!latest.exists||!eligible(latest.data()))throw new Error('Профиль изменился, архивирование отменено.');
  tx.create(archiveRef,{publicProfile:latest.data(),privateProfile:priv.data()||{},archivedAt:new Date().toISOString(),authWasDisabled:account?.disabled||false});
  tx.delete(doc.ref);if(priv.exists)tx.delete(privateRef);
 });}catch(e){if(account&&!account.disabled)await auth.updateUser(doc.id,{disabled:false});throw e;}
 console.log(`Архивирован тестовый профиль: ${doc.id}`);
}
await db.terminate();
