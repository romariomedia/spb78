import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {cleanSettings,isQuiet,matchesTraining,mergeInbox} from '../server/notification-policy.js';
import {deliverNotification} from '../server/notification-worker.js';

function fixture(records={}) {
  const rows=new Map(Object.entries(records)),sends=[];
  const snap=ref=>({id:ref.id,ref,exists:rows.has(ref.path),data:()=>structuredClone(rows.get(ref.path))});
  const ref=(name,id)=>({id,path:name+'/'+id,async get(){return snap(this);},async delete(){rows.delete(this.path);}});
  const db={
    collection(name){return {
      doc:id=>ref(name,id),
      where:(field,_op,value)=>({limit:()=>({get:async()=>({docs:[...rows].filter(([k,v])=>k.startsWith(name+'/')&&v[field]===value).map(([k])=>snap(ref(name,k.slice(name.length+1))))})})})
    };},
    async runTransaction(fn){return fn({get:async r=>snap(r),set:(r,v,options)=>rows.set(r.path,{...(options?.merge?rows.get(r.path):{}),...structuredClone(v)}),update:(r,v)=>rows.set(r.path,{...rows.get(r.path),...structuredClone(v)}),delete:r=>rows.delete(r.path)});}
  };
  return {rows,db,sends,messaging:{send:async m=>{sends.push(m);}}};
}
const job=()=>({eventId:'event-1',category:'messages',kind:'message',actorId:'a',title:'Новое сообщение',message:'Вам написали в SportBuddy.',link:'#chat=test',createdAt:Date.now()});

test('notification preferences validate inputs and quiet hours cross Moscow midnight',()=>{
  assert.equal(cleanSettings({messages:'false',radiusKm:999}).messages,true);
  assert.equal(cleanSettings({radiusKm:999}).radiusKm,25);
  const p=cleanSettings({quiet:true});
  assert.equal(isQuiet(p,Date.parse('2026-10-01T20:00:00Z')),true);
  assert.equal(isQuiet(p,Date.parse('2026-10-02T04:59:59Z')),true);
  assert.equal(isQuiet(p,Date.parse('2026-10-02T05:00:00Z')),false);
});
test('new training recipients must match sport, gender, distance, date and capacity',t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-01T12:00:00Z')});
  const user={id:'b',gender:'female',genderSet:true,sports:['Бег'],lat:59.93,lng:30.31};
  const training={createdBy:'a',participantIds:['a'],participantsMax:2,participantGender:'female',sport:'Бег',lat:59.93,lng:30.31,dateKey:'2026-10-02',time:'10:00'};
  assert.equal(matchesTraining(user,training),true);
  for(const extra of [{gender:'male'},{genderSet:false},{sports:['Теннис']},{lat:55.75}])assert.equal(matchesTraining({...user,...extra},training),false);
  for(const extra of [{isCompleted:true},{participantIds:['a','c']},{dateKey:'2020-01-01'}])assert.equal(matchesTraining(user,{...training,...extra}),false);
});
test('inbox retention caps history and repeated delivery preserves read state',async()=>{
  const f=fixture({'users/b':{},'pushDevices/d':{uid:'b',token:'secret-token',updatedAt:Date.now()}}),j=job();
  await deliverNotification(f.db,f.messaging,j,'b');
  assert.equal(f.sends.length,1);assert.equal(f.sends[0].data.body,'Вам написали в SportBuddy.');
  const inbox=f.rows.get('notificationInboxes/b');inbox.entries[0].read=true;
  await deliverNotification(f.db,f.messaging,j,'b');
  assert.equal(f.sends.length,1);assert.equal(inbox.entries[0].read,true);
  const entries=Array.from({length:120},(_,i)=>({id:String(i),createdAt:Date.now()}));
  assert.equal(mergeInbox(entries,{id:'new',createdAt:Date.now()}).length,100);
  assert.equal(mergeInbox([{id:'expired',createdAt:0}],{id:'new',createdAt:Date.now()}).length,1);
});
test('quiet hours keep history without push; disabled category and blocked actor get neither',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-01T21:00:00Z')});
  const f=fixture({'users/b':{},'notificationSettings/b':{quiet:true},'pushDevices/d':{uid:'b',token:'token',updatedAt:Date.now()}});
  await deliverNotification(f.db,f.messaging,job(),'b');assert.equal(f.sends.length,0);assert.equal(f.rows.get('notificationInboxes/b').entries.length,1);
  for(const records of [{'users/b':{},'notificationSettings/b':{messages:false}},{'users/b':{blockedUserIds:['a']}}]){
    const x=fixture(records);await deliverNotification(x.db,x.messaging,job(),'b');assert.equal(x.rows.has('notificationInboxes/b'),false);
  }
});
test('provider failure leaves durable inbox retryable; invalid token is removed',async()=>{
  const f=fixture({'users/b':{},'pushDevices/d':{uid:'b',token:'token',updatedAt:Date.now()}}),j=job();
  await assert.rejects(deliverNotification(f.db,{send:async()=>{throw Object.assign(Error(),{code:'messaging/server-unavailable'});}},j,'b'));
  assert.equal(f.rows.get('notificationInboxes/b').entries[0].pushDone,false);
  await deliverNotification(f.db,{send:async()=>{throw Object.assign(Error(),{code:'messaging/registration-token-not-registered'});}},j,'b');
  assert.equal(f.rows.has('pushDevices/d'),false);assert.equal(f.rows.get('notificationInboxes/b').entries[0].pushDone,true);
});
test('service worker ignores pushes for a logged-out or different account',async()=>{
  const handlers={},shown=[];let identity='b';
  const self={addEventListener:(name,fn)=>handlers[name]=fn,clients:{matchAll:async()=>[]},registration:{showNotification:async(...args)=>shown.push(args)}};
  vm.runInNewContext(readFileSync('public/sw.js','utf8'),{self,URL,caches:{open:async()=>({match:async()=>({text:async()=>identity})})}});
  async function push(recipient){let work;handlers.push({data:{json:()=>({data:{recipient,eventId:'x',title:'Message',body:'New',link:'#chat=t'}})},waitUntil:p=>work=p});await work;}
  await push('a');assert.equal(shown.length,0);await push('b');assert.equal(shown.length,1);identity='';await push('b');assert.equal(shown.length,1);
});

