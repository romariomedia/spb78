import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {
  COMMERCIAL_LAUNCH_AT,DEFAULT_BILLING_CONFIG,addCalendarMonths,billingIsOpen,
  businessPaymentMatches,sanitizeBillingConfig
} from '../server/business-billing.js';

test('business billing stays closed before 2027 even when admin switch is on',()=>{
  const config=sanitizeBillingConfig({enabled:true,plans:DEFAULT_BILLING_CONFIG.plans});
  assert.equal(config.commercialLaunchAt,COMMERCIAL_LAUNCH_AT);
  assert.equal(billingIsOpen(config,Date.parse('2026-12-31T20:59:59Z')),false);
  assert.equal(billingIsOpen(config,Date.parse('2026-12-31T21:00:00Z')),true);
});

test('business billing config keeps editable ruble prices within safe limits',()=>{
  const config=sanitizeBillingConfig({enabled:true,plans:{
    trainer:{monthlyRub:700,yearlyRub:7000},
    venue:{monthlyRub:1300,yearlyRub:13000},
    massage:{monthlyRub:1700,yearlyRub:17000}
  }});
  assert.equal(config.plans.trainer.monthlyRub,700);
  assert.equal(config.plans.venue.monthlyRub,1300);
  assert.equal(config.plans.massage.yearlyRub,17000);
});

test('calendar subscription renewal preserves end-of-month semantics',()=>{
  assert.equal(addCalendarMonths(new Date('2027-01-31T12:00:00Z'),1).toISOString(),'2027-02-28T12:00:00.000Z');
  assert.equal(addCalendarMonths(new Date('2028-01-31T12:00:00Z'),1).toISOString(),'2028-02-29T12:00:00.000Z');
});

test('business payment verification binds owner, subject, interval and amount',()=>{
  const expected={product:'business_subscription',ownerUserId:'u',subjectType:'trainer',subjectId:'u',interval:'monthly',months:1,amount:'500.00',currency:'RUB'};
  const remote={id:'p',status:'succeeded',paid:true,amount:{value:'500.00',currency:'RUB'},metadata:{product:'sportbuddy78_business_subscription',userId:'u',subjectType:'trainer',subjectId:'u',interval:'monthly',months:'1'}};
  assert.equal(businessPaymentMatches(remote,expected,'p'),true);
  assert.equal(businessPaymentMatches({...remote,amount:{value:'1.00',currency:'RUB'}},expected,'p'),false);
  assert.equal(businessPaymentMatches({...remote,metadata:{...remote.metadata,subjectId:'other'}},expected,'p'),false);
});

async function load(file){
  const result=await build({entryPoints:[file],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake-admin',setup(b){
    b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
    b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{
      'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
      'firebase-admin/auth':'export const getAuth=()=>({verifyIdToken:async()=>({uid:"athlete"})});',
      'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__businessDb;'
    }[a.path],loader:'js'}));
  }}]});
  return (await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))).default;
}
const createPayment=await load('api/create-business-payment.js');
const webhook=await load('api/payment-webhook.js');

function fixture(){
  const data=new Map([
    ['users/athlete',{name:'Coach',isSuspended:false,personalTrainer:{enabled:true,status:'verified',sports:['Бег']}}],
    ['billingConfig/main',{enabled:true,plans:{
      trainer:{label:'Персональный тренер',monthlyRub:500,yearlyRub:5000},
      venue:{label:'Спортивная площадка / студия',monthlyRub:1000,yearlyRub:10000},
      massage:{label:'Массаж / wellness',monthlyRub:1500,yearlyRub:15000}
    }}]
  ]);
  let providerMode='create';
  const snapshot=path=>({exists:data.has(path),data:()=>structuredClone(data.get(path))});
  const ref=path=>({path,get:async()=>snapshot(path)});
  let queue=Promise.resolve();
  globalThis.__businessDb={
    collection(name){return {doc:id=>ref(name+'/'+id)};},
    runTransaction(callback){
      const run=queue.then(async()=>{
        let wrote=false;const writes=[];
        const tx={
          get:async r=>{if(wrote)throw new Error('Read after write');return snapshot(r.path);},
          create(r,v){wrote=true;writes.push(()=>{if(data.has(r.path))throw new Error('already exists');data.set(r.path,structuredClone(v));});},
          update(r,v){wrote=true;writes.push(()=>{if(!data.has(r.path))throw new Error('missing');data.set(r.path,{...data.get(r.path),...structuredClone(v)});});},
          set(r,v,opts){wrote=true;writes.push(()=>data.set(r.path,opts?.merge?{...(data.get(r.path)||{}),...structuredClone(v)}:structuredClone(v)));}
        };
        const value=await callback(tx);writes.forEach(fn=>fn());return value;
      });
      queue=run.catch(()=>{});return run;
    }
  };
  process.env.YOOKASSA_SHOP_ID='shop';process.env.YOOKASSA_SECRET_KEY='secret';delete process.env.YOOKASSA_ALLOW_TEST_PAYMENTS;
  globalThis.fetch=async(url)=>{
    if(providerMode==='create')return {ok:true,json:async()=>({id:'business-payment-1',status:'pending',confirmation:{confirmation_url:'https://yookassa.ru/checkout'}})};
    return {ok:true,json:async()=>({
      id:'business-payment-1',status:'succeeded',paid:true,test:false,
      amount:{value:'500.00',currency:'RUB'},
      metadata:{product:'sportbuddy78_business_subscription',userId:'athlete',subjectType:'trainer',subjectId:'athlete',interval:'monthly',months:'1'}
    })};
  };
  async function request(handler,body){
    const res={statusCode:200,status(code){this.statusCode=code;return this},json(value){this.body=value;return this}};
    await handler({method:'POST',headers:{authorization:'Bearer token'},body},res);return res;
  }
  return {data,request,setProviderMode:v=>providerMode=v};
}

test('trainer can buy a business month after launch and webhook activates exactly one entitlement',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2027-02-01T12:00:00Z')});
  const f=fixture();
  const created=await f.request(createPayment,{subjectType:'trainer',subjectId:'athlete',interval:'monthly',requestId:'business-request-123456'});
  assert.equal(created.statusCode,200);
  assert.equal(created.body.amount,'500.00');
  assert.equal(f.data.get('payments/business-payment-1').processed,false);
  assert.equal(f.data.get('businessSubscriptions/trainer:athlete').ownerUserId,'athlete');

  f.setProviderMode('webhook');
  const event={event:'payment.succeeded',object:{id:'business-payment-1'}};
  const first=await f.request(webhook,event);
  assert.equal(first.statusCode,200);
  const sub=f.data.get('businessSubscriptions/trainer:athlete');
  assert.equal(sub.lastPaymentId,'business-payment-1');
  assert.equal(sub.activeUntil,'2027-03-01T12:00:00.000Z');
  assert.equal(f.data.get('payments/business-payment-1').processed,true);
  assert.ok(f.data.has('billingLedger/yookassa:business-payment-1'));

  const second=await f.request(webhook,event);
  assert.equal(second.statusCode,200);
  assert.equal(f.data.get('businessSubscriptions/trainer:athlete').activeUntil,'2027-03-01T12:00:00.000Z');
});
