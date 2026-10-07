import test from 'node:test';
// Baseline paid/free scenarios outside the explicitly dated open season.
test.beforeEach(t => t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-09-01T12:00:00Z')}));
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
  return {records,request};
}
const premium=()=>({name:'Athlete',premiumUntil:new Date(Date.now()+86400000).toISOString(),friendIds:[],friendRequestsSent:[],friendRequestsReceived:[],likedUserIds:[],matchIds:[]});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const training=()=>({title:'Теннис',sport:'Теннис',dateKey:today(),time:'18:00',lat:59.93,lng:30.31,participantsMax:2});

test('full training flow: create, join, check in, complete, rate without comment',async()=>{
  const f=fixture({'users/a':premium(),'users/b':premium()});
  const created=await f.request('a',{action:'training',operation:'createTraining',training:{...training(),isCompleted:true,checkedInUserIds:['intruder']}});
  assert.equal(created.statusCode,200);const id=created.body.training.id;
  assert.equal(created.body.training.isCompleted,false);assert.deepEqual(created.body.training.checkedInUserIds,[]);
  assert.equal((await f.request('b',{action:'training',operation:'toggleJoinTraining',trainingId:id})).body.joined,true);
  for(const uid of ['a','b'])assert.equal((await f.request(uid,{action:'checkin',trainingId:id,lat:59.93,lng:30.31})).statusCode,200);
  assert.equal((await f.request('a',{action:'completeTraining',trainingId:id})).statusCode,200);
  assert.equal((await f.request('b',{action:'rating',trainingId:id,targetUserId:'a',stars:5})).statusCode,200);
  assert.equal(f.records.get('users/a').rating,5);
  assert.equal((await f.request('b',{action:'rating',trainingId:id,targetUserId:'a',stars:5})).statusCode,409);
});
test('training requires Premium, valid coordinates and valid date',async()=>{
  const f=fixture({'users/a':premium(),'users/free':{}});
  assert.equal((await f.request('free',{action:'training',operation:'createTraining',training:training()})).statusCode,403);
  for(const extra of [{lat:100},{dateKey:'2026-02-31'},{time:'27:00'}])assert.equal((await f.request('a',{action:'training',operation:'createTraining',training:{...training(),...extra}})).statusCode,400);
});
test('capacity and completed training membership are protected',async()=>{
  const f=fixture({'users/a':premium(),'users/b':premium(),'trainings/t':{...training(),createdBy:'a',participantIds:['a','c']}});
  assert.equal((await f.request('b',{action:'training',operation:'toggleJoinTraining',trainingId:'t'})).statusCode,409);
  assert.equal((await f.request('a',{action:'training',operation:'toggleJoinTraining',trainingId:'t'})).statusCode,409);
  assert.equal((await f.request('b',{action:'training',operation:'unknown',trainingId:'t'})).statusCode,400);
});
test('friend request supports retry, cancellation and re-sending',async()=>{
  const f=fixture({'users/a':premium(),'users/b':premium()});
  for(let i=0;i<2;i++)assert.equal((await f.request('a',{action:'friend',operation:'send',targetUserId:'b'})).statusCode,200);
  assert.equal((await f.request('a',{action:'friend',operation:'cancel',targetUserId:'b'})).statusCode,200);
  assert.deepEqual(f.records.get('users/b').friendRequestsReceived,[]);
  assert.equal((await f.request('a',{action:'friend',operation:'send',targetUserId:'b'})).statusCode,200);
});
test('accepting then removing friendship cleans both users and both requests',async()=>{
  const f=fixture({'users/a':premium(),'users/b':premium()});
  await f.request('a',{action:'friend',operation:'send',targetUserId:'b'});
  assert.equal((await f.request('b',{action:'friend',operation:'accept',targetUserId:'a'})).statusCode,200);
  assert.equal((await f.request('a',{action:'friend',operation:'remove',targetUserId:'b'})).statusCode,200);
  assert.deepEqual(f.records.get('users/a').friendIds,[]);assert.deepEqual(f.records.get('users/b').friendIds,[]);
  assert.equal(f.records.has('friendRequests/a__b'),false);assert.equal(f.records.has('friendships/a__b'),false);
});
test('sixth free match is blocked for either participant',async()=>{
  for(const limited of ['a','b']) {
    const a={likedUserIds:[],matchIds:[]},b={likedUserIds:['a'],matchIds:[]};
    (limited==='a'?a:b).matchHistory=Array.from({length:5},(_,i)=>({userId:'u'+i,at:Date.now()}));
    const f=fixture({'users/a':a,'users/b':b});
    const result=await f.request('a',{action:'match',targetUserId:'b'});assert.equal(result.statusCode,409);assert.equal(result.body.code,'MATCH_LIMIT');
  }
});
test('profile save verifies second photo and returns server authority',async()=>{
  const f=fixture({'users/a':{...premium(),registeredAt:new Date().toISOString(),avatar:'https://example.com/avatar.jpg'},'usersPrivate/a':{email:'a@example.com'}});
  const result=await f.request('a',{action:'profile',updates:{photoPortfolio:['https://example.com/photo.jpg'],isVerified:false}});
  assert.equal(result.statusCode,200);assert.equal(result.body.profile.isVerified,true);assert.equal(f.records.get('users/a').isVerified,true);
});
test('email identity sync repairs leaked e-mail names and preserves valid names',async()=>{
  const authUsers={a:{email:'roman@example.com',displayName:'Роман Сайдашев'}};
  const broken=fixture({
    'users/a':{...premium(),name:'roman@example.com'},
    'usersPrivate/a':{email:'old@example.com'}
  },authUsers);
  const repaired=await broken.request('a',{action:'syncIdentity',candidateName:'roman'});
  assert.equal(repaired.statusCode,200);
  assert.equal(repaired.body.profile.name,'Роман Сайдашев');
  assert.equal(repaired.body.profile.email,'roman@example.com');
  assert.equal(broken.records.get('users/a').name,'Роман Сайдашев');
  assert.equal(broken.records.get('usersPrivate/a').email,'roman@example.com');

  const valid=fixture({
    'users/a':{...premium(),name:'Роман Настоящий'},
    'usersPrivate/a':{email:'roman@example.com'}
  },authUsers);
  const unchanged=await valid.request('a',{action:'syncIdentity',candidateName:'Другое Имя'});
  assert.equal(unchanged.statusCode,200);
  assert.equal(unchanged.body.profile.name,'Роман Настоящий');
  assert.equal(unchanged.body.repaired,false);
});

