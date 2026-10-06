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
      const snap=await db.collection('sportVerificationRequests').orderBy('updatedAtMs','desc').limit(100).get().catch(()=>null);
      const requests=(snap?.docs||[]).map(doc=>({id:doc.id,...doc.data()}));
      return res.json({requests});
    }

    const requestId=clean(body.requestId,180);
    if(!requestId||requestId.includes('/'))return res.status(400).json({error:'Verification request required.'});
    const requestRef=db.collection('sportVerificationRequests').doc(requestId);
    const requestSnap=await requestRef.get();
    if(!requestSnap.exists)return res.status(404).json({error:'Заявка не найдена.'});
    const request=requestSnap.data()||{};
    if(request.status!=='pending')return res.status(409).json({error:'Эта заявка уже обработана.'});
    const note=clean(body.note,800);
    const now=Date.now();

    if(operation==='approve'){
      const userSnap=await db.collection('users').doc(request.userId).get();
      if(!userSnap.exists)return res.status(404).json({error:'Пользователь не найден.'});
      let currentClaim;
      try{currentClaim=claimFromPassport(userSnap.data()?.sportPassport||{},request);}catch{
        return res.status(409).json({error:'Факт в Спортивном ID был изменён или удалён. Попросите спортсмена отправить новую заявку.'});
      }
      if(claimFingerprint(currentClaim)!==request.fingerprint)return res.status(409).json({error:'Данные в Спортивном ID изменились после отправки заявки. Нужна новая заявка.'});
      const claimId=verificationClaimId(request.userId,request);
      const claimRef=db.collection('sportVerifiedClaims').doc(claimId);
      const claim={
        id:claimId,userId:request.userId,claimType:request.claimType,claimId:request.claimId,
        title:request.title||'',sport:request.sport||'',date:request.date||'',placement:request.placement||'',
        rankTitle:request.rankTitle||'',level:request.level||'',fingerprint:request.fingerprint,
        status:'verified',sourceRequestId:requestId,publicToken:publicClaimToken(),
        verifiedAt:new Date(now).toISOString(),verifiedAtMs:now,verifiedBy:String(session.email||'admin')
      };
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(requestRef);
        if(!fresh.exists||fresh.data()?.status!=='pending')throw Object.assign(new Error('Заявка уже обработана.'),{status:409});
        tx.set(claimRef,claim,{merge:false});
        tx.update(requestRef,{status:'approved',reviewNote:note,reviewedAt:claim.verifiedAt,reviewedBy:claim.verifiedBy,updatedAt:claim.verifiedAt,updatedAtMs:now});
      });
      await writeAdminAudit(db,session,{action:'sportId.verification.approve',entityType:'sportVerificationRequest',entityId:requestId,before:{status:'pending'},after:{status:'approved',claimId,note},requestId:String(body.auditRequestId||'')});
      return res.json({ok:true});
    }

    if(operation==='reject'){
      if(note.length<3)return res.status(400).json({error:'Для отклонения укажите причину минимум из 3 символов.'});
      const reviewedAt=new Date(now).toISOString();
      await requestRef.update({status:'rejected',reviewNote:note,reviewedAt,reviewedBy:String(session.email||'admin'),updatedAt:reviewedAt,updatedAtMs:now});
      await writeAdminAudit(db,session,{action:'sportId.verification.reject',entityType:'sportVerificationRequest',entityId:requestId,before:{status:'pending'},after:{status:'rejected',note},requestId:String(body.auditRequestId||'')});
      return res.json({ok:true});
    }

    if(operation==='revoke'){
      const claimId=verificationClaimId(request.userId,request);
      const claimRef=db.collection('sportVerifiedClaims').doc(claimId);
      const claimSnap=await claimRef.get();
      if(!claimSnap.exists)return res.status(404).json({error:'Подтверждение не найдено.'});
      const reason=note;
      if(reason.length<3)return res.status(400).json({error:'Укажите причину отзыва минимум из 3 символов.'});
      await claimRef.delete();
      await requestRef.update({status:'revoked',reviewNote:reason,reviewedAt:new Date(now).toISOString(),reviewedBy:String(session.email||'admin'),updatedAt:new Date(now).toISOString(),updatedAtMs:now});
      await writeAdminAudit(db,session,{action:'sportId.verification.revoke',entityType:'sportVerifiedClaim',entityId:claimId,before:claimSnap.data(),after:{revoked:true,reason},requestId:String(body.auditRequestId||'')});
      return res.json({ok:true});
    }

    return res.status(400).json({error:'Unknown operation'});
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-sport-id-verification]',error);
    return res.status(status).json({error:status===500?'Verification Center unavailable.':error.message});
  }
}
