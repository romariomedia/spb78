import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function load(file){
 const result=await build({entryPoints:[file],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake-admin',setup(b){
  b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
  b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{
   'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
   'firebase-admin/auth':'export const getAuth=()=>globalThis.__integrityAuth;',
   'firebase-admin/firestore':'export const Timestamp={fromDate:x=>x},FieldValue={delete:()=>null};export const getFirestore=()=>globalThis.__integrityDb;export const FieldPath={documentId:()=> "__name__"};'
  }[a.path],loader:'js'}));
 }}]});return (await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))).default;
}
const config=await load('api/admin-config.js'),moderation=await load('api/admin-moderation.js'),eventAdmin=await load('api/admin-mutate-event.js'),usersAdmin=await load('api/admin-users.js');
function fixture(){
 const rows=new Map([['adminSessions/live',{email:'admin',expiresAt:{toMillis:()=>Date.now()+60000}}],['feed/p',{content:'visible'}]]);
 const faults={audit:false,reports:false,beforeTransaction:null};
 const snap=path=>({exists:rows.has(path),data:()=>rows.get(path)});
 const ref=path=>({path,get:async()=>snap(path),set:async value=>rows.set(path,value)});
 const writer=()=>{const pending=[];return {
  get:async r=>snap(r.path),
  set(r,v){if(faults.audit&&r.path.startsWith('adminAuditLogs/'))throw Error('audit unavailable');pending.push(()=>rows.set(r.path,v));},
  create(r,v){pending.push(()=>rows.set(r.path,v));},
  delete(r){pending.push(()=>rows.delete(r.path));},
  update(r,v){pending.push(()=>rows.set(r.path,{...rows.get(r.path),...v}));},
  async commit(){pending.forEach(f=>f());}
 }};
 const db={doc:ref,batch:writer,collection(name){return {doc:id=>ref(name+'/'+id),orderBy(){return this},limit(){return this},async get(){if(name==='reports'&&faults.reports)throw Error('reports unavailable');return {docs:[]};}}},async runTransaction(fn){faults.beforeTransaction?.();const tx=writer(),value=await fn(tx);await tx.commit();return value;}};
 globalThis.__integrityDb=db;
 return {rows,faults,async request(handler,body){const res={code:200,status(c){this.code=c;return this},json(v){this.body=v;return this}};await handler({method:'POST',body:{sessionId:'live',...body}},res);return res;}};
}
test('configuration keeps concurrent product change and writes matching audit atomically',async()=>{
 const f=fixture();
 f.faults.beforeTransaction=()=>f.rows.set('appConfig/main',{operationsVersion:1,product:{freeMatches:9}});
 const res=await f.request(config,{operation:'saveFeatureFlags',featureFlags:{datingEnabled:false}});
 assert.equal(res.code,200);assert.equal(f.rows.get('appConfig/main').product.freeMatches,9);
 assert.equal(f.rows.get('appConfig/main').featureFlags.datingEnabled,false);
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('adminAuditLogs/')).length,1);
});
test('failed audit cannot leave saved config or hidden publication',async()=>{
 const f=fixture();f.faults.audit=true;
 assert.equal((await f.request(config,{operation:'saveProductSettings',product:{maintenanceMode:true}})).code,500);
 assert.equal(f.rows.has('appConfig/main'),false);
 assert.equal((await f.request(moderation,{operation:'setPostHidden',id:'p',hidden:true,reason:'Review'})).code,500);
 assert.equal(f.rows.get('feed/p').isHidden,undefined);
});
test('failed complaints query produces an error, not an empty successful queue',async()=>{
 const f=fixture();f.faults.reports=true;
 const res=await f.request(moderation,{operation:'list'});
 assert.equal(res.code,500);assert.equal(res.body.reports,undefined);
});

test('event change and audit commit together, audit failure leaves original event intact',async()=>{
 const f=fixture();f.rows.set('events/e',{id:'e',title:'Original',tagline:'A valid tagline',description:'A sufficiently long description.',category:'competition',sport:'Бег',status:'draft',participantsMax:10,participantIds:[],lat:59.9,lng:30.3,locationName:'Park',address:'Park street',dateLabel:'2027-03-01',dateKey:'2027-03-01',time:'12:00'});
 f.faults.audit=true;
 const failed=await f.request(eventAdmin,{operation:'update',eventId:'e',patch:{title:'New title'}});
 assert.equal(failed.code,500);assert.equal(f.rows.get('events/e').title,'Original');
 f.faults.audit=false;
 const saved=await f.request(eventAdmin,{operation:'update',eventId:'e',patch:{title:'New title'}});
 assert.equal(saved.code,200);assert.equal(f.rows.get('events/e').title,'New title');
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('adminAuditLogs/')).length,1);
});

for (const initiallyDisabled of [true,false]) test(`suspension audit failure restores actual Auth state ${initiallyDisabled}`,async()=>{
 const f=fixture();f.rows.set('users/u',{activeLooking:true,isSuspended:initiallyDisabled});
 let disabled=initiallyDisabled;
 globalThis.__integrityAuth={getUser:async()=>({disabled}),updateUser:async(_id,patch)=>{disabled=patch.disabled;}};
 f.faults.audit=true;
 const failed=await f.request(usersAdmin,{operation:'setSuspension',userId:'u',suspended:true,reason:'Review'});
 assert.equal(failed.code,500);assert.equal(disabled,initiallyDisabled);
 assert.equal(f.rows.get('users/u').isSuspended,initiallyDisabled);
 f.faults.audit=false;
 const saved=await f.request(usersAdmin,{operation:'setSuspension',userId:'u',suspended:true,reason:'Review'});
 assert.equal(saved.code,200);assert.equal(disabled,true);
 assert.equal(f.rows.get('users/u').isSuspended,true);
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('adminAuditLogs/')).length,1);
});
test('failed Auth compensation is reported explicitly',async()=>{
 const f=fixture();f.rows.set('users/u',{activeLooking:true});f.faults.audit=true;
 let writes=0;
 globalThis.__integrityAuth={getUser:async()=>({disabled:false}),updateUser:async()=>{if(++writes===2)throw Error('Auth unavailable');}};
 const result=await f.request(usersAdmin,{operation:'setSuspension',userId:'u',suspended:true,reason:'Review'});
 assert.equal(result.code,503);assert.match(result.body.error,/Firebase Authentication/);
 assert.equal(f.rows.get('users/u').isSuspended,undefined);
});

test('admin saves valid Android update policy and rejects invalid or incomplete settings',async()=>{
 const f=fixture();
 const product={minimumAndroidVersion:'12',ruStoreUrl:'https://www.rustore.ru/catalog/app/ru.sportbuddy.mobile'};
 assert.equal((await f.request(config,{operation:'saveProductSettings',product})).code,200);
 assert.equal(f.rows.get('appConfig/main').product.minimumAndroidVersion,'12');
 for(const patch of [{minimumAndroidVersion:'1.2'},{ruStoreUrl:''},{ruStoreUrl:'https://example.com'}]){
  assert.equal((await f.request(config,{operation:'saveProductSettings',product:{...product,...patch}})).code,400);
  assert.equal(f.rows.get('appConfig/main').product.minimumAndroidVersion,'12');
 }
});
