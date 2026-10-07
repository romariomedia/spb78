import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['api/admin-analytics.js'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake-firebase',setup(b){
 b.onResolve({filter:/^firebase-admin\//},args=>({path:args.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:{
  'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
  'firebase-admin/auth':'export const getAuth=()=>({getUserByEmail:async()=>({uid:"admin"})});',
  'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__analyticsDb;'
 }[args.path],loader:'js'}));
}}]});
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const docs=rows=>({docs:rows.map(([id,value])=>({id,data:()=>value}))});
function setup(activityFailure=false){
 globalThis.__analyticsDb={doc:()=>({get:async()=>({exists:true,data:()=>({expiresAt:{toMillis:()=>Date.now()+100000}})})}),collection:name=>({where(){return this;},get:async()=>{
  if(name==='users')return docs([['returner',{registeredAt:'2026-09-29T10:00:00Z'}],['today-only',{registeredAt:'2026-09-29T11:00:00Z'}],['admin',{}]]);
  if(activityFailure)throw new Error('Unavailable');
  return docs([['yesterday',{userId:'returner',day:'2026-10-06',activeSeconds:60,sessions:1,firstSeenAt:Date.parse('2026-10-06T10:00Z')}],['today',{userId:'today-only',day:'2026-10-07',activeSeconds:60,sessions:1}]]);
 }})};
 return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
}
test('D7 uses the completed Moscow day, not partial activity today',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-07T07:00:00+03:00')});
 const res=setup();await handler({method:'POST',body:{sessionId:'valid'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.metrics.retentionDay,'2026-10-06');
 assert.equal(res.body.metrics.retentionD7,50);assert.equal(res.body.metrics.retentionCohort,2);
 assert.equal(res.body.metrics.dau,1);
});
test('activity storage failure is an error, never successful zero metrics',async t=>{
 t.mock.method(console,'error',()=>{});
 const res=setup(true);await handler({method:'POST',body:{sessionId:'valid'}},res);
 assert.equal(res.statusCode,500);assert.equal(res.body.metrics,undefined);
});
