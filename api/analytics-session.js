import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore,FieldValue } from 'firebase-admin/firestore';
import { analyticsDayKey,analyticsDocId,analyticsSessionId,safeActiveSeconds } from '../server/analytics.js';
import { requireActiveUser } from '../server/user-status.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

const clean=(value,max=120)=>typeof value==='string'?value.trim().slice(0,max):'';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется вход'});
    const {uid}=await getAuth().verifyIdToken(token);
    const db=getFirestore();
    const {profile}=await requireActiveUser(db,uid);
    if(profile.analyticsExcluded===true)return res.json({ok:true,excluded:true});

    const sessionId=clean(req.body?.sessionId,100),seq=Number(req.body?.seq),requested=Number(req.body?.activeSeconds||0);
    if(!sessionId||!Number.isInteger(seq)||seq<0||seq>1000000)return res.status(400).json({error:'Некорректная analytics-сессия.'});

    const now=Date.now(),day=analyticsDayKey(now);
    const dailyRef=db.collection('analyticsDaily').doc(analyticsDocId(day,uid));
    const sessionKey=analyticsSessionId(day,uid,sessionId).slice(0,24);
    const credited=await db.runTransaction(async tx=>{
      const dailySnap=await tx.get(dailyRef);
      const daily=dailySnap.exists?dailySnap.data()||{}:{};
      const states=daily.sessionStates&&typeof daily.sessionStates==='object'?daily.sessionStates:{};
      const session=states[sessionKey]||{};
      if(session.lastSeq!==undefined&&Number(session.lastSeq)>=seq)return 0;
      const firstSession=!states[sessionKey];
      if(firstSession&&Object.keys(states).length>=100)throw Object.assign(new Error('Слишком много analytics-сессий за день.'),{status:429});

      const seconds=safeActiveSeconds(requested,{now,lastPulseAt:Number(session.lastPulseAt||0),lastCreditedAt:Number(daily.lastCreditedAt||0)});
      const nextStates={...states,[sessionKey]:{lastSeq:seq,lastPulseAt:now}};
      tx.set(dailyRef,{
        userId:uid,day,sessionStates:nextStates,
        firstSeenAt:daily.firstSeenAt||now,lastSeenAt:now,lastCreditedAt:now,
        activeSeconds:FieldValue.increment(seconds),
        sessions:FieldValue.increment(firstSession?1:0)
      },{merge:true});
      return seconds;
    });

    if(!Number(profile.lastSeenAt)||now-Number(profile.lastSeenAt)>5*60*1000){
      await db.collection('users').doc(uid).update({lastSeenAt:now}).catch(()=>undefined);
    }
    return res.json({ok:true,day,creditedSeconds:credited});
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[analytics-session]',error);
    return res.status(status).json({error:status===500?'Analytics unavailable.':error.message});
  }
}
