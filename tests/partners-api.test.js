import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function load(file){const b=await build({entryPoints:[file],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake-admin',setup(b){
 b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{
 'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
 'firebase-admin/auth':`export const getAuth=()=>({verifyIdToken:async(token,revoked)=>{if(token!=='valid'||revoked!==true)throw {code:'auth/invalid-token'};return {uid:'user'}}});`,
 'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__partnersDb;'
 }[a.path],loader:'js'}));
}}]});return (await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))).default;}
const admin=await load('api/admin-partners.js'),feed=await load('api/partners.js');
function fixture(initial={}){
 const rows=new Map(Object.entries(initial));let partnerReads=0;
 const ref=path=>({id:path.split('/').at(-1),get:async()=>({exists:rows.has(path),data:()=>rows.get(path)}),set:async v=>rows.set(path,v),create:async v=>{if(rows.has(path))throw Error('exists');rows.set(path,v)},delete:async()=>rows.delete(path)});
 const db={doc:ref,collection(name){const query=(filters=[],limit=Infinity,order=null)=>({
 doc:id=>ref(name+'/'+id),where:(k,op,v)=>{assert.equal(op,'==');return query([...filters,[k,v]],limit,order)},limit:n=>query(filters,n,order),orderBy:(k,d)=>query(filters,limit,[k,d]),
 async get(){if(name==='partners')partnerReads++;let values=[...rows].filter(([p,v])=>p.startsWith(name+'/')&&filters.every(([k,x])=>v[k]===x));if(order)values.sort((a,b)=>(b[1][order[0]]||0)-(a[1][order[0]]||0));return {docs:values.slice(0,limit).map(([p,v])=>({id:p.split('/').at(-1),data:()=>v}))}}
 });return query()}};
 globalThis.__partnersDb=db;
 const request=async(handler,body={},token='valid')=>{const r={code:200,status(n){this.code=n;return this},json(v){this.body=v;return this},setHeader(k,v){this[k]=v}};await handler({method:handler===feed?'GET':'POST',body,headers:{authorization:token?'Bearer '+token:''}},r);return r};
 return {rows,request,reads:()=>partnerReads};
}
const draft={name:'Тестовый партнёр',offerTitle:'Предложение',description:'Описание',isActive:true};
const session={expiresAt:{toMillis:()=>Date.now()+60000},email:'admin@example.invalid'};
test('partner admin requires a live OTP session before all writes',async()=>{
 const f=fixture({'adminSessions/expired':{expiresAt:{toMillis:()=>0}}});
 for(const operation of ['list','create','update','delete','setVisibility'])assert.equal((await f.request(admin,{operation,partner:draft,visible:true})).code,401);
 assert.equal((await f.request(admin,{operation:'create',sessionId:'expired',partner:draft})).code,401);
 assert.equal(f.rows.has('partnerConfig/main'),false);assert.equal(f.reads(),0);
});
test('hidden or empty partner section produces no cards and hidden section avoids catalog reads',async()=>{
 const f=fixture({'partners/a':draft});
 assert.deepEqual((await f.request(feed)).body,{visible:false,partners:[]});assert.equal(f.reads(),0);
 f.rows.set('partnerConfig/main',{visible:false});assert.deepEqual((await f.request(feed)).body,{visible:false,partners:[]});assert.equal(f.reads(),0);
 f.rows.set('partnerConfig/main',{visible:true});f.rows.delete('partners/a');assert.deepEqual((await f.request(feed)).body,{visible:true,partners:[]});
});
test('partner lifecycle publishes, edits, hides and deletes without exposing admin metadata',async()=>{
 const f=fixture({'adminSessions/live':session});
 const send=body=>f.request(admin,{sessionId:'live',...body});
 const created=await send({operation:'create',partner:draft});assert.equal(created.code,200);const id=created.body.partner.id;
 await send({operation:'setVisibility',visible:true});
 let result=await f.request(feed);assert.equal(result.body.partners.length,1);assert.equal(result.body.partners[0].createdBy,undefined);assert.equal(result['Cache-Control'],'private, no-store');
 await send({operation:'update',id,partner:{offerTitle:'Новое предложение'}});assert.equal((await f.request(feed)).body.partners[0].offerTitle,'Новое предложение');
 await send({operation:'update',id,partner:{isActive:false}});assert.equal((await f.request(feed)).body.partners.length,0);
 await send({operation:'delete',id});assert.equal(f.rows.has('partners/'+id),false);
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('adminAuditLogs/')).length,5);
});
test('publication filter and priority run before display limit; expired and future offers stay hidden',async()=>{
 const f=fixture({'partnerConfig/main':{visible:true},'partners/z':{...draft,priority:100},'partners/expired':{...draft,endAt:'2000-01-01'}});
 for(let i=0;i<60;i++)f.rows.set('partners/future'+i,{...draft,priority:50,startAt:'2099-01-01'});
 for(let i=0;i<25;i++)f.rows.set('partners/live'+i,{...draft,priority:i});
 const result=await f.request(feed);assert.equal(result.body.partners.length,20);assert.equal(result.body.partners[0].id,'z');assert.equal(result.body.partners.some(x=>x.id==='expired'||x.id.startsWith('future')),false);
});
test('partner feed denies missing/invalid auth and suspended accounts',async()=>{
 const f=fixture({'users/user':{isSuspended:true}});
 assert.equal((await f.request(feed,{},'')).code,401);assert.equal((await f.request(feed,{},'bad')).code,401);assert.equal((await f.request(feed)).code,403);assert.equal(f.reads(),0);
});
