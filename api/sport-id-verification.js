import {isTrainerLevel} from '../shared/trainer-levels.js';
import {saveTrainerServices, mutateTrainerBooking, listTrainerBookings} from '../server/trainer-bookings.js';
import { randomUUID } from 'node:crypto';
import { mutateTrainer, publicTrainer } from '../server/personal-trainer.js';
import { FieldPath } from 'firebase-admin/firestore';
import { publicProfile } from '../server/public-profile.js';
import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { requireActiveUser } from '../server/user-status.js';
import {recordBusinessMetric} from '../server/business-insights.js';
import {COMMERCIAL_LAUNCH_AT,businessListingStates,getBillingConfig} from '../server/business-billing.js';
import {
  claimFingerprint,claimFromPassport,sanitizeVerificationEvidence,verificationClaimId,verificationRequestId
} from '../server/sport-id-verification.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  res.setHeader?.('Cache-Control','private, no-store');
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется вход'});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();
    const {profile:user}=await requireActiveUser(db,uid);
    const action=String(req.body?.action||'list');
    const passport=user.sportPassport||{};

    if(action==='trainerServices')return res.json(await saveTrainerServices(db,uid,req.body));
    if(action==='bookingList')return res.json(await listTrainerBookings(db,uid,req.body,FieldPath.documentId()));
    if(['bookingCreate','bookingAccept','bookingReject','bookingCancel'].includes(action)){
      const result=await mutateTrainerBooking(db,uid,action,req.body);
      if(action==='bookingCreate')await recordBusinessMetric(db,{
        actorId:uid,subjectType:'trainer',subjectId:req.body?.trainerId,eventType:'lead',target:'booking',dedupKey:result.request?.id
      }).catch(()=>undefined);
      return res.json(result);
    }

    if(action==='trainerRead'){
      const id=verificationRequestId(uid,{claimType:'trainer',claimId:'trainer'});
      const request=await db.collection('sportVerificationRequests').doc(id).get();
      return res.json({trainer:user.personalTrainer||{enabled:false,sports:[],status:'declared'},request:request.exists?request.data():null});
    }
    if(['trainerSave','trainerSubmit','trainerCancel'].includes(action))return res.json(await mutateTrainer(db,uid,action,req.body||{}));
    if(action==='trainers'){
      const cursor=req.body?.cursor;
      if(cursor!==undefined&&cursor!==null&&(typeof cursor!=='string'||cursor.length>1500||cursor.includes('/')))return res.status(400).json({error:'Некорректная страница.'});
      const level=req.body?.trainerLevel||'all';
      if(level!=='all'&&!isTrainerLevel(level))return res.status(400).json({error:'Выберите Start или Pro.'});
      let query=db.collection('users').where(level==='all'?'personalTrainer.status':'personalTrainer.trainerLevel','==',level==='all'?'verified':level).orderBy(FieldPath.documentId()).limit(24);
      if(cursor)query=query.startAfter(cursor);
      const snap=await query.get();
      const afterLaunch=Date.now()>=Date.parse(COMMERCIAL_LAUNCH_AT);
      const billingConfig=afterLaunch?await getBillingConfig(db):null;
      const states=afterLaunch?await businessListingStates(db,'trainer',snap.docs.map(d=>d.id),billingConfig):new Map();
      const trainers=snap.docs.map(d=>{
        if(!publicTrainer(d.data()))return null;
        const state=states.get(d.id);
        if(afterLaunch&&state?.allowed!==true)return null;
        const profile=publicProfile(d.id,d.data());
        return state?.isPromoted&&profile.personalTrainer
          ? {...profile,personalTrainer:{...profile.personalTrainer,isPromoted:true}}
          : profile;
      }).filter(Boolean).sort((a,b)=>Number(b.personalTrainer?.isPromoted===true)-Number(a.personalTrainer?.isPromoted===true));
      return res.json({trainers,nextCursor:snap.docs.length===24?snap.docs.at(-1).id:null});
    }

    if(action==='list'){
      const snap=await db.collection('sportVerificationRequests').where('userId','==',uid).get().catch(()=>null);
      const requests=(snap?.docs||[]).map(doc=>({id:doc.id,...doc.data()}))
        .sort((a,b)=>Number(b.updatedAtMs||0)-Number(a.updatedAtMs||0));
      return res.json({requests});
    }

    if(action==='submit'){
      if(req.body?.claimType==='trainer')return res.status(400).json({error:'Используйте заявку персонального тренера.'});
      const claim=claimFromPassport(passport,req.body||{});
      const evidence=sanitizeVerificationEvidence(req.body||{});
      const fingerprint=claimFingerprint(claim);
      const activeClaim=await db.collection('sportVerifiedClaims').doc(verificationClaimId(uid,claim)).get();
      if(activeClaim.exists&&activeClaim.data()?.fingerprint===fingerprint)return res.status(409).json({error:'Этот факт уже подтверждён.'});
      const id=verificationRequestId(uid,claim);
      const ref=db.collection('sportVerificationRequests').doc(id);
      const before=await ref.get();
      if(before.exists&&before.data()?.status==='pending')return res.status(409).json({error:'Заявка на подтверждение этого факта уже рассматривается.'});
      const now=Date.now();
      const value={
        requestVersion:randomUUID(),id,userId:uid,userName:clean(user.name,120)||'Спортсмен',userAvatar:clean(user.avatar,1200),
        ...claim,fingerprint,...evidence,
        status:'pending',createdAt:before.exists?before.data()?.createdAt||new Date(now).toISOString():new Date(now).toISOString(),
        createdAtMs:before.exists?Number(before.data()?.createdAtMs||now):now,
        updatedAt:new Date(now).toISOString(),updatedAtMs:now,
        reviewNote:'',reviewedAt:'',reviewedBy:''
      };
      await ref.set(value,{merge:false});
      return res.json({ok:true,request:value});
    }

    if(action==='cancel'){
      const requestId=clean(req.body?.requestId,180);
      if(!requestId||requestId.includes('/'))return res.status(400).json({error:'Некорректная заявка.'});
      const ref=db.collection('sportVerificationRequests').doc(requestId);
      const snap=await ref.get();
      if(!snap.exists||snap.data()?.userId!==uid)return res.status(404).json({error:'Заявка не найдена.'});
      if(snap.data()?.claimType==='trainer')return res.status(400).json({error:'Отмените заявку в разделе персонального тренера.'});
      if(snap.data()?.status!=='pending')return res.status(409).json({error:'Можно отменить только заявку, которая ещё рассматривается.'});
      await ref.update({status:'cancelled',updatedAt:new Date().toISOString(),updatedAtMs:Date.now()});
      return res.json({ok:true});
    }

    return res.status(400).json({error:'Unknown action'});
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[sport-id-verification]',error);
    return res.status(status).json({error:status===500?'Verification Center временно недоступен.':error.message});
  }
}