test('bootstrap never persists an e-mail address as the public athlete name',async()=>{
  const f=fixture({}, {a:{email:'roman@example.com',displayName:'Роман Сайдашев',creationTime:'2026-09-01T10:00:00.000Z'}});
  const result=await f.request('a',{action:'bootstrapProfile',profile:{name:'roman@example.com',email:'roman@example.com',gender:'male',genderSet:true}});
  assert.equal(result.statusCode,200);
  assert.equal(result.body.profile.name,'Роман Сайдашев');
  assert.equal(f.records.get('users/a').name,'Роман Сайдашев');
  assert.equal(f.records.get('usersPrivate/a').email,'roman@example.com');
});

test('welcome bootstrap gives 30 days once',async()=>{
  const f=fixture({});const first=await f.request('a',{action:'bootstrapProfile',profile:{name:'Alex Athlete'}});
  assert.equal(first.statusCode,200);const expiry=first.body.profile.premiumUntil;
  assert.equal((await f.request('a',{action:'bootstrapProfile',profile:{name:'Other'}})).body.profile.premiumUntil,expiry);
  assert.equal(f.records.get('users/a').name,'Alex Athlete');
});

test('chat requires active Premium and mutual relationship',async()=>{
  for(const mode of ['free','one-sided']) {
    const a={...premium(),friendIds:['b']},b={...premium(),friendIds:mode==='one-sided'?[]:['a']};
    if(mode==='free')a.premiumUntil='2020-01-01';
    const f=fixture({'users/a':a,'users/b':b});
    assert.equal((await f.request('a',{action:'chat',chatId:'chat_a__b',companionId:'b',text:'Hi'})).statusCode,403);
  }
});
test('chat message starts unread and read markers belong to participants',async()=>{
  const f=fixture({'users/a':{...premium(),friendIds:['b']},'users/b':{...premium(),friendIds:['a']}});
  const message=await f.request('a',{action:'chat',chatId:'chat_a__b',companionId:'b',text:'Hi'});
  assert.equal(message.statusCode,200);assert.equal(message.body.message.read,false);
  const time=message.body.message.timestamp;
  assert.equal((await f.request('outsider',{action:'chat',operation:'read',chatId:'chat_a__b',throughTimestamp:time})).statusCode,403);
  assert.equal((await f.request('b',{action:'chat',operation:'read',chatId:'chat_a__b',throughTimestamp:time})).body.readAt,time);
  assert.equal(f.records.get('chats/chat_a__b').readAt.b,time);
  assert.equal((await f.request('a',{action:'chat',chatId:'arbitrary',companionId:'b',text:'Hi'})).statusCode,400);
});
test('chat v3 supports reply typing and sender-only delete while retaining moderation evidence',async()=>{
  const f=fixture({'users/a':{...premium(),friendIds:['b']},'users/b':{...premium(),friendIds:['a']}});
  const first=await f.request('a',{action:'chat',chatId:'chat_a__b',companionId:'b',text:'Исходный текст'});
  assert.equal(first.statusCode,200);
  const firstId=first.body.message.id;

  const typing=await f.request('b',{action:'chat',operation:'typing',chatId:'chat_a__b',active:true});
  assert.equal(typing.statusCode,200);
  assert.ok(typing.body.typingAt>0);
  assert.equal(f.records.get('chats/chat_a__b').typingAt.b,typing.body.typingAt);

  const reply=await f.request('b',{action:'chat',chatId:'chat_a__b',companionId:'a',text:'Ответ',replyToMessageId:firstId});
  assert.equal(reply.statusCode,200);
  assert.equal(reply.body.message.replyTo.messageId,firstId);
  assert.equal(reply.body.message.replyTo.text,'Исходный текст');
  assert.equal(reply.body.thread.typingAt.b,0);

  assert.equal((await f.request('b',{action:'chat',operation:'deleteMessage',chatId:'chat_a__b',messageId:firstId})).statusCode,403);
  const deleted=await f.request('a',{action:'chat',operation:'deleteMessage',chatId:'chat_a__b',messageId:firstId});
  assert.equal(deleted.statusCode,200);
  assert.equal(deleted.body.message.text,'Сообщение удалено');
  const stored=f.records.get('chats/chat_a__b/messages/'+firstId);
  assert.equal(stored.text,'Сообщение удалено');
  assert.equal(stored.moderationText,'Исходный текст');
  assert.equal(f.records.get('chats/chat_a__b').recentMessages.find(m=>m.id===firstId).text,'Сообщение удалено');

  const late=fixture({'users/a':{...premium(),friendIds:['b']},'users/b':{...premium(),friendIds:['a']},
    'chats/chat_a__b':{id:'chat_a__b',participantIds:['a','b'],messages:[{id:'old',chatId:'chat_a__b',senderId:'a',text:'old',timestamp:Date.now()-16*60*1000}],recentMessages:[{id:'old',chatId:'chat_a__b',senderId:'a',text:'old',timestamp:Date.now()-16*60*1000}],lastMessageAt:Date.now()-16*60*1000}});
  assert.equal((await late.request('a',{action:'chat',operation:'deleteMessage',chatId:'chat_a__b',messageId:'old'})).statusCode,409);
});

