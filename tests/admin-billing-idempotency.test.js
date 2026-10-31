import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const built=await build({
  entryPoints:['api/admin-billing.js'],
  bundle:true,format:'esm',platform:'node',write:false,
  plugins:[{name:'fakes',setup(b){
    b.onResolve({filter:/^firebase-admin\//},args=>({path:args.path,namespace:'fake'}));
    b.onResolve({filter:/admin-control\.js$/},()=>({path:'admin-control',namespace:'fake'}));
    b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:{
      'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
      'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__adminBillingDb;',
      'admin-control':'export const requireAdminSession=async()=>({email:"admin@example.ru"});export const writeAdminAudit=async()=>{};'
    }[args.path],loader:'js'}));
  }}]
});
const handler=(await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))).default;

function fixture(){
  const data=new Map([
    ['users/athlete',{name:'Coach',personalTrainer:{enabled:true,status:'verified'}}]
  ]);
  const snapshot=path=>({exists:data.has(path),data:()=>structuredClone(data.get(path))});
  const ref=path=>({path,get:async()=>snapshot(path)});
  let queue=Promise.resolve();
  globalThis.__adminBillingDb={
    collection(name){return {doc:id=>ref(name+'/'+id)};},
    runTransaction(callback){
      const run=queue.then(async()=>{
        let wrote=false;const writes=[];
        const tx={
          async get(r){if(wrote)throw new Error('Read after write');return snapshot(r.path);},
          set(r,v,opts){wrote=true;writes.push(()=>data.set(r.path,opts?.merge?{...(data.get(r.path)||{}),...structuredClone(v)}:structuredClone(v)));},
          create(r,v){wrote=true;writes.push(()=>{if(data.has(r.path))throw new Error('already exists');data.set(r.path,structuredClone(v));});}
        };
        const value=await callback(tx);writes.forEach(fn=>fn());return value;
      });
      queue=run.catch(()=>{});return run;
    }
  };
  async function request(body){
    const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};
    await handler({method:'POST',body:{sessionId:'session',...body}},res);
    return res;
  }
  return {data,request};
}

test('repeating complimentary grant with the same requestId extends access exactly once',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2027-02-01T12:00:00Z')});
  const f=fixture();
  const body={
    operation:'grant',subjectType:'trainer',subjectId:'athlete',days:30,
    note:'Компенсация партнёру',requestId:'grant-retry-123456'
  };
  assert.equal((await f.request(body)).statusCode,200);
  const first=f.data.get('businessSubscriptions/trainer:athlete').activeUntil;
  assert.equal(first,'2027-03-03T12:00:00.000Z');
  assert.equal((await f.request(body)).statusCode,200);
  assert.equal(f.data.get('businessSubscriptions/trainer:athlete').activeUntil,first);
  assert.ok(f.data.has('billingLedger/admin-grant:grant-retry-123456'));
  assert.equal([...f.data.keys()].filter(key=>key.startsWith('billingLedger/admin-grant:')).length,1);
});

test('same grant requestId cannot be replayed with changed terms',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2027-02-01T12:00:00Z')});
  const f=fixture();
  const base={
    operation:'grant',subjectType:'trainer',subjectId:'athlete',days:30,
    note:'Компенсация партнёру',requestId:'grant-retry-654321'
  };
  assert.equal((await f.request(base)).statusCode,200);
  const before=f.data.get('businessSubscriptions/trainer:athlete').activeUntil;
  const replay=await f.request({...base,days:60});
  assert.equal(replay.statusCode,409);
  assert.equal(f.data.get('businessSubscriptions/trainer:athlete').activeUntil,before);
});
