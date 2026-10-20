import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function load(file){const b=await build({entryPoints:[file],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake-admin',setup(b){
 b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{
 'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
 'firebase-admin/auth':`export const getAuth=()=>({verifyIdToken:async(token,revoked)=>{if(token!=='valid'||revoked!==true)throw {code:'auth/invalid-token'};return {uid:'user'}}});`,
 'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__massageDb;'
 }[a.path],loader:'js'}));
}}]});return (await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))).default;}
const admin=await load('api/admin-massage.js'),feed=await load('api/massage.js');
function fixture(initial={}){
 const rows=new Map(Object.entries(initial));let partnerReads=0;
 const ref=path=>({path,id:path.split('/').at(-1),get:async()=>({exists:rows.has(path),data:()=>rows.get(path)}),set:async v=>rows.set(path,v),create:async v=>{if(rows.has(path))throw Error('exists');rows.set(path,v)},delete:async()=>rows.delete(path)});
 const db={doc:ref,async runTransaction(fn){const pending=[];const tx={get:r=>r.get(),set:(r,v)=>pending.push(()=>r.set(v)),create:(r,v)=>pending.push(()=>r.create(v)),delete:r=>pending.push(()=>r.delete())};const result=await fn(tx);for(const write of pending)await write();return result;},collection(name){const query=(filters=[],limit=Infinity,order=null)=>({
 doc:id=>ref(name+'/'+id),where:(k,op,v)=>{assert.equal(op,'==');return query([...filters,[k,v]],limit,order)},limit:n=>query(filters,n,order),orderBy:(k,d)=>query(filters,limit,[k,d]),
 async get(){if(name==='partners')partnerReads++;let values=[...rows].filter(([p,v])=>p.startsWith(name+'/')&&filters.every(([k,x])=>v[k]===x));if(order)values.sort((a,b)=>(b[1][order[0]]||0)-(a[1][order[0]]||0));return {docs:values.slice(0,limit).map(([p,v])=>({id:p.split('/').at(-1),data:()=>v}))}}
 });return query()}};
 globalThis.__massageDb=db;
 const request=async(handler,body={},token='valid')=>{const r={code:200,status(n){this.code=n;return this},json(v){this.body=v;return this},setHeader(k,v){this[k]=v}};await handler({method:handler===feed?'GET':'POST',body,headers:{authorization:token?'Bearer '+token:''}},r);return r};
 return {rows,request,reads:()=>partnerReads};
}
const session={expiresAt:{toMillis:()=>Date.now()+60000},email:'admin@example.invalid'};
const listing={name:'Тестовый салон',providerType:'salon',description:'Описание услуги массажа',priceText:'60 минут — 3000 ₽',address:'Адрес салона',bookingUrl:'https://example.com/book',isPublished:true,media:[{type:'video',url:'https://example.com/video.mp4'}]};
test('massage admin denies absent and expired OTP; public listing requires auth',async()=>{
 const f=fixture({'adminSessions/expired':{expiresAt:{toMillis:()=>0}}});
 for(const operation of ['list','create','update','delete'])assert.equal((await f.request(admin,{operation,item:listing})).code,401);
 assert.equal((await f.request(admin,{operation:'create',sessionId:'expired',item:listing})).code,401);
 assert.equal((await f.request(feed,{},'')).code,401);
 assert.equal((await f.request(feed,{},'bad')).code,401);
 f.rows.set('users/user',{isSuspended:true});assert.equal((await f.request(feed)).code,403);
});
test('massage lifecycle starts empty, creates private draft, publishes, hides and deletes',async()=>{
 const f=fixture({'adminSessions/live':session});
 const send=body=>f.request(admin,{sessionId:'live',...body});
 assert.deepEqual((await f.request(feed)).body,{items:[]});
 const created=await send({operation:'create',item:{...listing,isPublished:false}});assert.equal(created.code,200);
 const id=created.body.id;assert.ok(id);
 assert.deepEqual((await f.request(feed)).body.items,[]);
 assert.equal((await send({operation:'list'})).body.items.length,1);
 await send({operation:'update',id,item:{isPublished:true,providerType:'private'}});
 const publicItems=(await f.request(feed)).body.items;assert.equal(publicItems.length,1);assert.equal(publicItems[0].providerType,'private');
 assert.equal(publicItems[0].updatedAtMs,undefined);assert.equal(publicItems[0].bookingUrl,listing.bookingUrl);
 assert.equal(publicItems[0].media[0].type,'video');
 await send({operation:'update',id,item:{isPublished:false}});assert.deepEqual((await f.request(feed)).body.items,[]);
 await send({operation:'delete',id});assert.equal(f.rows.has('massageServices/'+id),false);
 assert.equal((await send({operation:'update',id,item:listing})).code,404);
 assert.ok([...f.rows.keys()].every(key=>!key.startsWith('bookings/')));
});
