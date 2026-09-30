import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
async function load(path) {
  const result=await build({entryPoints:[path],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'admin',setup(b){
    b.onResolve({filter:/^firebase-admin\//},args=>({path:args.path,namespace:'fake'}));
    b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:{
      'firebase-admin/app':'export const getApps=()=>[{}],cert=x=>x,initializeApp=()=>{};',
      'firebase-admin/auth':'export const getAuth=()=>({verifyIdToken:async()=>({uid:"athlete"})});',
      'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__paymentDb;'
    }[args.path],loader:'js'}));
  }}]});
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text+'\n//# sourceURL='+path).toString('base64')}`)).default;
}
const create=await load('api/create-payment.js'), webhook=await load('api/payment-webhook.js');
const expected={userId:'athlete',plan:'monthly',days:30,amount:'490.00',currency:'RUB',processed:false};
const remote=()=>({id:'payment-1',status:'succeeded',paid:true,amount:{value:'490.00',currency:'RUB'},metadata:{userId:'athlete',plan:'monthly',days:'30',product:'sportbuddy78_premium'}});
function fixture(records={}) {
  const data=new Map(Object.entries(records));let calls=[];let remoteValue=remote();let fail=false;
  process.env.YOOKASSA_SHOP_ID='test-shop';process.env.YOOKASSA_SECRET_KEY='test-secret';delete process.env.YOOKASSA_ALLOW_TEST_PAYMENTS;
  const ref=path=>({path,get:async()=>snapshot(path)});
  const snapshot=path=>({exists:data.has(path),data:()=>structuredClone(data.get(path))});
  let queue=Promise.resolve();
  globalThis.__paymentDb={collection:name=>({doc:id=>ref(name+'/'+id)}),runTransaction(callback){
    const result=queue.then(async()=>{
      let wrote=false;const writes=[];
      const tx={get:async ref=>{if(wrote)throw new Error('Read after write');return snapshot(ref.path);}};
      for(const kind of ['create','update'])tx[kind]=(ref,value)=>{wrote=true;writes.push(()=>{
        if(kind==='create'&&data.has(ref.path))throw new Error('already exists');
        if(kind==='update'&&!data.has(ref.path))throw new Error('missing document');
        data.set(ref.path,structuredClone(kind==='update'?{...data.get(ref.path),...value}:value));
      });};
      const value=await callback(tx);writes.forEach(fn=>fn());return value;
    });queue=result.catch(()=>{});return result;
  }};
  globalThis.fetch=async(url,options)=>{calls.push({url,options});if(fail)throw new Error('timeout');return {ok:true,json:async()=>structuredClone(remoteValue)};};
  async function request(handler,body){const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};await handler({method:'POST',headers:{authorization:'Bearer test'},body},res);return res;}
  return {data,calls,request,setRemote:value=>remoteValue=value,setFail:value=>fail=value};
}
const event={event:'payment.succeeded',object:{id:'payment-1'}};
test('early webhook is not acknowledged before local payment exists',async()=>{
  const f=fixture({'users/athlete':{}});assert.equal((await f.request(webhook,event)).statusCode,503);assert.equal(f.calls.length,0);
});
test('duplicate and simultaneous webhook delivery extends Premium once',async()=>{
  const start=Date.now()+5*86400000;const f=fixture({'users/athlete':{premiumUntil:new Date(start).toISOString()},'payments/payment-1':expected});
  const results=await Promise.all([f.request(webhook,event),f.request(webhook,event)]);
  assert.ok(results.every(r=>r.statusCode===200));assert.equal(Date.parse(f.data.get('users/athlete').premiumUntil),start+30*86400000);
  await f.request(webhook,event);assert.equal(Date.parse(f.data.get('users/athlete').premiumUntil),start+30*86400000);
});
test('wrong payment id, owner, amount, currency and test mode cannot grant Premium',async()=>{
  for(const change of [{id:'other'},{metadata:{...remote().metadata,userId:'other'}},{amount:{value:'1.00',currency:'RUB'}},{amount:{value:'490.00',currency:'USD'}},{test:true},{paid:false}]) {
    const f=fixture({'users/athlete':{},'payments/payment-1':expected});f.setRemote({...remote(),...change});
    assert.equal((await f.request(webhook,event)).statusCode,400);assert.equal(f.data.get('users/athlete').premiumUntil,undefined);
  }
});
test('provider failure leaves payment unprocessed for retry',async()=>{
  const f=fixture({'users/athlete':{},'payments/payment-1':expected});f.setFail(true);
  assert.equal((await f.request(webhook,event)).statusCode,503);assert.equal(f.data.get('payments/payment-1').processed,false);
});
test('test payments require explicit configuration',async()=>{
  const f=fixture({'users/athlete':{},'payments/payment-1':expected});f.setRemote({...remote(),test:true});process.env.YOOKASSA_ALLOW_TEST_PAYMENTS='true';
  assert.equal((await f.request(webhook,event)).statusCode,200);delete process.env.YOOKASSA_ALLOW_TEST_PAYMENTS;
});
test('creation retries use the same provider key after timeout',async()=>{
  const f=fixture({'users/athlete':{}});const body={plan:'monthly',requestId:'request-retry-123456'};f.setFail(true);
  assert.equal((await f.request(create,body)).statusCode,503);
  f.setFail(false);f.setRemote({...remote(),confirmation:{confirmation_url:'https://yookassa.ru/checkout'}});
  assert.equal((await f.request(create,body)).statusCode,200);
  assert.equal(f.calls[0].options.headers['Idempotence-Key'],f.calls[1].options.headers['Idempotence-Key']);
  assert.equal((await f.request(create,body)).statusCode,200);assert.equal(f.calls.length,2);
});
test('retry cannot reset an already processed payment',async()=>{
  const f=fixture({'users/athlete':{},'payments/payment-1':{...expected,processed:true}});
  f.setRemote({...remote(),confirmation:{confirmation_url:'https://yookassa.ru/checkout'}});
  assert.equal((await f.request(create,{plan:'monthly',requestId:'request-retry-123456'})).statusCode,200);
  assert.equal(f.data.get('payments/payment-1').processed,true);
});
test('invalid tariff and missing profile never create provider payments',async()=>{
  const f=fixture({});
  assert.equal((await f.request(create,{plan:'constructor'})).statusCode,400);
  assert.equal((await f.request(create,{plan:'monthly'})).statusCode,404);assert.equal(f.calls.length,0);
});
test('same request cannot change tariff or outlive provider deduplication window',async()=>{
  const f=fixture({'users/athlete':{}});f.setRemote({...remote(),confirmation:{confirmation_url:'https://yookassa.ru/checkout'}});
  const body={plan:'monthly',requestId:'request-retry-123456'};await f.request(create,body);
  assert.equal((await f.request(create,{...body,plan:'yearly'})).statusCode,409);
  const key=[...f.data.keys()].find(key=>key.startsWith('paymentRequests/'));f.data.get(key).createdAt=new Date(Date.now()-24*3600000).toISOString();
  assert.equal((await f.request(create,body)).statusCode,409);assert.equal(f.calls.length,1);
});
