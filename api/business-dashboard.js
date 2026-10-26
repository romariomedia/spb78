import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {requireActiveUser} from '../server/user-status.js';
import {
  businessSubscriptionId,foundingCoachUntil,getBillingConfig,
  publicBusinessSubscription,resolveBusinessSubject
} from '../server/business-billing.js';
import {loadBusinessMetricSeries,summarizeBusinessMetrics} from '../server/business-insights.js';

if(!getApps().length){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(raw?{credential:cert(JSON.parse(raw))}:undefined);
}

const money=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется авторизация'});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();
    const {profile:user}=await requireActiveUser(db,uid);
    const config=await getBillingConfig(db);
    const subjects=[];
    const seen=new Set();

    const append=async(subjectType,subjectId,raw={})=>{
      const key=businessSubscriptionId(subjectType,subjectId);
      if(seen.has(key))return;
      const subject=await resolveBusinessSubject(db,subjectType,subjectId);
      const freeUntil=await foundingCoachUntil(db,subjectType,subjectId);
      const subscription={subjectType,subjectId,subjectLabel:subject.label,ownerUserId:uid,...raw};
      const series=await loadBusinessMetricSeries(db,subjectType,subjectId,30);
      subjects.push({
        ...publicBusinessSubscription(subscription,freeUntil),
        subjectLabel:subject.label,
        foundingCoachFreeUntil:freeUntil,
        metrics:summarizeBusinessMetrics(series),
        series
      });
      seen.add(key);
    };

    if(user.personalTrainer?.enabled===true&&user.personalTrainer?.status==='verified'){
      const id=businessSubscriptionId('trainer',uid),snap=await db.collection('businessSubscriptions').doc(id).get();
      await append('trainer',uid,snap.exists?snap.data()||{}:{});
    }

    const owned=await db.collection('businessSubscriptions').where('ownerUserId','==',uid).limit(50).get();
    for(const doc of owned.docs){
      const raw=doc.data()||{};
      if(!['trainer','venue','massage'].includes(raw.subjectType))continue;
      try{await append(raw.subjectType,raw.subjectId,raw);}catch{/* removed card: omit from owner dashboard */}
    }

    const ledgerSnap=await db.collection('billingLedger').where('ownerUserId','==',uid).limit(200).get();
    const ledger=ledgerSnap.docs.map(doc=>({id:doc.id,...doc.data()}))
      .sort((a,b)=>Date.parse(String(b.createdAt||''))-Date.parse(String(a.createdAt||''))).slice(0,100);
    const finance=ledger.reduce((acc,row)=>{
      if(row.eventType==='payment')acc.paidRub+=money(row.amountRub);
      if(row.eventType==='promotion_payment')acc.promotionRub+=money(row.amountRub);
      return acc;
    },{paidRub:0,promotionRub:0});

    return res.json({
      generatedAt:new Date().toISOString(),
      config:{
        enabled:config.enabled,commercialLaunchAt:config.commercialLaunchAt,
        plans:config.plans,promotions:config.promotions||{}
      },
      subjects,ledger,finance
    });
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[business-dashboard]',error);
    return res.status(status).json({error:status===500?'Не удалось загрузить кабинет партнёра.':error.message});
  }
}
