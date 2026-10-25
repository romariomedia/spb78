import test from 'node:test';
import {mutateTrainerBooking,saveTrainerServices,bookingId,trainerServices,listTrainerBookings} from '../server/trainer-bookings.js';
import {publicTrainer,mutateTrainer} from '../server/personal-trainer.js';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { protectedCoords } from '../shared/geo-privacy.js';
const bundled = await build({entryPoints:['api/sportbuddy-mutation.js'],bundle:true,format:'esm',platform:'node',write:false,
  plugins:[{name:'fake-admin',setup(b){
    b.onResolve({filter:/^firebase-admin\//},args=>({path:args.path,namespace:'fake'}));
    b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:{
      'firebase-admin/app':'export const getApps=()=>[{}],cert=x=>x,initializeApp=()=>{};',
      'firebase-admin/auth':'export const getAuth=()=>({verifyIdToken:async()=>({uid:globalThis.__uid}),getUser:async uid=>({uid,email:globalThis.__authUsers?.[uid]?.email,displayName:globalThis.__authUsers?.[uid]?.displayName,metadata:{creationTime:globalThis.__authUsers?.[uid]?.creationTime||new Date().toISOString()}})});',
      'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__mutationDb; export const Timestamp={fromDate:date=>date.toISOString()};'
    }[args.path],loader:'js'}));
  }}]});