test('training group chat follows training membership and archives on completion',async()=>{
  const f=fixture({'users/a':premium(),'users/b':premium(),'users/c':premium()});
  const created=await f.request('a',{action:'training',operation:'createTraining',training:{...training(),participantsMax:4}});
  assert.equal(created.statusCode,200);
  const trainingId=created.body.training.id;
  const chatId='training_'+trainingId;
  let group=f.records.get('chats/'+chatId);
  assert.equal(group.kind,'training');
  assert.deepEqual(group.participantIds,['a']);
  assert.equal(group.trainingId,trainingId);

  assert.equal((await f.request('b',{action:'training',operation:'toggleJoinTraining',trainingId})).statusCode,200);
  group=f.records.get('chats/'+chatId);
  assert.deepEqual(group.participantIds,['a','b']);

  assert.equal((await f.request('c',{action:'chat',operation:'sendTraining',chatId,text:'Я тут'})).statusCode,403);
  const sent=await f.request('b',{action:'chat',operation:'sendTraining',chatId,text:'Всем привет'});
  assert.equal(sent.statusCode,200);
  assert.equal(sent.body.message.text,'Всем привет');
  assert.equal(f.records.get('chats/'+chatId).unreadCount.a,1);
  assert.equal(f.records.get('chats/'+chatId).unreadCount.b,0);

  const jobs=[...f.records].filter(([key])=>key.startsWith('notificationOutbox/')).map(([,value])=>value);
  const groupNotice=jobs.find(item=>item.kind==='message');
  assert.ok(groupNotice);
  assert.deepEqual(groupNotice.recipients,['a']);
  assert.equal(groupNotice.link,'#chat='+encodeURIComponent(chatId));

  assert.equal((await f.request('b',{action:'training',operation:'toggleJoinTraining',trainingId})).body.joined,false);
  assert.deepEqual(f.records.get('chats/'+chatId).participantIds,['a']);
  assert.equal((await f.request('b',{action:'chat',operation:'history',chatId})).statusCode,403);

  // Rejoin and complete: final participants retain read-only archive access.
  await f.request('b',{action:'training',operation:'toggleJoinTraining',trainingId});
  f.records.set('trainings/'+trainingId,{...f.records.get('trainings/'+trainingId),dateKey:today(),checkedInUserIds:['a']});
  const completed=await f.request('a',{action:'completeTraining',trainingId});
  assert.equal(completed.statusCode,200);
  group=f.records.get('chats/'+chatId);
  assert.ok(group.archivedAt);
  assert.deepEqual(group.participantIds,['a','b']);
  assert.equal((await f.request('b',{action:'chat',operation:'history',chatId})).statusCode,200);
  const archivedSend=await f.request('b',{action:'chat',operation:'sendTraining',chatId,text:'После финиша'});
  assert.equal(archivedSend.statusCode,409);
  assert.equal(archivedSend.body.code,'CHAT_ARCHIVED');
});

