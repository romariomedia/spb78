import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundled = await build({entryPoints:['api/sportbuddy-mutation.js'],bundle:true,format:'esm',platform:'node',write:false,
  plugins:[{name:'fake-admin',setup(b){
    b.onResolve({filter:/^firebase-admin\//},args=>({path:args.path,namespace:'fake'}));
    b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:{
      'firebase-admin/app':'export const getApps=()=>[{}],cert=x=>x,initializeApp=()=>{};',
      'firebase-admin/auth':'export const getAuth=()=>({verifyIdToken:async()=>({uid:globalThis.__uid}),getUser:async uid=>({uid,metadata:{creationTime:new Date().toISOString()}})});',
      'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__mutationDb; export const Timestamp={fromDate:date=>date.toISOString()};'
    }[args.path],loader:'js'}));
  }}]});
const {default:handler}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text+'\n//# sourceURL=mutation-test-fixture.js').toString('base64')}`);
function fixture(initial) {
  const records=new Map(Object.entries(initial));
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
      where:(field,op,value)=>query([...filters,[field,op,value]]),limit:()=>query(filters),
      async get(){const docs=[...records.keys()].filter(path=>path.startsWith(name+'/')).filter(path=>filters.every(([field,op,value])=>op==='=='?records.get(path)[field]===value:records.get(path)[field]?.includes(value))).map(path=>snap(db.collection(name).doc(path.slice(name.length+1))));return {docs,empty:docs.length===0};}
    });
    return {...query(),doc(id){const ref={id,path:name+'/'+id};ref.get=async()=>snap(ref);ref.create=async value=>write('create',ref,value);ref.set=async(value,options)=>write('set',ref,value,options?.merge);return ref;}};
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
test('welcome bootstrap gives 30 days once',async()=>{
  const f=fixture({});const first=await f.request('a',{action:'bootstrapProfile',profile:{name:'Athlete'}});
  assert.equal(first.statusCode,200);const expiry=first.body.profile.premiumUntil;
  assert.equal((await f.request('a',{action:'bootstrapProfile',profile:{name:'Other'}})).body.profile.premiumUntil,expiry);
  assert.equal(f.records.get('users/a').name,'Athlete');
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
