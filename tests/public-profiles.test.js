import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {publicProfile} from '../server/public-profile.js';
const bundled=await build({entryPoints:['api/public-profiles.js'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'fake-admin',setup(b){
 b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{
  'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
  'firebase-admin/auth':`export const getAuth=()=>({verifyIdToken:async(token,revoked)=>{if(token!=='valid'||revoked!==true)throw {code:'auth/invalid-token'};return {uid:'me'}}});`,
  'firebase-admin/firestore':`export const getFirestore=()=>globalThis.__publicDb;export const FieldPath={documentId:()=> '__name__'};`
 }[a.path],loader:'js'}));
}}]});
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
function fixture(users){
 globalThis.__publicDb={collection(name){assert.equal(name,'users');let cursor='',limit=0;return {
 doc(id){return {get:async()=>({exists:!!users[id],data:()=>users[id]})}},
 select(...fields){assert.ok(!fields.includes('rewardItems'));assert.ok(!fields.includes('email'));return this},
 orderBy(field){assert.equal(field,'__name__');return this},limit(n){limit=n;return this},startAfter(id){cursor=id;return this},
 async get(){return {docs:Object.keys(users).sort().filter(id=>id>cursor).slice(0,limit).map(id=>({id,data:()=>users[id]}))}}
 }}};
 return async (body={},token='valid',method='POST')=>{const r={status(n){this.code=n;return this},json(v){this.body=v;return this},setHeader(k,v){this[k]=v}};await handler({method,body,headers:{authorization:token?'Bearer '+token:''}},r);return r;};
}
test('public projection excludes social graph, rewards, contacts and unpublished Sport ID',()=>{
 const profile=publicProfile('a',{name:'Athlete',avatar:'https://example.com/a.jpg',age:30,friendIds:['b'],matchIds:['b'],likedUserIds:['c'],blockedUserIds:['d'],matchHistory:[{}],email:'secret@example.com',phone:'123',deviceId:'secret',birthDate:'1990-01-01',rewardItems:[{code:'SECRET'}],redeemedPromoCodes:['SECRET'],sportPassport:{publicEnabled:false,rankTitle:'Draft'},futureSecret:'secret'});
 assert.deepEqual(profile,{id:'a',name:'Athlete',avatar:'https://example.com/a.jpg',age:30});
});
test('public profiles require valid non-revoked authentication and reject suspended callers',async()=>{
 let request=fixture({me:{isSuspended:true}});
 assert.equal((await request()).code,403);
 request=fixture({});
 assert.equal((await request({},'')).code,401);assert.equal((await request({},'invalid')).code,401);
 assert.equal((await request({},'valid','GET')).code,405);
 assert.equal((await request({cursor:'a/b'})).code,400);
 assert.equal((await request()).code,200); // bootstrap can load its first page
});
test('pagination advances over hidden profiles without exposing private fields',async()=>{
 const users=Object.fromEntries(Array.from({length:201},(_,i)=>['u'+String(i).padStart(3,'0'),{name:'Athlete',email:'secret',isSuspended:i===0,isDemo:i===1}]));
 const request=fixture(users),first=await request();
 assert.equal(first.code,200);assert.equal(first['Cache-Control'],'private, no-store');
 assert.equal(first.body.profiles.length,198);assert.equal(first.body.nextCursor,'u199');
 assert.equal(JSON.stringify(first.body).includes('secret'),false);
 const second=await request({cursor:first.body.nextCursor});assert.equal(second.body.profiles.length,1);assert.equal(second.body.nextCursor,null);
});
test('cached public page never bypasses caller authentication or suspension',async()=>{
 const users={me:{name:'Me'},other:{name:'Other',email:'private@example.com'}};
 const request=fixture(users);
 assert.equal((await request()).code,200);
 assert.equal((await request({},'invalid')).code,401);
 users.me.isSuspended=true;
 assert.equal((await request()).code,403);
});

test('bounded pages have independent cache keys and old clients retain 200-item default',async()=>{
 const users=Object.fromEntries(Array.from({length:205},(_,i)=>['u'+String(i).padStart(3,'0'),{name:'Athlete'}]));
 const request=fixture(users);
 const small=await request({pageSize:40});
 assert.equal(small.body.profiles.length,40);assert.equal(small.body.nextCursor,'u039');
 assert.equal((await request()).body.profiles.length,200);
 assert.equal((await request({pageSize:40,cursor:'u039'})).body.profiles[0].id,'u040');
 for(const pageSize of [0,201,-1,1.5,'40',null]) {
   if(pageSize===null)continue; // null uses the legacy default
   assert.equal((await request({pageSize})).code,400);
 }
});

test('targeted identity lookup is bounded, deduplicated and projects only public visible users',async()=>{
 const users={me:{name:'Me'},alice:{name:'Alice',email:'secret'},hidden:{isSuspended:true},demo:{isDemo:true}};
 const request=fixture(users);
 const response=await request({ids:['alice','alice','hidden','demo','missing']});
 assert.equal(response.code,200);assert.deepEqual(response.body,{profiles:[{id:'alice',name:'Alice'}],nextCursor:null});
 for(const ids of ['alice',[null],['a/b'],Array(51).fill('alice')])assert.equal((await request({ids})).code,400);
 assert.equal((await request({ids:['alice'],cursor:'a'})).code,400);
 assert.equal((await request({ids:['alice']},'invalid')).code,401);
 users.me.isSuspended=true;
 assert.equal((await request({ids:['alice']})).code,403);
});


test('server ranking returns bounded pages, full totals and own rank outside first page',async()=>{
 const users=Object.fromEntries(Array.from({length:45},(_,i)=>['u'+String(i).padStart(3,'0'),{name:'User',totalWorkouts:100-i,totalDailyMedals:2,dailyMedalStreak:3,claimedBoxTiers:[7],email:'SECRET',rewardItems:[{code:'SECRET'}]}]));
 users.me={name:'Me',totalWorkouts:1};users.hidden={isSuspended:true,totalWorkouts:999};users.demo={isDemo:true,totalWorkouts:999};
 const request=fixture(users);
 const first=await request({action:'leaderboard',metric:'workouts'});
 assert.equal(first.code,200);assert.equal(first.body.entries.length,20);
 assert.equal(first.body.stats.athletes,46);assert.equal(first.body.stats.boxes,45);
 assert.equal(first.body.myEntry.rank,46);assert.equal(first.body.nextOffset,20);
 assert.equal(JSON.stringify(first.body).includes('SECRET'),false);
 const second=await request({action:'leaderboard',offset:20,version:first.body.version});
 assert.equal(second.body.entries[0].rank,21);assert.equal(second.body.version,first.body.version);
 assert.equal((await request({action:'leaderboard',offset:20,version:'expired'})).code,409);
 assert.equal((await request({action:'leaderboard'},'invalid')).code,401);
 users.me.isSuspended=true;
 assert.equal((await request({action:'leaderboard'})).code,403);
});

test('cold ranking scans more than 500 docs and rejects malformed pagination',async()=>{
 const request=fixture(Object.fromEntries(Array.from({length:505},(_,i)=>['u'+String(i).padStart(3,'0'),{totalWorkouts:1}])));
 assert.equal((await request({action:'leaderboard'})).body.stats.athletes,505);
 for(const body of [{metric:'email'},{offset:-1},{offset:1},{offset:1.2},{offset:'20'}])
   assert.equal((await request({action:'leaderboard',...body})).code,400);
});
