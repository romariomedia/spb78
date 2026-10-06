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
    const sessionRef=db.collection('analyticsSessions').doc(analyticsSessionId(day,uid,sessionId));
    const credited=await db.runTransaction(async tx=>{
      const [dailySnap,sessionSnap]=await Promise.all([tx.get(dailyRef),tx.get(sessionRef)]);
      const daily=dailySnap.exists?dailySnap.data()||{}:{};
      const session=sessionSnap.exists?sessionSnap.data()||{}:{};
      if(sessionSnap.exists&&Number(session.lastSeq||-1)>=seq)return 0;

      const seconds=safeActiveSeconds(requested,{now,lastPulseAt:Number(session.lastPulseAt||0),lastCreditedAt:Number(daily.lastCreditedAt||0)});
      const firstSession=!sessionSnap.exists;
      tx.set(sessionRef,{
        userId:uid,day,lastSeq:seq,lastPulseAt:now,
        createdAt:session.createdAt||now,updatedAt:now,expiresAt:now+32*86400000
      },{merge:true});
      tx.set(dailyRef,{
        userId:uid,day,
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
