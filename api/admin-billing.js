import {randomUUID} from 'node:crypto';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {requireAdminSession,writeAdminAudit} from '../server/admin-control.js';
import {
  DEFAULT_BILLING_CONFIG,businessSubscriptionId,effectiveBusinessUntil,
  getBillingConfig,publicBusinessSubscription,resolveBusinessSubject,sanitizeBillingConfig
} from '../server/business-billing.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';
const int=(value,min,max)=>{
  const n=Number(value);
  if(!Number.isInteger(n)||n<min||n>max)throw Object.assign(new Error(`Введите число от ${min} до ${max}.`),{status:400});
  return n;
};

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const operation=String(body.operation||'get');
    const configRef=db.collection('billingConfig').doc('main');

    if(operation==='get'){
      const [config,snap,ledgerSnap,trainerSnap,venueSnap,massageSnap]=await Promise.all([
        getBillingConfig(db),
        db.collection('businessSubscriptions').limit(200).get(),
        db.collection('billingLedger').limit(200).get(),
        db.collection('users').where('personalTrainer.status','==','verified').limit(150).get(),
        db.collection('venues').limit(300).get(),
        db.collection('massageServices').limit(300).get()
      ]);
      const items=snap.docs.map(doc=>({id:doc.id,...publicBusinessSubscription(doc.data())}))
        .sort((a,b)=>(a.subjectLabel||a.subjectId).localeCompare(b.subjectLabel||b.subjectId,'ru'));
      const catalog={
        trainer:trainerSnap.docs.map(doc=>({id:doc.id,name:clean(doc.data()?.name,160)||'Тренер'})),
        venue:venueSnap.docs.filter(doc=>doc.data()?.archived!==true).map(doc=>({id:doc.id,name:clean(doc.data()?.name,160)||'Площадка'})),
        massage:massageSnap.docs.map(doc=>({id:doc.id,name:clean(doc.data()?.name,160)||'Массаж / wellness'}))
      };
      const ledger=ledgerSnap.docs.map(doc=>({id:doc.id,...doc.data()}))
        .sort((a,b)=>Date.parse(String(b.createdAt||''))-Date.parse(String(a.createdAt||''))).slice(0,100);
      return res.json({config,items,catalog,ledger});
    }

    if(operation==='saveConfig'){
      const current=await getBillingConfig(db);
      const next=sanitizeBillingConfig(body.config||{},current);
      await db.runTransaction(async tx=>{
        tx.set(configRef,{...next,updatedAt:new Date().toISOString(),updatedBy:String(session.email||'admin')},{merge:false});
        await writeAdminAudit(db,session,{
          action:'billing.config.update',entityType:'billingConfig',entityId:'main',
          before:current,after:next,requestId:String(body.requestId||'')
        },tx);
      });
      return res.json({ok:true,config:next});
    }

    const subjectType=clean(body.subjectType,30),subjectId=clean(body.subjectId,180);
    const subject=await resolveBusinessSubject(db,subjectType,subjectId);
    const id=businessSubscriptionId(subjectType,subjectId);
    const ref=db.collection('businessSubscriptions').doc(id);

    if(operation==='assignOwner'||operation==='unlinkOwner'){
      const ownerUserId=operation==='unlinkOwner'?'':clean(body.ownerUserId,180);
      if(operation==='assignOwner'){
        if(!ownerUserId||ownerUserId.includes('/'))return res.status(400).json({error:'Укажите UID владельца.'});
        const owner=await db.collection('users').doc(ownerUserId).get();
        if(!owner.exists)return res.status(404).json({error:'Пользователь-владелец не найден.'});
        if(subjectType==='trainer'&&ownerUserId!==subjectId)return res.status(400).json({error:'Профиль тренера может принадлежать только самому тренеру.'});
      }
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref),before=snap.exists?snap.data()||{}:{};
        const next={
          ...before,subjectType,subjectId,subjectLabel:subject.label,
          ownerUserId:subjectType==='trainer'?subjectId:ownerUserId,
          activeUntil:before.activeUntil||'',paidUntil:before.paidUntil||'',complimentaryUntil:before.complimentaryUntil||'',
          createdAt:before.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()
        };
        tx.set(ref,next,{merge:false});
        tx.create(db.collection('billingLedger').doc(randomUUID()),{
          eventType:operation==='assignOwner'?'owner_assigned':'owner_unlinked',
          subjectType,subjectId,subjectLabel:subject.label,ownerUserId:next.ownerUserId,
          adminEmail:String(session.email||'admin'),amountRub:0,createdAt:new Date().toISOString(),note:clean(body.note,300)
        });
        await writeAdminAudit(db,session,{
          action:`billing.${operation}`,entityType:'businessSubscription',entityId:id,
          before:{ownerUserId:clean(before.ownerUserId,180)},after:{ownerUserId:next.ownerUserId},
          requestId:String(body.requestId||'')
        },tx);
      });
      const saved=await ref.get();
      return res.json({ok:true,item:{id,...publicBusinessSubscription(saved.data())}});
    }

    if(operation==='grant'){
      const days=int(body.days,1,730),note=clean(body.note,300);
      if(note.length<3)return res.status(400).json({error:'Укажите причину бесплатного продления.'});
      const now=Date.now();
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref),before=snap.exists?snap.data()||{}:{};
        const ownerUserId=subjectType==='trainer'?subjectId:clean(before.ownerUserId,180);
        const base=Math.max(now,effectiveBusinessUntil(before));
        const until=new Date(base+days*86400000).toISOString();
        const next={
          ...before,subjectType,subjectId,subjectLabel:subject.label,ownerUserId,
          activeUntil:until,complimentaryUntil:until,
          createdAt:before.createdAt||new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),
          lastGrantedAt:new Date(now).toISOString(),lastGrantedBy:String(session.email||'admin')
        };
        tx.set(ref,next,{merge:false});
        tx.create(db.collection('billingLedger').doc(randomUUID()),{
          eventType:'admin_grant',subjectType,subjectId,subjectLabel:subject.label,ownerUserId,
          days,amountRub:0,note,adminEmail:String(session.email||'admin'),createdAt:new Date(now).toISOString(),activeUntil:until
        });
        await writeAdminAudit(db,session,{
          action:'billing.grant',entityType:'businessSubscription',entityId:id,
          before:{activeUntil:before.activeUntil||'',complimentaryUntil:before.complimentaryUntil||''},
          after:{activeUntil:until,complimentaryUntil:until,days,note},
          requestId:String(body.requestId||'')
        },tx);
      });
      const saved=await ref.get();
      return res.json({ok:true,item:{id,...publicBusinessSubscription(saved.data())}});
    }

    return res.status(400).json({error:'Unknown operation.'});
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-billing]',error);
    return res.status(status).json({error:status===500?'Не удалось изменить экономику проекта.':error.message});
  }
}
