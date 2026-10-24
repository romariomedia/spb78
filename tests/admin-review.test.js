import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {build} from 'esbuild';
import {claimFingerprint,claimFromPassport} from '../server/sport-id-verification.js';
import {LEISURE_CATALOG} from '../shared/leisure-destinations.js';
async function load(file){const b=await build({entryPoints:[file],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake',setup(b){
 b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{
 'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
 'firebase-admin/auth':'export const getAuth=()=>({});',
 'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__reviewDb;export const FieldPath={documentId:()=>"__name__"},FieldValue={delete:()=>null},Timestamp={fromDate:x=>x,fromMillis:x=>({toMillis:()=>x})};'
 }[a.path],loader:'js'}));}}]});return (await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))).default;}
const handlers={};
for(const file of readdirSync('api').filter(x=>x.startsWith('admin-')&&!/request-otp|verify-otp/.test(x)))handlers[file]=await load('api/'+file);
function fixture(){
 const rows=new Map([['adminSessions/live',{email:'admin',adminKey:'key',expiresAt:{toMillis:()=>Date.now()+60000}}]]);
 const faults={audit:false,beforeTransaction:null};
 const snap=path=>({id:path.split('/').at(-1),exists:rows.has(path),data:()=>rows.get(path)});
 const ref=path=>({path,get:async()=>snap(path),delete:async()=>rows.delete(path)});
 const query=(name,filters=[])=>({doc:id=>ref(name+'/'+id),orderBy(){return this},limit(){return this},where:(k,op,v)=>query(name,[...filters,[k,v]]),get:async()=>({docs:[...rows.keys()].filter(p=>p.startsWith(name+'/')&&filters.every(([k,v])=>rows.get(p)[k]===v)).map(snap)}) });
 const db={doc:ref,collection:query,async runTransaction(fn){faults.beforeTransaction?.();const writes=[];const write=(r,v,opts)=>{if(faults.audit&&r.path.startsWith('adminAuditLogs/'))throw Error('audit unavailable');writes.push(()=>rows.set(r.path,opts?.merge?{...rows.get(r.path),...v}:v));};const value=await fn({get:r=>{assert.equal(writes.length,0,"Firestore reads must precede writes");return r.get()},set:write,create:write,update:(r,v)=>write(r,v,{merge:true}),delete:r=>writes.push(()=>rows.delete(r.path))});writes.forEach(f=>f());return value;}};
 globalThis.__reviewDb=db;
 return {rows,faults,async request(file,body={},method='POST'){const r={code:200,setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}};const old=console.error;console.error=()=>{};try{await handlers[file]({method,body:{sessionId:'live',...body}},r);}finally{console.error=old;}return r;}};
}
for(const file of Object.keys(handlers))test(`${file}: no access without valid admin session and GET denied`,async()=>{
 const f=fixture();f.rows.set('adminSessions/expired',{expiresAt:{toMillis:()=>0}});
 for(const sessionId of [undefined,'missing','expired','x/y/z',{},''])assert.equal((await f.request(file,{sessionId,action:'revoke'})).code,401,file);
 assert.equal((await f.request(file,{},'GET')).code,405);
 assert.equal([...f.rows.keys()].some(k=>!k.startsWith('adminSessions/')),false);
});
const training={title:'Тестовая тренировка',sport:'Бег',dateKey:'2099-01-10',time:'18:00',lat:59.95,lng:30.28,participantsMax:12,officialStatus:'published'};
const cases=[
 ['admin-partners.js','partners',{name:'Партнёр',offerTitle:'Акция',description:'Описание',isActive:true},'partner','id'],
 ['admin-announcements.js','announcements',{title:'Объявление',text:'Тестовый текст'},'announcement','id'],
 ['admin-mutate-venue.js','venues',{name:'Площадка',sports:['Футбол'],address:'Петербург'},'venue','venueId'],
 ['admin-mutate-leisure.js','leisureDestinations',LEISURE_CATALOG[0],'destination','destinationId'],
 ['admin-official-trainings.js','trainings',training,'training','id'],
 ['admin-massage.js','massageServices',{name:'Массаж',providerType:'salon',description:'Описание услуги массажа',services:'Массаж',priceText:'от 1000',address:'СПб',bookingUrl:'https://example.com',media:[],isPublished:false},'item','id']
];
for(const [file,collection,draft,payload,idKey] of cases)test(`${file}: create/update/delete and audit commit together`,async()=>{
 const f=fixture();const create={operation:'create',[payload]:draft,[idKey]:'test-item'};
 f.faults.audit=true;assert.equal((await f.request(file,create)).code,500);
 assert.equal([...f.rows.keys()].some(k=>k.startsWith(collection+'/')),false);
 f.faults.audit=false;const created=await f.request(file,create);assert.equal(created.code,200,JSON.stringify(created.body));
 const path=[...f.rows.keys()].find(k=>k.startsWith(collection+'/')),id=path.split('/')[1],before=f.rows.get(path);
 f.faults.audit=true;
 const updatePayload=['venue','destination'].includes(payload)?'patch':payload;
 assert.equal((await f.request(file,{operation:'update',[idKey]:id,[updatePayload]:draft})).code,500);
 assert.deepEqual(f.rows.get(path),before);
 assert.equal((await f.request(file,{operation:'delete',[idKey]:id})).code,500);assert.deepEqual(f.rows.get(path),before);
 f.faults.audit=false;assert.equal((await f.request(file,{operation:'delete',[idKey]:id})).code,200);
 assert.ok(!f.rows.has(path)||f.rows.get(path).archived===true);
});
test('official edit preserves latest participants; capacity and lifecycle guards reject invalid transitions',async()=>{
 const f=fixture();f.rows.set('trainings/t',{...training,isOfficial:true,participantIds:[]});
 f.faults.beforeTransaction=()=>f.rows.set('trainings/t',{...f.rows.get('trainings/t'),participantIds:['joined-concurrently']});
 assert.equal((await f.request('admin-official-trainings.js',{operation:'update',id:'t',training:{title:'Updated title'}})).code,200);
 assert.deepEqual(f.rows.get('trainings/t').participantIds,['joined-concurrently']);
 f.faults.beforeTransaction=null;f.rows.get('trainings/t').participantIds=['a','b','c'];
 assert.equal((await f.request('admin-official-trainings.js',{operation:'update',id:'t',training:{participantsMax:2}})).code,409);
 assert.equal((await f.request('admin-official-trainings.js',{operation:'update',id:'t',training:{officialStatus:'completed'}})).code,400);
 assert.equal((await f.request('admin-official-trainings.js',{operation:'delete',id:'t'})).code,409);
 f.rows.set('chats/training_t',{participantIds:['a','b','c']});
 f.faults.audit=true;assert.equal((await f.request('admin-official-trainings.js',{operation:'cancel',id:'t'})).code,500);
 assert.equal(f.rows.get('chats/training_t').archivedAt,undefined);
 f.faults.audit=false;assert.equal((await f.request('admin-official-trainings.js',{operation:'cancel',id:'t'})).code,200);
 assert.ok(f.rows.get('chats/training_t').archivedAt);
 assert.equal((await f.request('admin-official-trainings.js',{operation:'complete',id:'t'})).code,409);
});
test('media league publishes without ticket sales, regular spectator event still requires tickets',async()=>{
 const f=fixture(),event={title:'Медиалига матч',tagline:'Ищем компанию',description:'Подробное описание события города',category:'spectator',sport:'Футбол',status:'published',participantsMax:100,lat:59.9,lng:30.3,locationName:'Стадион',address:'Санкт-Петербург',dateKey:'2099-01-10',dateLabel:'10 января',time:'18:00',officialSourceUrl:'https://example.com',isMediaLeague:true};
 assert.equal((await f.request('admin-mutate-event.js',{operation:'create',eventId:'media',event})).code,200);
 assert.equal((await f.request('admin-mutate-event.js',{operation:'create',eventId:'normal',event:{...event,isMediaLeague:false}})).code,400);
});
test('partner visibility and catalog seeding fail atomically with journal',async()=>{
 const f=fixture();f.faults.audit=true;
 for(const [file,body] of [['admin-partners.js',{operation:'setVisibility',visible:true}],['admin-mutate-venue.js',{operation:'seed',venues:[{...cases[2][2],id:'test'}]}],['admin-mutate-leisure.js',{operation:'seed'}]])assert.equal((await f.request(file,body)).code,500);
 assert.deepEqual([...f.rows.keys()],['adminSessions/live']);
});
test('push send/cancel and outbox remain atomic with audit, preview retry cannot duplicate campaign',async()=>{
 const f=fixture();f.rows.set('adminPushPreviews/p',{adminKey:'key',expiresAtMs:Date.now()+60000,scheduledAtMs:Date.now()+3600000,title:'Тест',message:'Сообщение',link:'#trainings',audience:{type:'all'},audienceCount:1});
 f.faults.audit=true;assert.equal((await f.request('admin-push.js',{operation:'send',previewId:'p'})).code,500);
 assert.ok(f.rows.has('adminPushPreviews/p'));assert.equal([...f.rows.keys()].some(k=>k.startsWith('notificationOutbox/')),false);
 f.faults.audit=false;const sent=await f.request('admin-push.js',{operation:'send',previewId:'p'});assert.equal(sent.code,200);
 const id=sent.body.campaign.id;assert.equal((await f.request('admin-push.js',{operation:'send',previewId:'p'})).code,409);
 f.faults.audit=true;assert.equal((await f.request('admin-push.js',{operation:'cancel',campaignId:id})).code,500);assert.equal(f.rows.get('adminPushCampaigns/'+id).status,'scheduled');
 f.faults.audit=false;assert.equal((await f.request('admin-push.js',{operation:'cancel',campaignId:id})).code,200);
 assert.equal([...f.rows.keys()].some(k=>k.startsWith('notificationOutbox/')),false);
});
test('Sport ID approval checks latest claim and commits claim, request and audit together',async()=>{
 const f=fixture(),passport={rankTitle:'КМС',mainSport:'Бег'},claim=claimFromPassport(passport,{claimType:'rank'});
 f.rows.set('users/u',{sportPassport:passport});f.rows.set('sportVerificationRequests/r',{...claim,userId:'u',status:'pending',fingerprint:claimFingerprint(claim)});
 const send=operation=>f.request('admin-sport-id-verification.js',{operation,requestId:'r',note:'Проверено',expectedVersion:''});
 f.faults.audit=true;assert.equal((await send('approve')).code,500);assert.equal(f.rows.get('sportVerificationRequests/r').status,'pending');
 assert.equal([...f.rows.keys()].some(k=>k.startsWith('sportVerifiedClaims/')),false);
 f.faults.audit=false;f.rows.get('users/u').sportPassport={rankTitle:'МС',mainSport:'Бег'};assert.equal((await send('approve')).code,409);
 f.rows.get('users/u').sportPassport=passport;assert.equal((await send('approve')).code,200);assert.equal((await send('reject')).code,409);
 f.faults.audit=true;assert.equal((await send('revoke')).code,500);assert.equal(f.rows.get('sportVerificationRequests/r').status,'approved');
 f.faults.audit=false;assert.equal((await send('revoke')).code,200);assert.equal([...f.rows.keys()].some(k=>k.startsWith('sportVerifiedClaims/')),false);
});
test('competition result recording/revocation is atomic and requires a finished competition participant',async()=>{
 const f=fixture();f.rows.set('events/e',{category:'competition',status:'finished',participantIds:['u'],title:'Кубок',sport:'Бег'});f.rows.set('users/u',{name:'Спортсмен'});
 const send=(operation,userId='u')=>f.request('admin-event-results.js',{operation,eventId:'e',userId,placement:'1 место'});
 assert.equal((await send('record','outsider')).code,409);
 f.faults.audit=true;assert.equal((await send('record')).code,500);assert.equal(f.rows.has('sportPassportResults/e__u'),false);
 f.faults.audit=false;assert.equal((await send('record')).code,200);
 f.faults.audit=true;assert.equal((await send('revoke')).code,500);assert.ok(f.rows.has('sportPassportResults/e__u'));
 f.faults.audit=false;assert.equal((await send('revoke')).code,200);
});

