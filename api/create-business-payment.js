import {randomUUID,createHash} from 'node:crypto';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {requireActiveUser} from '../server/user-status.js';
import {
  billingIsOpen,businessSubscriptionId,getBillingConfig,hasBusinessAccess,planFor,promotionFor,resolveBusinessSubject
} from '../server/business-billing.js';
import {validPaymentId} from '../server/payment-config.js';
import {
  BUSINESS_OFFER_VERSION,requireBusinessLegalProfile
} from '../server/business-legal.js';

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
    const purpose=clean(req.body?.purpose,30)||'subscription';
    const subject=await resolveBusinessSubject(db,subjectType,subjectId);
    if(subjectType==='trainer'&&subject.eligibleForPaidListing!==true)return res.status(409).json({error:'Сначала завершите проверку квалификации персонального тренера.'});
    const config=await getBillingConfig(db);
    if(!billingIsOpen(config))return res.status(409).json({
      code:'COMMERCIAL_NOT_LAUNCHED',
      error:'Коммерческие подписки SportBuddy78 откроются не ранее 1 января 2027 года и после включения администратором.'
    });

    if(req.body?.offerAccepted!==true||clean(req.body?.offerVersion,80)!==BUSINESS_OFFER_VERSION)
      return res.status(409).json({code:'OFFER_ACCEPTANCE_REQUIRED',error:'Перед оплатой примите актуальную оферту SportBuddy78 Business.'});
    const legalSnap=await db.collection('businessLegalProfiles').doc(uid).get();
    const legalProfile=requireBusinessLegalProfile(legalSnap.exists?legalSnap.data()||{}:{});

    const receiptMode=clean(process.env.YOOKASSA_RECEIPT_MODE,30);
    if(receiptMode!=='yookassa')
      return res.status(503).json({code:'FISCALIZATION_NOT_CONFIGURED',error:'Коммерческие платежи временно закрыты: не настроена фискализация 54-ФЗ.'});
    const vatCode=Number(process.env.YOOKASSA_VAT_CODE);
    if(!Number.isInteger(vatCode)||vatCode<1||vatCode>12)
      return res.status(503).json({code:'FISCALIZATION_NOT_CONFIGURED',error:'Коммерческие платежи временно закрыты: не настроена ставка НДС для кассового чека.'});
    const taxSystemCode=Number(process.env.YOOKASSA_TAX_SYSTEM_CODE||0);
    if(taxSystemCode!==0&&(!Number.isInteger(taxSystemCode)||taxSystemCode<1||taxSystemCode>6))
      return res.status(503).json({code:'FISCALIZATION_NOT_CONFIGURED',error:'Некорректная система налогообложения для кассового чека.'});

    if(purpose==='promotion'&&process.env.SB_AD_MARKING_READY!=='true')
      return res.status(503).json({code:'AD_MARKING_NOT_CONFIGURED',error:'Платное продвижение временно закрыто до подключения обязательной маркировки интернет-рекламы.'});
    const plan=purpose==='promotion'?promotionFor(config,subjectType):planFor(config,subjectType,interval);
    if(!plan)return res.status(400).json({error:purpose==='promotion'?'Продвижение недоступно.':'Некорректный тариф'});
    if(purpose==='promotion'&&!await hasBusinessAccess(db,subjectType,subjectId,config))
      return res.status(409).json({error:'Сначала активируйте размещение, затем включайте продвижение.'});
    if(!Number.isInteger(plan.amountRub)||plan.amountRub<=0)return res.status(409).json({code:'PLAN_DISABLED',error:'Этот тариф пока недоступен для оплаты.'});

    const subscriptionId=businessSubscriptionId(subjectType,subjectId);
    const subscriptionRef=db.collection('businessSubscriptions').doc(subscriptionId);
    const key=createHash('sha256').update(`${uid}:${subjectType}:${subjectId}:${purpose}:${interval}:${requestId}`).digest('hex');
    const requestRef=db.collection('businessPaymentRequests').doc(key);
    const intent=await db.runTransaction(async tx=>{
      const [previous,subscriptionSnap]=await Promise.all([tx.get(requestRef),tx.get(subscriptionRef)]);
      const subscription=subscriptionSnap.exists?subscriptionSnap.data()||{}:{};
      if(subscription.adminPaused===true)
        throw Object.assign(new Error('Размещение приостановлено администратором. Оплата временно недоступна.'),{status:409});
      if(previous.exists){
        const value=previous.data();
        if(value.ownerUserId!==uid||value.subjectType!==subjectType||value.subjectId!==subjectId||value.purpose!==purpose||String(value.interval||'')!==String(interval||'')||Date.now()-Date.parse(value.createdAt)>=23*3600000)
          throw Object.assign(new Error('Начните оплату заново'),{status:409});
        return value;
      }
      const ownerUserId=subjectType==='trainer'?uid:clean(subscription.ownerUserId,180);
      if(subjectType==='trainer'&&subjectId!==uid)throw Object.assign(new Error('Можно оплачивать только собственный профиль тренера.'),{status:403});
      if(subjectType!=='trainer'&&ownerUserId!==uid)throw Object.assign(new Error('Эта организация не привязана к вашему аккаунту.'),{status:403});
      const amount=`${plan.amountRub.toFixed(2)}`;
      const acceptedAt=new Date().toISOString();
      const legalProfileSnapshot={...legalProfile};
      const value=purpose==='promotion'
        ? {
            purpose:'promotion',product:'business_promotion',ownerUserId:uid,subjectType,subjectId,subjectLabel:subject.label,
            interval:'',days:plan.days,amount,currency:'RUB',createdAt:acceptedAt,
            offerVersion:BUSINESS_OFFER_VERSION,offerAcceptedAt:acceptedAt,legalProfileSnapshot
          }
        : {
            purpose:'subscription',product:'business_subscription',ownerUserId:uid,subjectType,subjectId,subjectLabel:subject.label,
            interval,months:plan.months,amount,currency:'RUB',createdAt:acceptedAt,
            offerVersion:BUSINESS_OFFER_VERSION,offerAcceptedAt:acceptedAt,legalProfileSnapshot
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
        confirmation:{type:'redirect',return_url:`https://sportbuddy78.pro/success?product=${intent.product}`},
        description:(intent.product==='business_promotion'
          ? `${intent.subjectLabel} · продвижение SportBuddy78 · 7 дней`
          : `${intent.subjectLabel} · SportBuddy78 · ${interval==='yearly'?'12 месяцев':'1 месяц'}`).slice(0,128),
        receipt:{
          customer:{email:legalProfile.email},
          items:[{
            description:(intent.product==='business_promotion'
              ? `Продвижение SportBuddy78: ${intent.subjectLabel}`
              : `Размещение SportBuddy78 Business: ${intent.subjectLabel}`).slice(0,128),
            quantity:'1.00',
            amount:{value:intent.amount,currency:'RUB'},
            vat_code:vatCode,
            payment_mode:'full_prepayment',
            payment_subject:'service'
          }],
          internet:'true',
          ...(taxSystemCode?{tax_system_code:taxSystemCode}:{})
        },
        metadata:intent.product==='business_promotion'
          ? {
              product:'sportbuddy78_business_promotion',userId:uid,
              subjectType:intent.subjectType,subjectId:intent.subjectId,days:String(intent.days)
            }
          : {
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
        product:intent.product,ownerUserId:uid,subjectType:intent.subjectType,subjectId:intent.subjectId,subjectLabel:intent.subjectLabel,
        interval:intent.interval||'',months:intent.months||0,days:intent.days||0,amount:intent.amount,currency:'RUB',
        offerVersion:intent.offerVersion,offerAcceptedAt:intent.offerAcceptedAt,legalProfileSnapshot:intent.legalProfileSnapshot,
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