test('legacy training can lazily create its group chat only for participants',async()=>{
  const f=fixture({
    'users/a':premium(),'users/b':premium(),
    'trainings/legacy':{...training(),id:'legacy',createdBy:'a',participantIds:['a']}
  });
  assert.equal((await f.request('b',{action:'training',operation:'ensureGroupChat',trainingId:'legacy'})).statusCode,403);
  const ensured=await f.request('a',{action:'training',operation:'ensureGroupChat',trainingId:'legacy'});
  assert.equal(ensured.statusCode,200);
  assert.equal(ensured.body.chatId,'training_legacy');
  assert.equal(f.records.get('chats/training_legacy').kind,'training');
});

test('event registration accepts only published events with space',async()=>{
  for(const status of ['draft','finished']) {
    const f=fixture({'users/a':premium(),'events/e':{status,participantIds:[],participantsMax:2}});
    assert.equal((await f.request('a',{action:'event',eventId:'e'})).statusCode,409);
  }
  const f=fixture({'users/a':premium(),'users/b':premium(),'events/e':{status:'published',participantIds:[],participantsMax:1}});
  assert.equal((await f.request('a',{action:'event',eventId:'e'})).body.registered,true);
  assert.equal((await f.request('b',{action:'event',eventId:'e'})).statusCode,409);
  assert.equal((await f.request('a',{action:'event',eventId:'e'})).body.registered,false);
});

test('training gender preference is validated and defaults to any', async () => {
  const f = fixture({'users/a':premium()});
  for (const participantGender of ['any','male','female']) {
    const result = await f.request('a',{action:'training',operation:'createTraining',training:{...training(),participantGender}});
    assert.equal(result.statusCode,200);
    assert.equal(f.records.get('trainings/'+result.body.training.id).participantGender,participantGender);
  }
  const legacy = await f.request('a',{action:'training',operation:'createTraining',training:training()});
  assert.equal(legacy.body.training.participantGender,'any');
  for (const participantGender of ['other',null,{},'']) {
    assert.equal((await f.request('a',{action:'training',operation:'createTraining',training:{...training(),participantGender}})).statusCode,400);
  }
});

test('restricted signup uses stored gender and ignores forged request gender', async () => {
  for (const participantGender of ['female','male']) {
    const opposite = participantGender === 'female' ? 'male' : 'female';
    const f = fixture({'users/a':premium(),'users/allowed':{gender:participantGender,genderSet:true},'users/denied':{gender:opposite,genderSet:true},'users/unset':{gender:participantGender,genderSet:false},'users/missingGender':{}});
    const created = await f.request('a',{action:'training',operation:'createTraining',training:{...training(),participantGender,participantsMax:10}});
    const trainingId = created.body.training.id;
    for (const uid of ['denied','unset','missingGender','missingProfile']) {
      const response = await f.request(uid,{action:'training',operation:'toggleJoinTraining',trainingId,gender:participantGender,participantGender:'any'});
      assert.equal(response.statusCode,403);
      assert.deepEqual(f.records.get('trainings/'+trainingId).participantIds,['a']);
    }
    assert.equal((await f.request('allowed',{action:'training',operation:'toggleJoinTraining',trainingId})).body.joined,true);
    f.records.set('users/allowed',{gender:opposite});
    assert.equal((await f.request('allowed',{action:'training',operation:'toggleJoinTraining',trainingId})).body.joined,false);
  }
});

