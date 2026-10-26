import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {requireActiveUser} from '../server/user-status.js';
import {recordBusinessMetric,sanitizeBusinessEvent} from '../server/business-insights.js';
import {businessSubscriptionId,resolveBusinessSubject} from '../server/business-billing.js';

if(!getApps().length){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(raw?{credential:cert(JSON.parse(raw))}:undefined);
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется авторизация'});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();
    await requireActiveUser(db,uid);
    const event=sanitizeBusinessEvent(req.body||{});
    await resolveBusinessSubject(db,event.subjectType,event.subjectId);
    if(event.subjectType==='trainer'&&event.subjectId===uid)return res.json({ok:true,counted:false,selfTraffic:true});
    const subscription=await db.collection('businessSubscriptions').doc(businessSubscriptionId(event.subjectType,event.subjectId)).get();
    if(subscription.exists&&subscription.data()?.ownerUserId===uid)return res.json({ok:true,counted:false,selfTraffic:true});
    const result=await recordBusinessMetric(db,{...event,actorId:uid});
    return res.json({ok:true,counted:result.counted});
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[business-event]',error);
    return res.status(status).json({error:status===500?'Не удалось сохранить статистику.':error.message});
  }
}
