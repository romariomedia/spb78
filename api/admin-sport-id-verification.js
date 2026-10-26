import {randomUUID} from 'node:crypto';
import {isTrainerLevel} from '../shared/trainer-levels.js';
import { assertUserActive } from '../server/user-status.js';
import {readAdminPage} from '../server/admin-page.js';
import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession,writeAdminAudit } from '../server/admin-control.js';
import { claimFingerprint,claimFromPassport,publicClaimToken,verificationClaimId } from '../server/sport-id-verification.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const operation=String(body.operation||'list');

    if(operation==='list'){
      const page=await readAdminPage(db.collection('sportVerificationRequests'),body.cursor);
      return res.json({requests:page.items,nextCursor:page.nextCursor});
    }

    const requestId=clean(body.requestId,180);
    if(!requestId||requestId.includes('/'))return res.status(400).json({error:'Verification request required.'});
    const requestRef=db.collection('sportVerificationRequests').doc(requestId);
    const result=await db.runTransaction(async tx=>{
    const requestSnap=await tx.get(requestRef);
    if(!requestSnap.exists)throw Object.assign(new Error('Заявка не найдена.'),{status:404});
    const request=requestSnap.data()||{};
    if(body.expectedVersion!==(request.requestVersion||''))throw Object.assign(new Error('Заявка обновилась. Обновите список и проверьте актуальные документы перед решением.'),{status:409});
    if((operation==='approve'||operation==='reject')&&request.status!=='pending')throw Object.assign(new Error('Эта заявка уже обработана.'),{status:409});
    if(operation==='revoke'&&request.status!=='approved')throw Object.assign(new Error('Отозвать можно только действующее подтверждение.'),{status:409});
    const trainerUserRef=request.claimType==='trainer'?db.collection('users').doc(request.userId):null;
    const trainerUserSnap=trainerUserRef?await tx.get(trainerUserRef):null;
    const note=clean(body.note,800);
    const now=Date.now();

    if(operation==='setTrainerLevel'&&(request.claimType!=='trainer'||request.status!=='approved'))throw Object.assign(new Error('Уровень можно изменить только подтверждённому тренеру.'),{status:409});
    if(operation==='approve'||operation==='setTrainerLevel'){
      const trainerLevel=request.claimType==='trainer'?body.trainerLevel:null;
      if(request.claimType==='trainer'&&!isTrainerLevel(trainerLevel))throw Object.assign(new Error('Выберите уровень тренера: Start или Pro.'),{status:400});
      if((trainerLevel==='pro'||operation==='setTrainerLevel')&&note.length<10)throw Object.assign(new Error('Укажите основание решения: документы, результаты и опыт (не менее 10 символов).'),{status:400});
      const userSnap=await tx.get(db.collection('users').doc(request.userId));
      if(!userSnap.exists)throw Object.assign(new Error('Пользователь не найден.'),{status:404});
      assertUserActive(userSnap.data());
      let currentClaim;
      try{currentClaim=claimFromPassport(userSnap.data()?.sportPassport||{},request,userSnap.data()?.personalTrainer||{});}catch{
        throw Object.assign(new Error('Факт в Спортивном ID был изменён или удалён. Попросите спортсмена отправить новую заявку.'),{status:409});
      }
      if(claimFingerprint(currentClaim)!==request.fingerprint)throw Object.assign(new Error('Данные в Спортивном ID изменились после отправки заявки. Нужна новая заявка.'),{status:409});
      const claimId=verificationClaimId(request.userId,request);
      const claimRef=db.collection('sportVerifiedClaims').doc(claimId);
      const existingClaim=operation==='setTrainerLevel'?await tx.get(claimRef):null;
      if(operation==='setTrainerLevel'&&(!existingClaim?.exists||userSnap.data()?.personalTrainer?.status!=='verified'))throw Object.assign(new Error('Подтверждение тренера больше не действует.'),{status:409});
      const claim={
        id:claimId,userId:request.userId,claimType:request.claimType,claimId:request.claimId,
        title:request.title||'',sport:request.sport||'',date:request.date||'',placement:request.placement||'',
        rankTitle:request.rankTitle||'',level:request.level||'',fingerprint:request.fingerprint,
        status:'verified',sourceRequestId:requestId,publicToken:existingClaim?.data()?.publicToken||publicClaimToken(),
        verifiedAt:new Date(now).toISOString(),verifiedAtMs:now,verifiedBy:String(session.email||'admin')
      };

        if(trainerUserRef) {
          claim.sports=currentClaim.sports;
          claim.trainerLevel=trainerLevel;
          tx.update(trainerUserRef,{personalTrainer:{...userSnap.data().personalTrainer,status:'verified',trainerLevel,verifiedAt:claim.verifiedAt}});
        }
        tx.set(claimRef,claim,{merge:false});
        tx.update(requestRef,{...(trainerUserRef?{trainerLevel}:{}),...(operation==='setTrainerLevel'?{requestVersion:randomUUID()}:{}),status:'approved',reviewNote:note,reviewedAt:claim.verifiedAt,reviewedBy:claim.verifiedBy,updatedAt:claim.verifiedAt,updatedAtMs:now});
      await writeAdminAudit(db,session,{action:operation==='setTrainerLevel'?'sportId.trainer.level':'sportId.verification.approve',entityType:'sportVerificationRequest',entityId:requestId,before:{status:request.status,trainerLevel:request.trainerLevel||''},after:{status:'approved',claimId,note,...(trainerUserRef?{trainerLevel}:{})},requestId:String(body.auditRequestId||'')},tx);
      return {ok:true};
    }

    if(operation==='reject'){
      if(note.length<3)throw Object.assign(new Error('Для отклонения укажите причину минимум из 3 символов.'),{status:400});
      const reviewedAt=new Date(now).toISOString();
      if(trainerUserSnap?.exists)tx.update(trainerUserRef,{personalTrainer:{...trainerUserSnap.data().personalTrainer,status:'rejected',trainerLevel:'',verifiedAt:''}});
      tx.update(requestRef,{status:'rejected',reviewNote:note,reviewedAt,reviewedBy:String(session.email||'admin'),updatedAt:reviewedAt,updatedAtMs:now});
      await writeAdminAudit(db,session,{action:'sportId.verification.reject',entityType:'sportVerificationRequest',entityId:requestId,before:{status:'pending'},after:{status:'rejected',note},requestId:String(body.auditRequestId||'')},tx);
      return {ok:true};
    }

    if(operation==='revoke'){
      const claimId=verificationClaimId(request.userId,request);
      const claimRef=db.collection('sportVerifiedClaims').doc(claimId);
      const claimSnap=await tx.get(claimRef);
      if(!claimSnap.exists)throw Object.assign(new Error('Подтверждение не найдено.'),{status:404});
      const reason=note;
      if(reason.length<3)throw Object.assign(new Error('Укажите причину отзыва минимум из 3 символов.'),{status:400});
      if(trainerUserSnap?.exists)tx.update(trainerUserRef,{personalTrainer:{...trainerUserSnap.data().personalTrainer,status:'revoked',trainerLevel:'',verifiedAt:''}});
      tx.delete(claimRef);
      tx.update(requestRef,{status:'revoked',reviewNote:reason,reviewedAt:new Date(now).toISOString(),reviewedBy:String(session.email||'admin'),updatedAt:new Date(now).toISOString(),updatedAtMs:now});
      await writeAdminAudit(db,session,{action:'sportId.verification.revoke',entityType:'sportVerifiedClaim',entityId:claimId,before:claimSnap.data(),after:{revoked:true,reason},requestId:String(body.auditRequestId||'')},tx);
      return {ok:true};
    }

    throw Object.assign(new Error('Unknown operation'),{status:400});
    });
    return res.json(result);
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-sport-id-verification]',error);
    return res.status(status).json({error:status===500?'Verification Center unavailable.':error.message});
  }
}
