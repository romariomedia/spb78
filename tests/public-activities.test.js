import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {publicActivity} from '../server/public-activities.js';
import {eventStart} from '../shared/event-time.js';
const bundle=await build({entryPoints:['api/activities-list.js'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'fake',setup(b){
 b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{
 'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
 'firebase-admin/auth':`export const getAuth=()=>({verifyIdToken:async(t,revoked)=>{if(t!=='valid'||!revoked)throw {code:'auth/invalid-token'};return {uid:'me'}}});`,
 'firebase-admin/firestore':`export const getFirestore=()=>globalThis.__activityDb;export const FieldPath={documentId:()=> '__name__'};`
 }[a.path],loader:'js'}));
}}]});
const handler=(await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))).default;
function fixture(rows,user={}){
 globalThis.__activityDb={collection(name){let cursor='',limit=0;return {doc:()=>({get:async()=>({exists:true,data:()=>user})}),orderBy(){return this},limit(n){limit=n;return this},startAfter(c){cursor=c;return this},async get(){assert.ok(['events','trainings'].includes(name));return {docs:Object.keys(rows).sort().filter(id=>id>cursor).slice(0,limit).map(id=>({id,data:()=>rows[id]}))}}}}};
 return async(body,token='valid')=>{const r={code:200,status(n){this.code=n;return this},json(v){this.body=v;return this},setHeader(){}};await handler({method:'POST',body,headers:{authorization:token?'Bearer '+token:''}},r);return r;};
}
test('private activity fields and unpublished records never reach public catalogs',()=>{
 for(const status of ['draft','finished',undefined])assert.equal(publicActivity('events','e',{status}),null);
 assert.equal(publicActivity('events','e',{status:'published',adminHidden:true}),null);
 assert.deepEqual(publicActivity('events','e',{id:'forged',status:'published',title:'Public',updatedBy:'private',futureSecret:'private'}),{id:'e',title:'Public',status:'published'});
 for(const officialStatus of ['draft','cancelled',undefined])assert.equal(publicActivity('trainings','t',{isOfficial:true,officialStatus}),null);
 assert.equal(publicActivity('trainings','t',{isHidden:true}),null);
 assert.deepEqual(publicActivity('trainings','t',{title:'Legacy',adminNote:'private'}),{id:'t',title:'Legacy'});
});
test('catalog pagination advances through hidden pages; auth and collection allowlist are enforced',async()=>{
 const rows=Object.fromEntries(Array.from({length:100},(_,i)=>['p'+String(i).padStart(3,'0'),{status:'draft'}]));rows.z={status:'published',title:'Public'};
 let request=fixture(rows),page=await request({kind:'events'});
 assert.deepEqual(page.body.items,[]);assert.equal(page.body.nextCursor,'p099');
 assert.equal((await request({kind:'events',cursor:'p099'})).body.items[0].id,'z');
 assert.equal((await request({kind:'usersPrivate'})).code,400);
 assert.equal((await request({kind:'events',cursor:'a/b'})).code,400);
 assert.equal((await request({kind:'events'},'')).code,401);
 request=fixture(rows,{isSuspended:true});assert.equal((await request({kind:'events'})).code,403);
});
test('event date validation rejects rollover and respects Moscow time',()=>{
 assert.ok(Number.isNaN(eventStart({dateKey:'2027-02-31',time:'12:00'})));
 assert.ok(Number.isNaN(eventStart({})));
 assert.equal(eventStart({dateKey:'2027-01-01',time:'00:00'}),Date.parse('2026-12-31T21:00:00Z'));
});
