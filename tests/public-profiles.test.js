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