test('legacy and any-gender trainings remain open to all', async () => {
  for (const preference of [{},{participantGender:'any'}]) {
    const f=fixture({'trainings/t':{...training(),...preference,createdBy:'a',participantIds:['a']},'users/b':{genderSet:false}});
    assert.equal((await f.request('b',{action:'training',operation:'toggleJoinTraining',trainingId:'t'})).body.joined,true);
  }
});

const medalProgress=(extra={})=>({tier:'bronze',cycleDays:0,cycleWorkouts:0,totals:{bronze:0,silver:0,gold:0},cyclesCompleted:{bronze:0,silver:0,gold:0},lastClaimDayKey:null,lastClaimTimestamp:null,hasWorkoutEver:false,...extra});
const daysAgo=n=>new Date(Date.parse(today()+'T00:00:00Z')-n*86400000).toISOString().slice(0,10);
test('daily medal retries are idempotent and ignore client reward values',async()=>{
  const f=fixture({'users/a':premium()});
  const first=await f.request('a',{action:'dailyMedal',tier:'gold',medals:999});
  assert.equal(first.body.rewardGiven,true);assert.equal(first.body.medals,1);assert.equal(first.body.tierEarned,'bronze');
  const repeat=await f.request('a',{action:'dailyMedal'});
  assert.equal(repeat.statusCode,200);assert.equal(repeat.body.rewardGiven,false);assert.equal(repeat.body.medals,1);
  assert.equal(f.records.get('users/a').medalProgress.lastClaimDayKey,today());
});
test('bronze cycle awards once and reports the earned tier before promotion',async()=>{
  const f=fixture({'users/a':{...premium(),totalWorkouts:1,medalProgress:medalProgress({cycleDays:6,lastClaimDayKey:daysAgo(1),totals:{bronze:6,silver:0,gold:0}})}});
  const r=await f.request('a',{action:'dailyMedal'});
  assert.equal(r.body.tierEarned,'bronze');assert.equal(r.body.progress.tier,'silver');assert.equal(r.body.promo.days,5);assert.equal(r.body.progress.cycleDays,0);
  await f.request('a',{action:'dailyMedal'});
  assert.equal([...f.records.keys()].filter(k=>k.startsWith('promoCodes/')).length,1);
});
test('silver requires workouts and gold grants the configured reward',async()=>{
  for(const tier of ['silver','gold']){
    const required=tier==='silver'?3:5;
    const f=fixture({'users/a':{...premium(),medalProgress:medalProgress({tier,cycleDays:6,cycleWorkouts:required-1,lastClaimDayKey:daysAgo(1)})}});
    const r=await f.request('a',{action:'dailyMedal'});assert.equal(r.body.promo,null);assert.equal(r.body.progress.cycleDays,7);
    f.records.set('users/a',{...premium(),medalProgress:medalProgress({tier,cycleDays:7,cycleWorkouts:required,lastClaimDayKey:daysAgo(1)})});
    const completed=await f.request('a',{action:'dailyMedal'});assert.equal(completed.body.promo.days,tier==='silver'?7:30);assert.equal(completed.body.progress.tier,'gold');
  }
});
test('missed day resets cycle but preserves rank, collection and today workout',async()=>{
  const f=fixture({'users/a':{...premium(),medalProgress:medalProgress({tier:'gold',cycleDays:5,cycleWorkouts:4,lastWorkoutDayKey:today(),lastClaimDayKey:daysAgo(2),totals:{bronze:7,silver:7,gold:5}})}});
  const r=await f.request('a',{action:'dailyMedal'});assert.equal(r.body.progress.tier,'gold');assert.equal(r.body.progress.cycleDays,1);assert.equal(r.body.progress.cycleWorkouts,1);assert.equal(r.body.medals,20);
});
test('reward inventory is scoped to authenticated owner',async()=>{
  const f=fixture({'promoCodes/a':{ownerId:'a',code:'A'},'promoCodes/b':{ownerId:'b',code:'B'}});
  const r=await f.request('a',{action:'myPromos',ownerId:'b'});assert.deepEqual(r.body.promos,[{ownerId:'a',code:'A'}]);
});

