import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {distanceM,trackDistance,validateRun} from '../shared/running.js';
import {bestResult,publicResult,resultId,writeResult} from '../server/running-results.js';
const start=1_800_000_000_000;
const points=Array.from({length:21},(_,i)=>({lat:60+i*0.00009,lng:30,timestamp:start+i*5000,accuracy:5,segment:0}));
const run={startedAt:start,endedAt:start+100000,points};
const route={verified:true,path:points.map(({lat,lng})=>({lat,lng})),distanceM:200};
test('server computes elapsed time, distance and pace; ignores claimed totals',()=>{
 const r=validateRun({...run,distanceM:999999,elapsedMs:1},route,run.endedAt);
 assert.ok(r.distanceM>=199&&r.distanceM<=201);assert.equal(r.elapsedMs,100000);assert.equal(r.paceSecPerKm,500);assert.equal(r.eligible,true);
});
test('unverified locations can never generate a ranked result',()=>{
 assert.equal(validateRun(run,{...route,verified:false},run.endedAt).eligible,false);
 const routes=JSON.parse(readFileSync(new URL('../shared/running-routes.json',import.meta.url),'utf8'));
 for(const r of routes)assert.equal(r.verified,false);
});
test('pause time counts, distance across pause is excluded and rankings reject gaps',()=>{
 const paused=points.map((p,i)=>({...p,timestamp:p.timestamp+(i>=10?60000:0),segment:i>=10?1:0}));
 const r=validateRun({...run,endedAt:run.endedAt+60000,points:paused},route,run.endedAt+60000);
 assert.equal(r.elapsedMs,160000);assert.equal(r.eligible,false);assert.equal(r.hasGaps,true);assert.ok(r.distanceM<200);
});
test('reject malformed, reordered, inaccurate and future GPS inputs',()=>{
 for(const bad of [null,[],[...points].reverse(),points.map((p,i)=>i? p:{...p,lat:NaN}),points.map(p=>({...p,accuracy:100}))])assert.throws(()=>validateRun({...run,points:bad},route,run.endedAt));
 assert.throws(()=>validateRun({...run,endedAt:start+7*3600000},route,start+7*3600000));
 assert.throws(()=>validateRun(run,route,start));
});
test('shortcuts, reverse direction, GPS outages and teleportation cannot rank',()=>{
 const reverse=points.map((p,i)=>({...p,lat:points[points.length-1-i].lat}));
 assert.equal(validateRun({...run,points:reverse},route,run.endedAt).eligible,false);
 const shortcut=points.filter((_,i)=>i===0||i===20);
 assert.throws(()=>validateRun({...run,points:shortcut},route,run.endedAt),/короткая запись/);
 const jump=points.map((p,i)=>i===10?{...p,lng:31}:p);
 const result=validateRun({...run,points:jump},route,run.endedAt);
 assert.equal(result.eligible,false);assert.equal(result.hasSpeedJumps,true);assert.ok(result.distanceM<201);
 assert.ok(distanceM(points[0],points[20])>199);assert.equal(trackDistance([]),0);
});
test('public ranking has one fastest opted-in record and contains no raw track',()=>{
 const a={...run,id:'a',userId:'u',routeId:'r',routeVersion:1,elapsedMs:100000,eligible:true,published:true,endedAt:10};
 const best=bestResult([a,{...a,id:'b',elapsedMs:50000,published:false},{...a,id:'c',elapsedMs:60000,eligible:false},{...a,id:'d',elapsedMs:90000}]);
 assert.equal(best.id,'d');assert.equal('points' in publicResult(best),false);assert.equal('startedAt' in publicResult(best),false);
 assert.notEqual(resultId('alice','run_12345678'),resultId('bob','run_12345678'));
});
test('duplicate save returns the original and conflicts cannot overwrite a result',async()=>{
 let writes=0;const original={fingerprint:'a',id:'run_12345678'};
 const db={collection:()=>({doc:()=>({})}),runTransaction:fn=>fn({get:async()=>({exists:true,data:()=>original}),create:()=>writes++})};
 assert.equal(await writeResult(db,'u',{fingerprint:'a'},original.id),original);
 await assert.rejects(writeResult(db,'u',{fingerprint:'b'},original.id),/уже сохранена/);assert.equal(writes,0);
});
test('deleting the winning public run restores the next-best run in the same transaction',async()=>{
 const base={userId:'u',routeId:'r',routeVersion:1,routeKey:'r:v1',eligible:true,published:true,distanceM:200,paceSecPerKm:500};
 const a={...base,id:'run_aaaaaaaa',elapsedMs:100000,endedAt:10},b={...base,id:'run_bbbbbbbb',elapsedMs:110000,endedAt:20};
 const records=new Map([[`runningResults/${resultId('u',a.id)}`,a],[`runningResults/${resultId('u',b.id)}`,b]]);
 const db={collection(name){
  const query={where:()=>query,get:async()=>({docs:[...records.entries()].filter(([k])=>k.startsWith(name+'/')).map(([,v])=>({data:()=>v}))})};
  return {...query,doc:id=>({path:`${name}/${id}`})};
 },runTransaction:async fn=>{let wrote=false;return fn({get:async ref=>{assert.equal(wrote,false);return ref.path?{exists:records.has(ref.path),data:()=>records.get(ref.path)}:ref.get();},delete:ref=>{wrote=true;records.delete(ref.path);},set:(ref,v)=>{wrote=true;records.set(ref.path,v);}});}};
 await writeResult(db,'u',null,a.id,true);
 const best=records.get(`runningBest/${resultId('u','r:v1')}`);
 assert.equal(best.elapsedMs,b.elapsedMs);assert.equal('points' in best,false);assert.ok(!records.has(`runningResults/${resultId('u',a.id)}`));
 await writeResult(db,'u',null,b.id,true);assert.ok(!records.has(`runningBest/${resultId('u','r:v1')}`));
});
