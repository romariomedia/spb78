import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {requireActiveUser} from '../server/user-status.js';
import {
  businessSubscriptionId,billingIsOpen,foundingCoachUntil,getBillingConfig,
  publicBusinessSubscription,resolveBusinessSubject
} from '../server/business-billing.js';

if(!getApps().length){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(raw?{credential:cert(JSON.parse(raw))}:undefined);
}

const bearer=req=>String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=bearer(req);
    if(!token)return res.status(401).json({error:'Требуется авторизация'});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();
    const {profile:user}=await requireActiveUser(db,uid);
    const config=await getBillingConfig(db);
    const subjects=[];
    const seen=new Set();

    if(user.personalTrainer?.enabled===true&&user.personalTrainer?.status==='verified'){
      const subject=await resolveBusinessSubject(db,'trainer',uid);
      const id=businessSubscriptionId('trainer',uid);
      const [subSnap,freeUntil]=await Promise.all([
        db.collection('businessSubscriptions').doc(id).get(),
        foundingCoachUntil(db,'trainer',uid)
      ]);
      const raw=subSnap.exists?subSnap.data():{
        subjectType:'trainer',subjectId:uid,subjectLabel:subject.label,ownerUserId:uid
      };
      subjects.push({...publicBusinessSubscription(raw,freeUntil),subjectLabel:subject.label,foundingCoachFreeUntil:freeUntil});
      seen.add(id);
    }

    const owned=await db.collection('businessSubscriptions').where('ownerUserId','==',uid).limit(50).get();
    for(const doc of owned.docs){
      if(seen.has(doc.id))continue;
      const raw=doc.data()||{};
      if(!['trainer','venue','massage'].includes(raw.subjectType))continue;
      let subject;
      try{subject=await resolveBusinessSubject(db,raw.subjectType,raw.subjectId);}catch{continue;}
      const freeUntil=await foundingCoachUntil(db,raw.subjectType,raw.subjectId);
      subjects.push({...publicBusinessSubscription({...raw,subjectLabel:subject.label},freeUntil),subjectLabel:subject.label,foundingCoachFreeUntil:freeUntil});
      seen.add(doc.id);
    }

    return res.json({
      config:{
        enabled:config.enabled,
        commercialLaunchAt:config.commercialLaunchAt,
        billingOpen:billingIsOpen(config),
        plans:config.plans,
        promotions:config.promotions
      },
      subjects
    });
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[business-billing]',error);
    return res.status(status).json({error:status===401?'Войдите в аккаунт заново':status===500?'Не удалось загрузить коммерческие подписки.':error.message});
  }
}
