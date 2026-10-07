import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
async function load(entry){
 const bundle=await build({entryPoints:[entry],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake-firebase',setup(b){
  b.onResolve({filter:/^sharp$/},()=>({path:pathToFileURL(require.resolve('sharp')).href,external:true}));
  b.onResolve({filter:/^firebase-admin\//},args=>({path:args.path,namespace:'fake'}));
  b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:{
   'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
   'firebase-admin/auth':'export const getAuth=()=>({verifyIdToken:async token=>{if(!["alice","bob"].includes(token))throw Object.assign(new Error("Invalid token"),{code:"auth/invalid-id-token"});return {uid:token};}});',
   'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__verificationDb;'
  }[args.path],loader:'js'}));
 }}]});
 return (await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))).default;
}
const [userHandler,adminHandler]=await Promise.all([load('api/sport-id-verification.js'),load('api/admin-sport-id-verification.js')]);
function fixture(){
 const profile={name:'Athlete',sports:['Бег'],sportPassport:{mainSport:'Бег',rankTitle:'1 разряд',level:'competitive',declaredAchievements:[]}};
 const records=new Map([['users/alice',structuredClone(profile)],['users/bob',structuredClone(profile)],['adminSessions/valid',{email:'admin@example.com',expiresAt:{toMillis:()=>Date.now()+100000}}]]);
 let beforeTransaction=()=>{};
 const snap=ref=>({id:ref.id,ref,exists:records.has(ref.path),data:()=>records.get(ref.path)?{...records.get(ref.path)}:undefined});
 const ref=path=>({id:path.split('/').at(-1),path,get:async()=>snap(ref(path)),set:async value=>records.set(path,value),update:async value=>records.set(path,{...records.get(path),...value}),delete:async()=>records.delete(path)});
 const db={doc:ref,collection:name=>{let filters=[],cap=Infinity;return {doc:id=>ref(name+'/'+id),where(field,op,value){filters.push([field,op,value]);return this;},orderBy(){return this;},limit(n){cap=n;return this;},get:async()=>{const docs=[...records].filter(([key,value])=>key.startsWith(name+'/')&&filters.every(([field,,expected])=>value[field]===expected)).slice(0,cap).map(([key])=>snap(ref(key)));return {docs,empty:!docs.length};}};},runTransaction:async fn=>{beforeTransaction();const writes=[];const result=await fn({get:r=>r.get(),set:(r,value)=>writes.push(()=>r.set(value)),update:(r,value)=>writes.push(()=>r.update(value)),delete:r=>writes.push(()=>r.delete()),create:(r,value)=>writes.push(()=>r.set(value))});await Promise.all(writes.map(fn=>fn()));return result;}};
 globalThis.__verificationDb=db;return {records,setBefore:fn=>{beforeTransaction=fn;}};
}
async function call(handler,body,token='alice'){
 const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await handler({method:'POST',headers:{authorization:token?'Bearer '+token:''},body},res);return res;
}
test('upload, submission and download enforce owner and admin boundaries end to end',async t=>{
 const f=fixture(),dir=await mkdtemp(join(tmpdir(),'sb-evidence-api-'));
 const old=process.env.SB_PRIVATE_MEDIA_DIR;process.env.SB_PRIVATE_MEDIA_DIR=dir;
 t.after(async()=>{if(old===undefined)delete process.env.SB_PRIVATE_MEDIA_DIR;else process.env.SB_PRIVATE_MEDIA_DIR=old;await rm(dir,{recursive:true,force:true});});
 assert.equal((await call(userHandler,{action:'uploadEvidence'},'')).code,401);
 const upload=await call(userHandler,{action:'uploadEvidence',base64:Buffer.from('%PDF-1.7\nfixture').toString('base64')});
 assert.equal(upload.code,200);const evidenceId=upload.body.evidence.id;
 assert.equal((await call(userHandler,{action:'downloadEvidence',evidenceId},'bob')).code,404);
 assert.equal((await call(userHandler,{action:'submit',claimType:'rank',evidenceId},'bob')).code,404);
 const submission=await call(userHandler,{action:'submit',claimType:'rank',evidenceId});assert.equal(submission.code,200);
 const requestId=submission.body.request.id;
 assert.equal((await call(adminHandler,{operation:'downloadEvidence',requestId,sessionId:'invalid'})).code,401);
 const download=await call(adminHandler,{operation:'downloadEvidence',requestId,sessionId:'valid'});
 assert.equal(download.code,200);assert.equal(download.headers['Cache-Control'],'no-store');assert.ok(download.body.file.base64);
 const approval=await call(adminHandler,{operation:'approve',requestId,sessionId:'valid'});assert.equal(approval.code,200);
 assert.equal(f.records.get('sportVerificationRequests/'+requestId).status,'approved');
 assert.equal((await call(userHandler,{action:'cancel',requestId})).code,409);
});
test('concurrent biography change prevents approval of a stale claim',async()=>{
 const f=fixture();
 const submission=await call(userHandler,{action:'submit',claimType:'rank',officialUrl:'https://example.org/protocol'});
 const requestId=submission.body.request.id;
 f.setBefore(()=>{const user=f.records.get('users/alice');f.records.set('users/alice',{...user,sportPassport:{...user.sportPassport,rankTitle:'КМС'}});});
 const response=await call(adminHandler,{operation:'approve',requestId,sessionId:'valid'});
 assert.equal(response.code,409);
 assert.equal([...f.records.keys()].some(key=>key.startsWith('sportVerifiedClaims/')),false);
 assert.equal(f.records.get('sportVerificationRequests/'+requestId).status,'pending');
});