test('beta grants expired accounts training and chat access but blocks BOX without changing rewards',async t=>{
  t.mock.timers.setTime(Date.parse('2026-12-31T20:59:59Z'));
  const f=fixture({'users/a':{...premium(),premiumUntil:'2020-01-01',totalWorkouts:30,matchIds:['b']},'users/b':{...premium(),premiumUntil:'2020-01-01',matchIds:['a']}});
  assert.equal((await f.request('a',{action:'training',operation:'createTraining',training:training()})).statusCode,200);
  assert.equal((await f.request('a',{action:'chat',chatId:'chat_a__b',companionId:'b',text:'Hi'})).statusCode,200);
  const box=await f.request('a',{action:'openBox',tierIndex:0});
  assert.equal(box.statusCode,403);assert.equal(f.records.get('users/a').claimedBoxTiers,undefined);
  // A paid plan label alone no longer grants access after the deadline.
  t.mock.timers.setTime(Date.parse('2026-12-31T21:00:00Z'));
  assert.equal((await f.request('a',{action:'training',operation:'createTraining',training:training()})).statusCode,403);
});
test('beta removes match quota and restores it at the deadline',async t=>{
  for(const now of ['2026-12-31T20:59:59Z','2026-12-31T21:00:00Z']) {
    t.mock.timers.setTime(Date.parse(now));
    const history=Array.from({length:5},(_,i)=>({userId:'u'+i,at:Date.now()}));
    const f=fixture({'users/a':{matchHistory:history},'users/b':{likedUserIds:['a'],matchHistory:history}});
    const r=await f.request('a',{action:'match',targetUserId:'b'});
    assert.equal(r.statusCode,now.endsWith('59Z')?200:409);
  }
});
test('banked promo is not consumed during beta and extends Premium after midnight',async t=>{
  const f=fixture({'users/a':{...premium(),premiumUntil:'2020-01-01'},'promoCodes/GIFT':{ownerId:'a',code:'GIFT',days:7,title:'Daily reward'}});
  t.mock.timers.setTime(Date.parse('2026-12-31T20:59:59Z'));
  assert.equal((await f.request('a',{action:'redeemPromo',code:'GIFT'})).statusCode,409);
  assert.equal(f.records.get('promoCodes/GIFT').usedAt,undefined);
  t.mock.timers.setTime(Date.parse('2026-12-31T21:00:00Z'));
  const redeemed=await f.request('a',{action:'redeemPromo',code:'GIFT'});
  assert.equal(redeemed.statusCode,200);assert.equal(redeemed.body.premiumUntil,'2027-01-07T21:00:00.000Z');
  assert.equal((await f.request('a',{action:'redeemPromo',code:'GIFT'})).statusCode,409);
  f.records.set('promoCodes/SECOND',{ownerId:'a',code:'SECOND',days:5,title:'Next reward'});
  const second=await f.request('a',{action:'redeemPromo',code:'SECOND'});
  assert.equal(second.body.premiumUntil,'2027-01-12T21:00:00.000Z');
  assert.equal((await f.request('a',{action:'training',operation:'createTraining',training:training()})).statusCode,200);
});
test('daily cycle keeps awarding stored codes during beta; BOX reopens for eligible Premium in January',async t=>{
  t.mock.timers.setTime(Date.parse('2026-12-30T12:00:00Z'));
  const f=fixture({'users/a':{...premium(),totalWorkouts:7,medalProgress:medalProgress({cycleDays:6,lastClaimDayKey:daysAgo(1)})}});
  const claimed=await f.request('a',{action:'dailyMedal'});
  assert.equal(claimed.body.promo.days,5);assert.equal(f.records.get('promoCodes/'+claimed.body.promo.code).usedAt,undefined);
  t.mock.timers.setTime(Date.parse('2026-12-31T21:00:00Z'));
  f.records.set('users/a',{...f.records.get('users/a'),premiumUntil:'2027-02-01'});
  assert.equal((await f.request('a',{action:'openBox',tierIndex:0})).statusCode,200);
});

