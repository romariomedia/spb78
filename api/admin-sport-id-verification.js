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
      const snap=await db.collection('sportVerificationRequests').orderBy('updatedAtMs','desc').limit(100).get();
      const requests=(snap?.docs||[]).map(doc=>({id:doc.id,...doc.data()}));
      return res.json({requests});
    }

    const requestId=clean(body.requestId,180);
    if(!requestId||requestId.includes('/'))return res.status(400).json({error:'Verification request required.'});
    const requestRef=db.collection('sportVerificationRequests').doc(requestId);
    const result=await db.runTransaction(async tx=>{
    const requestSnap=await tx.get(requestRef);
    if(!requestSnap.exists)throw Object.assign(new Error('Заявка не найдена.'),{status:404});
    const request=requestSnap.data()||{};
    if((operation==='approve'||operation==='reject')&&request.status!=='pending')throw Object.assign(new Error('Эта заявка уже обработана.'),{status:409});
    if(operation==='revoke'&&request.status!=='approved')throw Object.assign(new Error('Отозвать можно только действующее подтверждение.'),{status:409});
    const note=clean(body.note,800);
    const now=Date.now();

    if(operation==='approve'){
      const userSnap=await tx.get(db.collection('users').doc(request.userId));
      if(!userSnap.exists)throw Object.assign(new Error('Пользователь не найден.'),{status:404});
      let currentClaim;
      try{currentClaim=claimFromPassport(userSnap.data()?.sportPassport||{},request);}catch{
        throw Object.assign(new Error('Факт в Спортивном ID был изменён или удалён. Попросите спортсмена отправить новую заявку.'),{status:409});
      }
      if(claimFingerprint(currentClaim)!==request.fingerprint)throw Object.assign(new Error('Данные в Спортивном ID изменились после отправки заявки. Нужна новая заявка.'),{status:409});
      const claimId=verificationClaimId(request.userId,request);
      const claimRef=db.collection('sportVerifiedClaims').doc(claimId);
      const claim={
        id:claimId,userId:request.userId,claimType:request.claimType,claimId:request.claimId,
        title:request.title||'',sport:request.sport||'',date:request.date||'',placement:request.placement||'',
        rankTitle:request.rankTitle||'',level:request.level||'',fingerprint:request.fingerprint,
        status:'verified',sourceRequestId:requestId,publicToken:publicClaimToken(),
        verifiedAt:new Date(now).toISOString(),verifiedAtMs:now,verifiedBy:String(session.email||'admin')
      };

        tx.set(claimRef,claim,{merge:false});
        tx.update(requestRef,{status:'approved',reviewNote:note,reviewedAt:claim.verifiedAt,reviewedBy:claim.verifiedBy,updatedAt:claim.verifiedAt,updatedAtMs:now});
      await writeAdminAudit(db,session,{action:'sportId.verification.approve',entityType:'sportVerificationRequest',entityId:requestId,before:{status:'pending'},after:{status:'approved',claimId,note},requestId:String(body.auditRequestId||'')},tx);
      return {ok:true};
    }

    if(operation==='reject'){
      if(note.length<3)throw Object.assign(new Error('Для отклонения укажите причину минимум из 3 символов.'),{status:400});
      const reviewedAt=new Date(now).toISOString();
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
