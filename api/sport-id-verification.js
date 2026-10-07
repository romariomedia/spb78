import { saveEvidence,downloadEvidence,requireOwnedEvidence } from '../server/verification-evidence.js';
import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { requireActiveUser } from '../server/user-status.js';
import {
  claimFingerprint,claimFromPassport,sanitizeVerificationEvidence,verificationClaimId,verificationRequestId
} from '../server/sport-id-verification.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется вход'});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();
    const {profile:user}=await requireActiveUser(db,uid);
    res.setHeader('Cache-Control','no-store');
    const action=String(req.body?.action||'list');
    if(action==='uploadEvidence')return res.json({evidence:await saveEvidence(db,uid,req.body||{})});
    if(action==='downloadEvidence')return res.json({file:await downloadEvidence(db,req.body?.evidenceId,uid)});
    const passport=user.sportPassport||{};

    if(action==='list'){
      const snap=await db.collection('sportVerificationRequests').where('userId','==',uid).get();
      const requests=(snap?.docs||[]).map(doc=>({id:doc.id,...doc.data()}))
        .sort((a,b)=>Number(b.updatedAtMs||0)-Number(a.updatedAtMs||0));
      return res.json({requests});
    }

    if(action==='submit'){
      const claim=claimFromPassport(passport,req.body||{});
      const evidence=sanitizeVerificationEvidence(req.body||{});
      if(evidence.evidenceId)await requireOwnedEvidence(db,evidence.evidenceId,uid);
      const fingerprint=claimFingerprint(claim);
      const activeClaim=await db.collection('sportVerifiedClaims').doc(verificationClaimId(uid,claim)).get();
      if(activeClaim.exists&&activeClaim.data()?.fingerprint===fingerprint)return res.status(409).json({error:'Этот факт уже подтверждён.'});
      const id=verificationRequestId(uid,claim);
      const ref=db.collection('sportVerificationRequests').doc(id);
      const before=await ref.get();
      if(before.exists&&before.data()?.status==='pending')return res.status(409).json({error:'Заявка на подтверждение этого факта уже рассматривается.'});
      const now=Date.now();
      const value={
        id,userId:uid,userName:clean(user.name,120)||'Спортсмен',userAvatar:clean(user.avatar,1200),
        ...claim,fingerprint,...evidence,
        status:'pending',createdAt:before.exists?before.data()?.createdAt||new Date(now).toISOString():new Date(now).toISOString(),
        createdAtMs:before.exists?Number(before.data()?.createdAtMs||now):now,
        updatedAt:new Date(now).toISOString(),updatedAtMs:now,
        reviewNote:'',reviewedAt:'',reviewedBy:''
      };
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref);
        const active=await tx.get(db.collection('sportVerifiedClaims').doc(verificationClaimId(uid,claim)));
        const liveUser=await tx.get(db.collection('users').doc(uid));
        if(fresh.data()?.status==='pending')throw Object.assign(new Error('Заявка уже рассматривается.'),{status:409});
        if(active.data()?.fingerprint===fingerprint)throw Object.assign(new Error('Факт уже подтверждён.'),{status:409});
        if(claimFingerprint(claimFromPassport(liveUser.data()?.sportPassport||{},claim))!==fingerprint)throw Object.assign(new Error('Спортивный ID изменился. Обновите страницу.'),{status:409});
        tx.set(ref,value,{merge:false});
      });
      return res.json({ok:true,request:value});
    }

    if(action==='cancel'){
      const requestId=clean(req.body?.requestId,180);
      if(!requestId||requestId.includes('/'))return res.status(400).json({error:'Некорректная заявка.'});
      const ref=db.collection('sportVerificationRequests').doc(requestId);
      const snap=await ref.get();
      if(!snap.exists||snap.data()?.userId!==uid)return res.status(404).json({error:'Заявка не найдена.'});
      if(snap.data()?.status!=='pending')return res.status(409).json({error:'Можно отменить только заявку, которая ещё рассматривается.'});
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref);
        if(fresh.data()?.userId!==uid||fresh.data()?.status!=='pending')throw Object.assign(new Error('Заявка уже обработана.'),{status:409});
        tx.update(ref,{status:'cancelled',updatedAt:new Date().toISOString(),updatedAtMs:Date.now()});
      });
      return res.json({ok:true});
    }

    return res.status(400).json({error:'Unknown action'});
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[sport-id-verification]',error);
    return res.status(status).json({error:status===500?'Verification Center временно недоступен.':error.message});
  }
}