for(const [file,collection,draft,payload] of cases.filter(x=>!['venue','destination'].includes(x[3])))test(`${file}: failed create retry produces one card and receipt`,async()=>{
 const f=fixture(),body={operation:'create',requestId:'retry-123',[payload]:draft};
 f.faults.audit=true;assert.equal((await f.request(file,body)).code,500);
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('adminMutationReceipts/')).length,0);
 f.faults.audit=false;const first=await f.request(file,body),again=await f.request(file,body);
 assert.equal(first.code,200,JSON.stringify(first.body));assert.deepEqual(again.body,first.body);
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith(collection+'/')).length,1);
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('adminAuditLogs/')).length,1);
 assert.equal((await f.request(file,{...body,[payload]:{...draft,description:'Изменённое описание'}})).code,409);
});
test('official training change and notification commit together; unchanged retry is silent',async()=>{
 const f=fixture();f.rows.set('trainings/t',{...training,isOfficial:true,participantIds:['u']});
 const body={operation:'update',id:'t',training:{locationName:'Новое место'}};
 f.faults.audit=true;assert.equal((await f.request('admin-official-trainings.js',body)).code,500);
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('notificationOutbox/')).length,0);
 f.faults.audit=false;assert.equal((await f.request('admin-official-trainings.js',body)).code,200);
 assert.equal((await f.request('admin-official-trainings.js',body)).code,200);
 const jobs=[...f.rows].filter(([k])=>k.startsWith('notificationOutbox/')).map(([,v])=>v);
 assert.equal(jobs.length,1);assert.deepEqual(jobs[0].recipients,['u']);assert.equal(jobs[0].kind,'training_update');
});