test('chat and friend transactions enqueue notifications for the recipient, not the sender',async()=>{
  const f=fixture({'users/a':premium(),'users/b':premium()});
  await f.request('a',{action:'friend',operation:'send',targetUserId:'b'});
  await f.request('a',{action:'friend',operation:'send',targetUserId:'b'});
  let jobs=[...f.records].filter(([k])=>k.startsWith('notificationOutbox/')).map(([,v])=>v);
  assert.equal(jobs.length,1);assert.deepEqual(jobs[0].recipients,['b']);
  await f.request('b',{action:'friend',operation:'accept',targetUserId:'a'});
  await f.request('a',{action:'chat',chatId:'chat_a__b',companionId:'b',text:'Private text'});
  jobs=[...f.records].filter(([k])=>k.startsWith('notificationOutbox/')).map(([,v])=>v);
  assert.equal(jobs.length,3);assert.equal(jobs.find(j=>j.kind==='message').message.includes('Private text'),false);
  assert.deepEqual(jobs.find(j=>j.kind==='friend_accepted').recipients,['a']);
});

test('profile rejects broken coordinates and timestamps geolocation on the server', async()=>{
  const f=fixture({'users/a':premium()});
  for (const updates of [{lat:null,lng:30},{lat:91,lng:30},{lat:59},{lat:'59',lng:30}]) {
    assert.equal((await f.request('a',{action:'profile',updates})).statusCode,400);
  }
  assert.equal((await f.request('a',{action:'profile',updates:{lat:59.931234,lng:30.312345,lastGeoAt:1}})).statusCode,200);
  const stored=f.records.get('users/a');
  assert.equal(stored.lastGeoAt,Date.now());
  assert.equal(stored.hasUsedGeolocation,true);
  // Точные координаты не сохраняются: в профиль идёт ровно защищённая точка.
  const expected=protectedCoords(59.931234,30.312345,'a');
  assert.equal(stored.lat,expected.lat);
  assert.equal(stored.lng,expected.lng);
  assert.notEqual(stored.lat,59.931234);
  for (const value of [stored.lat,stored.lng]) {
    assert.ok((String(value).split('.')[1]||'').length<=3,`слишком точные координаты: ${value}`);
  }
});
test('check-in does not coerce missing location to zero', async()=>{
  const f=fixture({'users/a':premium(),'trainings/t':{...training(),lat:0,lng:0,createdBy:'a',participantIds:['a']}});
  assert.equal((await f.request('a',{action:'checkin',trainingId:'t',lat:null,lng:null})).statusCode,400);
});
test('check-in stores distance but never exact coordinates', async()=>{
  const f=fixture({'users/a':premium(),'trainings/t':{...training(),createdBy:'a',participantIds:['a']}});
  assert.equal((await f.request('a',{action:'checkin',trainingId:'t',lat:59.93,lng:30.31})).statusCode,200);
  const stored=[...f.records.entries()].find(([path])=>path.startsWith('checkins/'))?.[1];
  assert.ok(stored,'отметка должна быть записана');
  assert.equal('lat' in stored,false);
  assert.equal('lng' in stored,false);
  assert.equal(typeof stored.distanceMeters,'number');
});

test('friend requests atomically enqueue one named notification and acceptance retries are idempotent',async()=>{
  const f=fixture({'users/a':{...premium(),name:'Роман'},'users/b':{...premium(),name:'Анна'}});
  const outbox=()=>[...f.records].filter(([key])=>key.startsWith('notificationOutbox/')).map(([,value])=>value);
  await f.request('a',{action:'friend',operation:'send',targetUserId:'b'});
  await f.request('a',{action:'friend',operation:'send',targetUserId:'b'});
  assert.equal(outbox().length,1);
  assert.equal(outbox()[0].kind,'friend_request');assert.deepEqual(outbox()[0].recipients,['b']);
  assert.match(outbox()[0].message,/Роман/);assert.equal(outbox()[0].link,'#profile-friends');
  assert.equal(outbox()[0].requestVersion,f.records.get('friendRequests/a__b').requestVersion);
  for(let i=0;i<2;i++)assert.equal((await f.request('b',{action:'friend',operation:'accept',targetUserId:'a'})).statusCode,200);
  assert.equal(outbox().length,2);assert.equal(outbox()[1].kind,'friend_accepted');assert.deepEqual(outbox()[1].recipients,['a']);
  assert.deepEqual(f.records.get('users/a').friendIds,['b']);assert.deepEqual(f.records.get('users/b').friendIds,['a']);
  assert.deepEqual(f.records.get('users/a').friendRequestsSent,[]);assert.deepEqual(f.records.get('users/b').friendRequestsReceived,[]);
});
test('cancel and resend at the same timestamp produce distinct notification identities',async()=>{
  const f=fixture({'users/a':premium(),'users/b':premium()});
  await f.request('a',{action:'friend',operation:'send',targetUserId:'b'});
  const first=f.records.get('friendRequests/a__b').requestVersion;
  await f.request('a',{action:'friend',operation:'cancel',targetUserId:'b'});
  await f.request('a',{action:'friend',operation:'send',targetUserId:'b'});
  assert.notEqual(f.records.get('friendRequests/a__b').requestVersion,first);
  assert.equal([...f.records.keys()].filter(k=>k.startsWith('notificationOutbox/')).length,2);
});
test('crossed friend requests become one friendship; blocked users cannot send or accept',async()=>{
  const f=fixture({'users/a':premium(),'users/b':premium()});
  await f.request('a',{action:'friend',operation:'send',targetUserId:'b'});
  assert.equal((await f.request('b',{action:'friend',operation:'send',targetUserId:'a'})).statusCode,200);
  assert.deepEqual(f.records.get('users/a').friendIds,['b']);assert.deepEqual(f.records.get('users/b').friendIds,['a']);
  for(const blocked of ['a','b']){
    const x=fixture({'users/a':premium(),'users/b':premium()});
    x.records.get('users/'+blocked).blockedUserIds=[blocked==='a'?'b':'a'];
    assert.equal((await x.request('a',{action:'friend',operation:'send',targetUserId:'b'})).statusCode,403);
    assert.equal(x.records.has('friendRequests/a__b'),false);
  }
});

