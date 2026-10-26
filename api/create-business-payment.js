import {randomUUID,createHash} from 'node:crypto';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {requireActiveUser} from '../server/user-status.js';
import {
  billingIsOpen,businessSubscriptionId,getBillingConfig,planFor,resolveBusinessSubject
} from '../server/business-billing.js';
import {validPaymentId} from '../server/payment-config.js';

function init(){
  if(getApps().length)return;
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(raw?{credential:cert(JSON.parse(raw))}:undefined);
}
const clean=(value,max=180)=>typeof value==='string'?value.trim().slice(0,max):'';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Метод не поддерживается'});
  const requestId=req.body?.requestId??randomUUID();
  if(typeof requestId!=='string'||!/^[a-zA-Z0-9_-]{16,128}$/.test(requestId))return res.status(400).json({error:'Некорректный идентификатор запроса'});
  const shopId=process.env.YOOKASSA_SHOP_ID,secret=process.env.YOOKASSA_SECRET_KEY;
  if(!shopId||!secret)return res.status(503).json({error:'Оплата временно недоступна'});
  try{
    init();
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется авторизация'});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();
    await requireActiveUser(db,uid);

    const subjectType=clean(req.body?.subjectType,30),subjectId=clean(req.body?.subjectId,180),interval=clean(req.body?.interval,20);
    const subject=await resolveBusinessSubject(db,subjectType,subjectId);
    const config=await getBillingConfig(db);
    if(!billingIsOpen(config))return res.status(409).json({
      code:'COMMERCIAL_NOT_LAUNCHED',
      error:'Коммерческие подписки SportBuddy78 откроются не ранее 1 января 2027 года и после включения администратором.'
    });
    const plan=planFor(config,subjectType,interval);
    if(!plan)return res.status(400).json({error:'Некорректный тариф'});
    if(!Number.isInteger(plan.amountRub)||plan.amountRub<=0)return res.status(409).json({code:'PLAN_DISABLED',error:'Этот тариф пока недоступен для оплаты.'});

    const subscriptionId=businessSubscriptionId(subjectType,subjectId);
    const subscriptionRef=db.collection('businessSubscriptions').doc(subscriptionId);
    const key=createHash('sha256').update(`${uid}:${subjectType}:${subjectId}:${interval}:${requestId}`).digest('hex');
    const requestRef=db.collection('businessPaymentRequests').doc(key);
    const intent=await db.runTransaction(async tx=>{
      const [previous,subscriptionSnap]=await Promise.all([tx.get(requestRef),tx.get(subscriptionRef)]);
      if(previous.exists){
        const value=previous.data();
        if(value.ownerUserId!==uid||value.subjectType!==subjectType||value.subjectId!==subjectId||value.interval!==interval||Date.now()-Date.parse(value.createdAt)>=23*3600000)
          throw Object.assign(new Error('Начните оплату заново'),{status:409});
        return value;
      }
      const subscription=subscriptionSnap.exists?subscriptionSnap.data()||{}:{};
      const ownerUserId=subjectType==='trainer'?uid:clean(subscription.ownerUserId,180);
      if(subjectType==='trainer'&&subjectId!==uid)throw Object.assign(new Error('Можно оплачивать только собственный профиль тренера.'),{status:403});
      if(subjectType!=='trainer'&&ownerUserId!==uid)throw Object.assign(new Error('Эта организация не привязана к вашему аккаунту.'),{status:403});
      const amount=`${plan.amountRub.toFixed(2)}`;
      const value={
        product:'business_subscription',ownerUserId:uid,subjectType,subjectId,subjectLabel:subject.label,
        interval,months:plan.months,amount,currency:'RUB',createdAt:new Date().toISOString()
      };
      if(!subscriptionSnap.exists){
        tx.create(subscriptionRef,{subjectType,subjectId,subjectLabel:subject.label,ownerUserId:uid,activeUntil:'',paidUntil:'',complimentaryUntil:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      }else if(subscription.subjectLabel!==subject.label){
        tx.update(subscriptionRef,{subjectLabel:subject.label,updatedAt:new Date().toISOString()});
      }
      tx.create(requestRef,value);
      return value;
    });

    if(intent.paymentId&&intent.confirmationUrl)return res.status(200).json({paymentId:intent.paymentId,confirmationUrl:intent.confirmationUrl,amount:intent.amount});

    const response=await fetch('https://api.yookassa.ru/v3/payments',{
      method:'POST',signal:AbortSignal.timeout(12000),
      headers:{'Content-Type':'application/json',Authorization:`Basic ${Buffer.from(`${shopId}:${secret}`).toString('base64')}`,'Idempotence-Key':key},
      body:JSON.stringify({
        amount:{value:intent.amount,currency:'RUB'},capture:true,
        confirmation:{type:'redirect',return_url:'https://sportbuddy78.pro/success?product=business_subscription'},
        description:`${intent.subjectLabel} · SportBuddy78 · ${interval==='yearly'?'12 месяцев':'1 месяц'}`.slice(0,128),
        metadata:{
          product:'sportbuddy78_business_subscription',userId:uid,
          subjectType:intent.subjectType,subjectId:intent.subjectId,
          interval:intent.interval,months:String(intent.months)
        }
      })
    });
    const payment=await response.json();
    if(!response.ok||!validPaymentId(payment.id)||!payment.confirmation?.confirmation_url)return res.status(503).json({error:'Не удалось создать платёж. Повторите попытку.'});
    const confirmationUrl=payment.confirmation.confirmation_url;
    if(typeof confirmationUrl!=='string'||!confirmationUrl.startsWith('https://'))throw new Error('Invalid confirmation URL');
    await db.runTransaction(async tx=>{
      const paymentRef=db.collection('payments').doc(payment.id);
      const saved=await tx.get(paymentRef);
      if(!saved.exists)tx.create(paymentRef,{
        product:'business_subscription',ownerUserId:uid,subjectType:intent.subjectType,subjectId:intent.subjectId,subjectLabel:intent.subjectLabel,
        interval:intent.interval,months:intent.months,amount:intent.amount,currency:'RUB',
        status:payment.status||'pending',processed:false,idempotenceKey:key,createdAt:intent.createdAt
      });
      tx.update(requestRef,{paymentId:payment.id,confirmationUrl});
    });
    return res.status(200).json({paymentId:payment.id,confirmationUrl,amount:intent.amount});
  }catch(error){
    const status=error.code?.startsWith?.('auth/')?401:error.status||503;
    return res.status(status).json({error:status===401?'Требуется повторный вход':error.status?error.message:'Платёжный сервис временно недоступен. Повторите попытку.'});
  }
}
