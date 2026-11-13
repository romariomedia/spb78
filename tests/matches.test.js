import test from 'node:test';
import assert from 'node:assert/strict';
import {matchMutation} from '../server/match-service.js';
import {PUBLIC_DISSEMINATION_VERSION,consentedPublicProfile} from '../server/public-consent.js';
import {validateProfileInput} from '../server/profile-input.js';
const profile=gender=>({name:'Атлет',gender,activeLooking:true,avatar:'https://example.org/photo.jpg',likedUserIds:[],matchIds:[],publicDissemination:{active:true,version:PUBLIC_DISSEMINATION_VERSION,groups:['identity','profile']}});
function fixture(a={},b={},product={}){
 const records={'users/a':{...profile('male'),...a},'users/b':{...profile('female'),...b},'appConfig/main':{product}};
 const doc=path=>({path,get:async()=>({exists:!!records[path],data:()=>structuredClone(records[path])})});
 let queue=Promise.resolve();
 const db={collection:name=>({doc:id=>doc(name+'/'+id)}),runTransaction:callback=>{
   const task=queue.then(async()=>{const writes=[];const result=await callback({get:ref=>ref.get(),update:(ref,value)=>writes.push(()=>Object.assign(records[ref.path],value)),set:(ref,value)=>writes.push(()=>{records[ref.path]=value;})});writes.forEach(write=>write());return result;});queue=task.catch(()=>{});return task;
 }};
 return {db,records,user:id=>records['users/'+id],jobs:()=>Object.entries(records).filter(([key])=>key.startsWith('notificationOutbox/')).map(([,value])=>value)};
}
test('like is idempotent; only reciprocal likes create one match and two notifications',async()=>{
 const f=fixture();
 await Promise.all([matchMutation(f.db,'a','b'),matchMutation(f.db,'a','b')]);
 assert.deepEqual(f.user('a').likedUserIds,['b']);assert.deepEqual(f.user('a').matchIds,[]);assert.equal(f.jobs().length,0);
 const result=await matchMutation(f.db,'b','a');assert.equal(result.isNewMatch,true);
 assert.deepEqual(f.user('a').matchIds,['b']);assert.deepEqual(f.user('b').matchIds,['a']);assert.equal(f.jobs().length,2);
 assert.deepEqual(f.jobs().flatMap(j=>j.recipients).sort(),['a','b']);
 assert.equal((await matchMutation(f.db,'b','a')).isNewMatch,false);assert.equal(f.jobs().length,2);
});
test('blocks on either side, suspended target and hidden discovery consent reject without writes',async()=>{
 for(const [a,b] of [[{blockedUserIds:['b']},{}],[{},{blockedUserIds:['a']}],[{},{isSuspended:true}],[{},{activeLooking:false}],[{},{publicDissemination:{active:false}}],[{},{gender:'male'}],[{},{avatar:''}]]){
   const f=fixture(a,{likedUserIds:['a'],...b});await assert.rejects(matchMutation(f.db,'a','b'));assert.deepEqual(f.user('a').matchIds,[]);assert.equal(f.jobs().length,0);
 }
});
test('remove clears both likes and both matches, keeps quota history, invalidates queued alerts',async()=>{
 const f=fixture();await matchMutation(f.db,'a','b');await matchMutation(f.db,'b','a');const history=structuredClone(f.user('a').matchHistory);
 await matchMutation(f.db,'a','b','remove');await matchMutation(f.db,'a','b','remove');
 for(const id of ['a','b']){assert.deepEqual(f.user(id).matchIds,[]);assert.deepEqual(f.user(id).likedUserIds,[]);}
 assert.deepEqual(f.user('a').matchHistory,history);assert.equal(f.records['matchPairs/chat_a__b'].active,false);
 assert.equal((await matchMutation(f.db,'a','b')).isMatch,false);
 const oldVersion=f.jobs()[0].requestVersion;await matchMutation(f.db,'b','a');assert.notEqual(f.records['matchPairs/chat_a__b'].version,oldVersion);
});
test('legacy existing match does not produce a second celebration or notification',async()=>{
 const f=fixture({matchIds:['b']},{matchIds:['a'],likedUserIds:['a']});assert.equal((await matchMutation(f.db,'a','b')).isNewMatch,false);assert.equal(f.jobs().length,0);
});
test('quota is enforced for either participant and transaction leaves no partial like',async t=>{
 t.mock.method(Date,'now',()=>Date.parse('2027-02-01T12:00:00Z'));
 for(const side of ['a','b']){
  const full={matchHistory:Array.from({length:5},(_,i)=>({userId:'old'+i,at:Date.now()}))};
  const f=fixture(side==='a'?full:{},{likedUserIds:['a'],...(side==='b'?full:{})});
  await assert.rejects(matchMutation(f.db,'a','b'),e=>e.code==='MATCH_LIMIT');assert.deepEqual(f.user('a').likedUserIds,[]);assert.equal(f.jobs().length,0);
 }
});
test('invalid operation and ids rejected',async()=>{const f=fixture();for(const [target,op] of [['a','like'],['x/y','like'],['b','toggle']])await assert.rejects(matchMutation(f.db,'a',target,op),e=>e.status===400);});
test('training preferences are validated and only published under profile consent',()=>{
 assert.deepEqual(validateProfileInput({trainingLevel:'beginner',trainingTimes:['evening','evening']}),{trainingLevel:'beginner',trainingTimes:['evening']});
 for(const input of [{trainingLevel:'expert'},{trainingTimes:['midnight']},{trainingTimes:'morning'}])assert.throws(()=>validateProfileInput(input));
 const p={...profile('male'),trainingLevel:'amateur',trainingTimes:['morning']};assert.equal(consentedPublicProfile('a',p).trainingLevel,'amateur');
 p.publicDissemination.groups=['identity'];assert.equal(consentedPublicProfile('a',p).trainingLevel,undefined);
});
