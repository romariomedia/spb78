import { randomUUID } from 'node:crypto';
import { SPORTS } from '../shared/sports.js';
import { assertUserActive } from './user-status.js';
import { claimFromPassport, claimFingerprint, sanitizeVerificationEvidence, verificationRequestId, verificationClaimId } from './sport-id-verification.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const trainerClaim={claimType:'trainer',claimId:'trainer'};
export function trainerInput(input={}) {
  if(typeof input.enabled!=='boolean')fail('Укажите статус персонального тренера.');
  if(!Array.isArray(input.sports)||input.sports.length>SPORTS.length||input.sports.some(s=>!SPORTS.includes(s)))fail('Выберите дисциплины из списка SportBuddy78.');
  const sports=SPORTS.filter(s=>input.sports.includes(s));
  if(input.enabled&&!sports.length)fail('Выберите хотя бы одну дисциплину.');
  return {enabled:input.enabled,sports:input.enabled?sports:[]};
}
export function publicTrainer(user={}) {
  const t=user.personalTrainer;
  if(user.isSuspended||user.isDemo||t?.enabled!==true||t.status!=='verified')return null;
  return {enabled:true,status:'verified',sports:Array.isArray(t.sports)?t.sports.filter(s=>SPORTS.includes(s)):[],verifiedAt:typeof t.verifiedAt==='string'?t.verifiedAt:''};
}
export function trainerEvidence(body) {
  if(!Array.isArray(body.evidenceUrls)||body.evidenceUrls.length<1||body.evidenceUrls.length>5)fail('Загрузите от 1 до 5 документов об обучении.');
  const urls=[...new Set(body.evidenceUrls)];
  for(const url of urls)sanitizeVerificationEvidence({evidenceUrl:url});
  const evidence=sanitizeVerificationEvidence({...body,evidenceUrl:urls[0]});
  if(evidence.note.length<5)fail('Укажите название курса или квалификацию и учебную организацию.');
  return {...evidence,evidenceUrls:urls};
}
// All transitions read the current profile and request in a single transaction.
// A simultaneous edit, cancellation or admin decision causes a Firestore retry.
export async function mutateTrainer(db,uid,action,body={}) {
  const config=action==='trainerSave'?trainerInput(body):null;
  const evidence=action==='trainerSubmit'?trainerEvidence(body):null;
  const userRef=db.collection('users').doc(uid);
  const requestRef=db.collection('sportVerificationRequests').doc(verificationRequestId(uid,trainerClaim));
  const claimRef=db.collection('sportVerifiedClaims').doc(verificationClaimId(uid,trainerClaim));
  return db.runTransaction(async tx=>{
    const userSnap=await tx.get(userRef),requestSnap=await tx.get(requestRef);
    if(!userSnap.exists)fail('Профиль не найден.',404);
    const user=userSnap.data();assertUserActive(user);
    const old=user.personalTrainer||{enabled:false,sports:[],status:'declared'};
    const request=requestSnap.exists?requestSnap.data():null;
    const now=Date.now(),date=new Date(now).toISOString();
    if(action==='trainerSave') {
      if(config.enabled===old.enabled&&JSON.stringify(config.sports)===JSON.stringify(old.sports))return {trainer:old};
      const trainer={...config,status:'declared',verifiedAt:''};
      tx.update(userRef,{personalTrainer:trainer});tx.delete(claimRef);
      if(request)tx.update(requestRef,{status:request.status==='approved'?'revoked':'cancelled',reviewNote:'Дисциплины или статус тренера изменены пользователем.',updatedAt:date,updatedAtMs:now});
      return {trainer};
    }
    if(action==='trainerSubmit') {
      if(old.status==='verified')fail('Статус тренера уже подтверждён.',409);
      if(request?.status==='pending')fail('Ваша заявка уже рассматривается.',409);
      const claim=claimFromPassport({},trainerClaim,old);
      const value={requestVersion:randomUUID(),id:requestRef.id,userId:uid,userName:String(user.name||'Спортсмен').slice(0,120),userAvatar:String(user.avatar||'').slice(0,2000),...claim,...evidence,fingerprint:claimFingerprint(claim),status:'pending',createdAt:date,createdAtMs:now,updatedAt:date,updatedAtMs:now,reviewNote:'',reviewedAt:'',reviewedBy:''};
      const trainer={...old,status:'pending',verifiedAt:''};
      tx.set(requestRef,value);tx.update(userRef,{personalTrainer:trainer});
      return {trainer,request:value};
    }
    if(action==='trainerCancel') {
      if(request?.status!=='pending')fail('Можно отменить только заявку на проверке.',409);
      const trainer={...old,status:'declared',verifiedAt:''};
      tx.update(requestRef,{status:'cancelled',updatedAt:date,updatedAtMs:now});tx.update(userRef,{personalTrainer:trainer});
      return {trainer};
    }
    fail('Неизвестное действие.');
  });
}