const {default:handler}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text+'\n//# sourceURL=mutation-test-fixture.js').toString('base64')}`);
function fixture(initial,authUsers={}) {
  const records=new Map(Object.entries(initial));
  globalThis.__authUsers=authUsers;
  function valid(value) {
    if(value===undefined)throw new Error('Firestore rejects undefined');
    if(value && typeof value==='object')Object.values(value).forEach(valid);
  }
  const snap=ref=>({id:ref.id,ref,exists:records.has(ref.path),data:()=>structuredClone(records.get(ref.path))});
  const write=(kind,ref,value,merge)=>{
    if(kind==='delete'){records.delete(ref.path);return;}
    valid(value);
    if(kind==='create'&&records.has(ref.path))throw new Error('already-exists');
    if(kind==='update'&&!records.has(ref.path))throw new Error('not-found');
    records.set(ref.path,structuredClone(kind==='update'||merge?{...records.get(ref.path),...value}:value));
  };
  const db={collection(name){
    const query=(filters=[])=>({
      where:(field,op,value)=>query([...filters,[field,op,value]]),orderBy:()=>query(filters),limit:()=>query(filters),
      async get(){const docs=[...records.keys()].filter(path=>path.startsWith(name+'/')).filter(path=>filters.every(([field,op,value])=>op==='=='?records.get(path)[field]===value:records.get(path)[field]?.includes(value))).map(path=>snap(db.collection(name).doc(path.slice(name.length+1))));return {docs,empty:docs.length===0};}
    });
    return {...query(),doc(id){const ref={id,path:name+'/'+id};ref.get=async()=>snap(ref);ref.create=async value=>write('create',ref,value);ref.set=async(value,options)=>write('set',ref,value,options?.merge);ref.collection=sub=>db.collection(ref.path+'/'+sub);return ref;}};
  },async runTransaction(callback){
    const pending=[];let wrote=false;
    const tx={get:async ref=>{if(wrote)throw new Error('Read after write');return ref.path?snap(ref):ref.get();}};
    for(const kind of ['create','update','set','delete'])tx[kind]=(ref,value,options)=>{if(kind!=='delete')valid(value);wrote=true;pending.push(()=>write(kind,ref,value,options?.merge));};
    const result=await callback(tx);pending.forEach(write=>write());return result;
  }};
  globalThis.__mutationDb=db;
  async function request(uid,body){globalThis.__uid=uid;const response={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};const old=console.error;console.error=()=>{};try{await handler({method:'POST',headers:{authorization:'Bearer test'},body},response);}finally{console.error=old;}return response;}
  return {records,request,db};
}
const premium=()=>({name:'Athlete',premiumUntil:new Date(Date.now()+86400000).toISOString(),friendIds:[],friendRequestsSent:[],friendRequestsReceived:[],likedUserIds:[],matchIds:[]});

const trainer=()=>({...premium(),name:'Тренер',personalTrainer:{enabled:true,status:'verified',sports:['Бег'],hourlyRate:1500,serviceDescription:'60 минут, вход в зал отдельно'}});
const setup=()=>fixture({'users/t':trainer(),'users/c':premium(),'users/x':premium()});
const input={trainerId:'t',sport:'Бег',hourlyRate:1500,preferredTime:'Вторник вечером',note:'Начинающий'};
const create=f=>mutateTrainerBooking(f.db,'c','bookingCreate',input);
const decision=r=>({requestId:r.id,version:r.version});
const chatId='chat_c__t';
const chat=(f,uid,extra={})=>f.request(uid,{action:'chat',chatId,companionId:uid==='c'?'t':'c',text:'Здравствуйте!',...extra});

test('trainer booking approval opens both-way chat, history, typing and deletion; pending cannot send',async()=>{
 const f=setup();const {request:r}=await create(f);
 assert.equal(r.status,'pending');assert.equal(r.hourlyRate,1500);assert.equal(f.records.has('chats/'+chatId),false);
 assert.equal((await chat(f,'c',{trainerBookingApproved:true})).statusCode,403);
 assert.equal((await chat(f,'t')).statusCode,403);
 const approved=await mutateTrainerBooking(f.db,'t','bookingAccept',decision(r));
 assert.equal(approved.request.chatId,chatId);assert.equal(f.records.get('chats/'+chatId).trainerBookingApproved,true);
 assert.deepEqual(f.records.get('users/c').friendIds,[]);
 const sent=await chat(f,'c');assert.equal(sent.statusCode,200);
 assert.equal((await chat(f,'t')).statusCode,200);
 assert.equal((await chat(f,'c',{operation:'history'})).statusCode,200);
 assert.equal((await chat(f,'t',{operation:'typing',active:true})).statusCode,200);
 assert.equal((await chat(f,'c',{operation:'deleteMessage',messageId:sent.body.message.id})).statusCode,200);
 assert.equal((await chat(f,'x',{operation:'history'})).statusCode,403);
 const jobs=[...f.records.entries()].filter(([key])=>key.startsWith('notificationOutbox/')).map(([,v])=>v);
 assert.ok(jobs.some(j=>j.kind==='trainer_booking'&&j.recipients.includes('t')&&j.link==='#trainer-requests'));
 assert.ok(jobs.some(j=>j.kind==='trainer_booking'&&j.recipients.includes('c')&&j.link.startsWith('#chat=')));
});
test('booking duplicate delivery is idempotent and third party/client cannot approve',async()=>{
 const f=setup();const {request:r}=await create(f);const again=await create(f);
 assert.equal(again.request.version,r.version);
 assert.equal([...f.records.keys()].filter(k=>k.startsWith('notificationOutbox/')).length,1);
 for(const uid of ['c','x'])await assert.rejects(mutateTrainerBooking(f.db,uid,'bookingAccept',decision(r)),e=>e.status===403);
 for(const uid of ['t','x'])await assert.rejects(mutateTrainerBooking(f.db,uid,'bookingCancel',decision(r)),e=>e.status===403);
 const accepted=await mutateTrainerBooking(f.db,'t','bookingAccept',decision(r));
 assert.deepEqual(await mutateTrainerBooking(f.db,'t','bookingAccept',decision(r)),accepted);
 assert.equal([...f.records.keys()].filter(k=>k.startsWith('notificationOutbox/')).length,2);
});
test('rejection/cancellation never grants chat; cooldown and stale version protect resubmissions',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-25T12:00:00Z')});
 for(const [action,uid] of [['bookingReject','t'],['bookingCancel','c']]){
 const f=setup();const {request:r}=await create(f);await mutateTrainerBooking(f.db,uid,action,decision(r));
 assert.equal((await chat(f,'c')).statusCode,403);
 await assert.rejects(create(f),e=>e.status===429);
 t.mock.timers.tick(86400001);const replacement=(await create(f)).request;
 assert.notEqual(replacement.version,r.version);
 await assert.rejects(mutateTrainerBooking(f.db,'t','bookingAccept',decision(r)),e=>e.status===409);
 assert.equal(f.records.get('trainerBookings/'+r.id).status,'pending');
 await mutateTrainerBooking(f.db,'t','bookingAccept',decision(replacement));
 }
});
test('services preserve verification and snapshots while invalid prices and stale price fail',async()=>{
 const f=setup();const {request:r}=await create(f);
 await saveTrainerServices(f.db,'t',{hourlyRate:2000,serviceDescription:'Новая цена'});
 assert.equal(f.records.get('users/t').personalTrainer.status,'verified');
 assert.equal(publicTrainer(f.records.get('users/t')).hourlyRate,2000);
 assert.equal(f.records.get('trainerBookings/'+r.id).hourlyRate,1500);
 await mutateTrainerBooking(f.db,'t','bookingAccept',decision(r));
 await assert.rejects(mutateTrainerBooking(f.db,'x','bookingCreate',input),e=>e.status===409);
 for(const hourlyRate of [0,-1,NaN,Infinity,1.5,'1500',1000001])assert.throws(()=>trainerServices({hourlyRate}));
 await assert.rejects(saveTrainerServices(f.db,'c',{hourlyRate:100}),e=>e.status===409);
 await mutateTrainer(f.db,'t','trainerSave',{enabled:true,sports:['Теннис']});
 assert.equal(f.records.get('users/t').personalTrainer.hourlyRate,2000);
 assert.equal(f.records.get('users/t').personalTrainer.status,'declared');
});
test('no booking for self, unverified, missing price, blocked, suspended or unsupported discipline',async()=>{
 const f=setup();await assert.rejects(mutateTrainerBooking(f.db,'t','bookingCreate',input));
 await assert.rejects(mutateTrainerBooking(f.db,'c','bookingCreate',{...input,sport:'Теннис'}));
 await assert.rejects(mutateTrainerBooking(f.db,'c','bookingCreate',{...input,preferredTime:''}));
 for(const patch of [{isSuspended:true},{blockedUserIds:['c']},{personalTrainer:{...trainer().personalTrainer,status:'pending'}},{personalTrainer:{...trainer().personalTrainer,hourlyRate:0}}]){
 f.records.set('users/t',{...trainer(),...patch});await assert.rejects(create(f));
 }
 f.records.set('users/t',trainer());f.records.set('users/c',{...premium(),blockedUserIds:['t']});await assert.rejects(create(f));
});
test('blocked or suspended users stay blocked in approved chats',async()=>{
 const f=setup();const {request:r}=await create(f);await mutateTrainerBooking(f.db,'t','bookingAccept',decision(r));
 f.records.set('users/t',{...trainer(),blockedUserIds:['c']});assert.equal((await chat(f,'c')).statusCode,403);
 assert.equal((await chat(f,'c',{operation:'typing',active:true})).statusCode,403);
 f.records.set('users/t',{...trainer(),isSuspended:true});assert.equal((await chat(f,'c')).statusCode,403);
});
test('trainer qualification change or client suspension before approval prevents chat creation',async()=>{
 const f=setup();const {request:r}=await create(f);
 f.records.set('users/t',{...trainer(),personalTrainer:{...trainer().personalTrainer,sports:['Теннис']}});
 await assert.rejects(mutateTrainerBooking(f.db,'t','bookingAccept',decision(r)),e=>e.status===409);
 assert.equal(f.records.has('chats/'+chatId),false);
 f.records.set('users/t',trainer());f.records.set('users/c',{...premium(),isSuspended:true});
 await assert.rejects(mutateTrainerBooking(f.db,'t','bookingAccept',decision(r)),e=>e.status===403);
});
test('existing chat history is preserved on trainer approval',async()=>{
 const f=setup();f.records.set('chats/'+chatId,{id:chatId,participantIds:['c','t'],messages:[{id:'old',text:'hello'}],messageCount:1,lastMessageAt:123});
 const {request:r}=await create(f);await mutateTrainerBooking(f.db,'t','bookingAccept',decision(r));
 assert.equal(f.records.get('chats/'+chatId).messages[0].id,'old');assert.equal(f.records.get('chats/'+chatId).lastMessageAt,123);
});

test('booking lists are scoped to authenticated client or trainer, never caller-supplied owner',async()=>{
 const f=setup();await create(f);
 assert.equal((await listTrainerBookings(f.db,'c',{role:'client',userId:'t'},'__name__')).requests.length,1);
 assert.equal((await listTrainerBookings(f.db,'t',{role:'trainer'},'__name__')).requests.length,1);
 for(const role of ['trainer','client'])assert.equal((await listTrainerBookings(f.db,'x',{role,userId:'t'},'__name__')).requests.length,0);
 await assert.rejects(listTrainerBookings(f.db,'x',{role:'all'},'__name__'));
});