test('friend Premium policy is enforced on server and respects the open beta period',async t=>{
  const f=fixture({'users/a':{},'users/b':{}});
  assert.equal((await f.request('a',{action:'friend',operation:'send',targetUserId:'b'})).statusCode,403);
  t.mock.timers.setTime(Date.parse('2026-10-05T12:00:00Z'));
  assert.equal((await f.request('a',{action:'friend',operation:'send',targetUserId:'b'})).statusCode,200);
  t.mock.timers.setTime(Date.parse('2027-01-01T00:00:00Z'));
  assert.equal((await f.request('b',{action:'friend',operation:'accept',targetUserId:'a'})).statusCode,403);
  assert.equal((await f.request('a',{action:'friend',operation:'cancel',targetUserId:'b'})).statusCode,200);
});

test('profile district is validated, preserved by unrelated updates and can be cleared', async()=>{
  const f=fixture({'users/a':{...premium(),locationName:'Старое описание',lat:59.93,lng:30.31}});
  let r=await f.request('a',{action:'profile',updates:{districtId:'lo-vyborgsky'}});
  assert.equal(r.statusCode,200);
  assert.equal(r.body.profile.districtId,'lo-vyborgsky');
  assert.equal(r.body.profile.locationName,'Старое описание');
  assert.equal(r.body.profile.lat,59.93);
  r=await f.request('a',{action:'profile',updates:{bio:'Бег'}});
  assert.equal(r.body.profile.districtId,'lo-vyborgsky');
  for(const value of ['Выборгский','unknown',42,{}]) {
    r=await f.request('a',{action:'profile',updates:{districtId:value}});
    assert.equal(r.statusCode,400);
    assert.equal(f.records.get('users/a').districtId,'lo-vyborgsky');
  }
  r=await f.request('a',{action:'profile',updates:{districtId:''}});
  assert.equal(r.statusCode,200);assert.equal(r.body.profile.districtId,'');
});

test('training district belongs to meeting place, rejects forged values and permits legacy clients',async()=>{
  const f=fixture({'users/a':{...premium(),districtId:'spb-vyborgsky'},'users/b':{...premium(),districtId:'lo-luzhsky'}});
  const r=await f.request('a',{action:'training',operation:'createTraining',training:{...training(),districtId:'lo-vyborgsky'}});
  assert.equal(r.statusCode,200);assert.equal(r.body.training.districtId,'lo-vyborgsky');
  const joined=await f.request('b',{action:'training',operation:'toggleJoinTraining',trainingId:r.body.training.id});
  assert.equal(joined.statusCode,200);
  for(const districtId of ['Выборгский',123,{}]) {
    const bad=await f.request('a',{action:'training',operation:'createTraining',training:{...training(),districtId}});
    assert.equal(bad.statusCode,400);
  }
  const legacy=await f.request('a',{action:'training',operation:'createTraining',training:training()});
  assert.equal(legacy.statusCode,200);assert.equal(legacy.body.training.districtId,'');
});
