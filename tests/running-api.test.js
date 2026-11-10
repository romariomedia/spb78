import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resultId} from '../server/running-results.js';
const bundled=await build({entryPoints:['api/running.js'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake-admin',setup(b){
 b.onResolve({filter:/^firebase-admin\//},args=>({path:args.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:{
 'firebase-admin/app':'export const getApps=()=>[{}],cert=x=>x,initializeApp=()=>{};',
 'firebase-admin/auth':'export const getAuth=()=>({verifyIdToken:async()=>({uid:"alice"})});',
 'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__runningDb;'
 }[args.path],loader:'js'}));
}}]});
const {default:handler}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
function fixture(profile={name:'Alice'}){
 const records=new Map([['users/alice',profile]]),filters=[];
 const snap=ref=>({exists:records.has(ref.path),data:()=>records.get(ref.path),ref});
 const db={collection(name){
  const query={where:(...f)=>{filters.push([name,...f]);return query;},orderBy:()=>query,limit:()=>query,get:async()=>({docs:[]})};
  return {...query,doc(id){const ref={path:`${name}/${id}`,get:async()=>snap(ref)};return ref;}};
 },runTransaction:async fn=>fn({get:async ref=>snap(ref),create:(ref,v)=>records.set(ref.path,v),delete:ref=>records.delete(ref.path)})};
 globalThis.__runningDb=db;
 return {records,filters};
}
async function request(body,authorization='Bearer test'){
 const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
 await handler({method:'POST',headers:{authorization},body},res);return res;
}
test('running API requires authentication and active profile; history is scoped to authenticated UID',async()=>{
 fixture();assert.equal((await request({action:'history'},'')).statusCode,401);
 fixture({isSuspended:true});assert.equal((await request({action:'history'})).statusCode,403);
 const f=fixture();assert.equal((await request({action:'history',userId:'bob'})).statusCode,200);
 assert.deepEqual(f.filters[0],['runningResults','userId','==','alice']);
});
test('running API saves computed private summaries idempotently, never retains GPS, and isolates deletion',async()=>{
 const f=fixture(),startedAt=Date.now()-110000;
 const run={id:'run_12345678',startedAt,endedAt:startedAt+100000,userId:'bob',distanceM:999999,points:Array.from({length:21},(_,i)=>({lat:60+i*.00009,lng:30,accuracy:5,segment:0,timestamp:startedAt+i*5000}))};
 const r=await request({action:'save',run});assert.equal(r.statusCode,200);assert.equal(r.body.run.userId,'alice');assert.ok(r.body.run.distanceM<210);assert.equal('points' in r.body.run,false);
 const retry=await request({action:'save',run});assert.equal(retry.statusCode,200);assert.equal(f.records.size,2);
 assert.equal((await request({action:'save',run:{...run,endedAt:run.endedAt+1000}})).statusCode,409);
 const other=`runningResults/${resultId('bob',run.id)}`;f.records.set(other,{id:run.id,userId:'bob'});
 await request({action:'delete',id:run.id,userId:'bob'});assert.ok(f.records.has(other));assert.ok(!f.records.has(`runningResults/${resultId('alice',run.id)}`));
});
test('rankings stay closed for unverified geometry regardless of requested override',async()=>{
 fixture();const r=await request({action:'leaders',routeId:'alexandriysky',verified:true});assert.equal(r.statusCode,200);assert.equal(r.body.available,false);assert.deepEqual(r.body.leaders,[]);
});