// Exercise the public API boundary: identity comes only from the verified token.
const {build}=await import('esbuild');
const bundled=await build({entryPoints:['api/notifications.js'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'fake-admin',setup(b){
  b.onResolve({filter:/^firebase-admin\//},args=>({path:args.path,namespace:'fake'}));
  b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:{
    'firebase-admin/app':'export const getApps=()=>[{}],cert=x=>x,initializeApp=()=>{};',
    'firebase-admin/auth':'export const getAuth=()=>({verifyIdToken:async()=>({uid:globalThis.__notificationUid})});',
    'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__notificationDb;'
  }[args.path],loader:'js'}));
}}]});
const {default:notificationHandler}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
async function request(f,uid,body,authorized=true){
  globalThis.__notificationUid=uid;globalThis.__notificationDb=f.db;
  const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  await notificationHandler({method:'POST',headers:authorized?{authorization:'Bearer test'}:{},body},res);return res;
}
test('notification API rejects anonymous callers and ignores forged inbox owner',async()=>{
  const f=fixture({'notificationInboxes/a':{entries:[{id:'a1',read:false}]},'notificationInboxes/b':{entries:[{id:'b1',read:false}]}});
  assert.equal((await request(f,'a',{action:'read',ids:['a1']},false)).statusCode,401);
  assert.equal((await request(f,'a',{action:'read',ownerId:'b',ids:['b1']})).statusCode,200);
  assert.equal(f.rows.get('notificationInboxes/b').entries[0].read,false);
  await request(f,'a',{action:'read',ids:['a1']});assert.equal(f.rows.get('notificationInboxes/a').entries[0].read,true);
});
test('notification API cannot unregister another account device and rate limits self tests',async()=>{
  const {notificationId}=await import('../server/notification-policy.js');const token='a-device-token-long-enough';
  const f=fixture({['pushDevices/'+notificationId(token)]:{uid:'b',token}});
  await request(f,'a',{action:'unregister',token});assert.equal(f.rows.has('pushDevices/'+notificationId(token)),true);
  assert.equal((await request(f,'a',{action:'test',ownerId:'b'})).statusCode,200);
  const job=[...f.rows].find(([key])=>key.startsWith('notificationOutbox/'))[1];assert.deepEqual(job.recipients,['a']);
  assert.equal((await request(f,'a',{action:'test'})).statusCode,429);
});

test('friend request reaches inbox and FCM with the same destination exactly once',async()=>{
  const f=fixture({'users/b':{},'pushDevices/d':{uid:'b',token:'token',updatedAt:Date.now()},'friendRequests/a__b':{fromId:'a',toId:'b',status:'pending',requestVersion:'v1'}});
  const j={...job(),category:'friends',kind:'friend_request',entityId:'a__b',requestVersion:'v1',message:'Роман хочет добавить вас в друзья.',link:'#profile-friends'};
  await deliverNotification(f.db,f.messaging,j,'b');await deliverNotification(f.db,f.messaging,j,'b');
  assert.equal(f.rows.get('notificationInboxes/b').entries.length,1);
  assert.equal(f.sends.length,1);assert.equal(f.sends[0].data.link,'#profile-friends');assert.equal(f.sends[0].data.recipient,'b');
});
test('cancelled, accepted, deleted or superseded friend requests are not delivered',async()=>{
  for(const request of [undefined,{status:'declined',requestVersion:'v1'},{status:'accepted',requestVersion:'v1'},{status:'pending',requestVersion:'v2'}]){
    const f=fixture({'users/b':{},...(request?{'friendRequests/a__b':{fromId:'a',toId:'b',...request}}:{})});
    await deliverNotification(f.db,f.messaging,{...job(),category:'friends',kind:'friend_request',entityId:'a__b',requestVersion:'v1'},'b');
    assert.equal(f.rows.has('notificationInboxes/b'),false);assert.equal(f.sends.length,0);
  }
});
test('friend request remains available in inbox without a push token',async()=>{
  const f=fixture({'users/b':{},'friendRequests/a__b':{fromId:'a',toId:'b',status:'pending',requestVersion:'v1'}});
  await deliverNotification(f.db,f.messaging,{...job(),category:'friends',kind:'friend_request',entityId:'a__b',requestVersion:'v1'},'b');
  assert.equal(f.rows.get('notificationInboxes/b').entries[0].type,'friend_request');assert.equal(f.sends.length,0);
});
