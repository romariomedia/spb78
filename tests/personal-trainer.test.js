import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {trainerInput,trainerEvidence,mutateTrainer,publicTrainer} from '../server/personal-trainer.js';
import {claimFingerprint,claimFromPassport,verificationRequestId,verificationClaimId} from '../server/sport-id-verification.js';
import {publicProfile} from '../server/public-profile.js';
import {rankingRow} from '../server/leaderboard.js';
import {affectsPublicProfiles} from '../server/public-profile-cache.js';
const claim={claimType:'trainer',claimId:'trainer'},rid=verificationRequestId('u',claim),cid=verificationClaimId('u',claim);
const evidence={evidenceUrls:['https://res.cloudinary.com/test/image/upload/certificate.jpg'],note:'Курс тренера по бегу, Спортивная академия, 2025'};
async function load(file){
 const result=await build({entryPoints:[file],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake-admin',setup(b){
 b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;','firebase-admin/firestore':'export const getFirestore=()=>globalThis.__trainerDb;export const FieldPath={documentId:()=>"__name__"};','firebase-admin/auth':'export const getAuth=()=>({verifyIdToken:async()=>({uid:"u"})});'}[a.path],loader:'js'}));
 }}]});return (await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))).default;
}
const admin=await load('api/admin-sport-id-verification.js'),athlete=await load('api/sport-id-verification.js');
function fixture(){
 const rows=new Map([['users/u',{name:'Тренер',sports:['Бег'],totalDailyMedals:14,totalWorkouts:7}],['adminSessions/live',{email:'admin',expiresAt:{toMillis:()=>Date.now()+60000}}]]);
 const faults={audit:false,before:null};
 const snap=path=>({id:path.split('/').at(-1),exists:rows.has(path),data:()=>structuredClone(rows.get(path))});
 const ref=path=>({id:path.split('/').at(-1),path,get:async()=>path.startsWith('adminSessions')?{exists:true,data:()=>rows.get(path)}:snap(path)});
 const db={doc:ref,collection(n){let after='',limit=100,expected;return {doc:id=>ref(n+'/'+id),where(_field,_op,value){expected=value;return this;},orderBy(){return this;},startAfter(value){after=value;return this;},limit(value){limit=value;return this;},async get(){return {docs:[...rows.keys()].filter(k=>k.startsWith(n+'/')).map(snap).filter(d=>d.id>after&&(expected===undefined||d.data().personalTrainer?.status===expected)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,limit)};}};},async runTransaction(fn){faults.before?.();let written=false;const pending=[];const tx={get:async r=>{assert.equal(written,false,'All reads must precede writes');return snap(r.path);},set(r,v){written=true;if(faults.audit&&r.path.startsWith('adminAuditLogs'))throw Error('Audit unavailable');pending.push(()=>rows.set(r.path,structuredClone(v)));},update(r,v){written=true;pending.push(()=>rows.set(r.path,{...rows.get(r.path),...structuredClone(v)}));},delete(r){written=true;pending.push(()=>rows.delete(r.path));}};const result=await fn(tx);pending.forEach(fn=>fn());return result;}};
 globalThis.__trainerDb=db;
 return {db,rows,faults,trainer:()=>rows.get('users/u').personalTrainer,request:()=>rows.get('sportVerificationRequests/'+rid),async admin(operation,note='Проверено',expectedVersion=rows.get('sportVerificationRequests/'+rid)?.requestVersion||''){globalThis.__trainerDb=db;const res={code:200,status(v){this.code=v;return this},json(v){this.body=v;return this}};await admin({method:'POST',body:{sessionId:'live',requestId:rid,operation,note,expectedVersion}},res);return res;},async athlete(body){globalThis.__trainerDb=db;const res={code:200,status(v){this.code=v;return this},json(v){this.body=v;return this}};await athlete({method:'POST',headers:{authorization:'Bearer test'},body},res);return res;}};
}
async function pending(f){await mutateTrainer(f.db,'u','trainerSave',{enabled:true,sports:['Бег'],status:'verified'});return mutateTrainer(f.db,'u','trainerSubmit',evidence);}
test('trainer disciplines validate against shared catalog; status cannot be self-issued',()=>{
 assert.deepEqual(trainerInput({enabled:true,sports:['Бег','Бег'],status:'verified'}),{enabled:true,sports:['Бег']});
 for(const body of [{enabled:true,sports:[]},{enabled:'true',sports:['Бег']},{enabled:true,sports:['Unknown']}])assert.throws(()=>trainerInput(body));
 assert.deepEqual(trainerInput({enabled:false,sports:['Бег']}),{enabled:false,sports:[]});
});
test('trainer qualification requires real document links, maximum five, and education description',()=>{
 assert.equal(trainerEvidence(evidence).evidenceUrls.length,1);
 for(const body of [{...evidence,evidenceUrls:[]},{...evidence,evidenceUrls:Array(6).fill(evidence.evidenceUrls[0])},{...evidence,evidenceUrls:['https://evil.example/doc']},{...evidence,note:''}])assert.throws(()=>trainerEvidence(body));
});
test('trainer request, approval and revocation update badge atomically, preserving athlete progress',async()=>{
 const f=fixture();await pending(f);assert.equal(f.trainer().status,'pending');assert.equal(publicTrainer(f.rows.get('users/u')),null);
 assert.equal((await f.admin('approve')).code,200);assert.equal(f.trainer().status,'verified');assert.equal(f.request().status,'approved');assert.ok(f.rows.has('sportVerifiedClaims/'+cid));
 assert.equal(rankingRow('u',f.rows.get('users/u')),null);
 const dto=publicProfile('u',f.rows.get('users/u'));assert.deepEqual(dto.personalTrainer.sports,['Бег']);assert.equal(JSON.stringify(dto).includes('certificate'),false);
 assert.equal((await f.admin('revoke','Документ требует проверки')).code,200);assert.equal(f.trainer().status,'revoked');assert.equal(publicTrainer(f.rows.get('users/u')),null);assert.ok(rankingRow('u',f.rows.get('users/u')));
 assert.equal(f.rows.get('users/u').totalWorkouts,7);assert.equal(f.rows.get('users/u').totalDailyMedals,14);
});
test('duplicate submission and decisions are rejected; rejected applicant can submit again',async()=>{
 const f=fixture();await pending(f);await assert.rejects(mutateTrainer(f.db,'u','trainerSubmit',evidence),e=>e.status===409);
 assert.equal((await f.admin('reject','Нужен диплом')).code,200);assert.equal(f.trainer().status,'rejected');assert.equal((await f.admin('approve')).code,409);
 await mutateTrainer(f.db,'u','trainerSubmit',evidence);assert.equal(f.request().reviewNote,'');assert.equal((await f.admin('approve')).code,200);
});
test('discipline edit invalidates pending and approved requests, same configuration retains verification',async()=>{
 const f=fixture();await pending(f);await f.admin('approve');await mutateTrainer(f.db,'u','trainerSave',{enabled:true,sports:['Бег']});assert.equal(f.trainer().status,'verified');
 await mutateTrainer(f.db,'u','trainerSave',{enabled:true,sports:['Теннис']});assert.equal(f.trainer().status,'declared');assert.equal(f.rows.has('sportVerifiedClaims/'+cid),false);assert.equal((await f.admin('approve')).code,409);
 await mutateTrainer(f.db,'u','trainerSubmit',evidence);await mutateTrainer(f.db,'u','trainerSave',{enabled:false,sports:['Теннис']});assert.equal(f.request().status,'cancelled');assert.equal((await f.admin('approve')).code,409);
});
test('cancelled application cannot be approved; generic API cannot bypass trainer validation',async()=>{
 const f=fixture();await pending(f);assert.equal((await f.athlete({action:'submit',claimType:'trainer',officialUrl:'https://example.org'})).code,400);
 assert.equal((await f.athlete({action:'cancel',requestId:rid})).code,400);
 await mutateTrainer(f.db,'u','trainerCancel');assert.equal((await f.admin('approve')).code,409);assert.equal(f.trainer().status,'declared');
});
test('transaction reads latest disciplines and prevents stale approval or suspended applicant approval',async()=>{
 const f=fixture();await pending(f);f.faults.before=()=>{const u=f.rows.get('users/u');f.rows.set('users/u',{...u,personalTrainer:{...u.personalTrainer,sports:['Теннис']}});};
 assert.equal((await f.admin('approve')).code,409);assert.equal(f.rows.has('sportVerifiedClaims/'+cid),false);
 f.faults.before=()=>{f.rows.set('users/u',{...f.rows.get('users/u'),isSuspended:true});};assert.equal((await f.admin('approve')).code,403);
});
test('audit failure leaves no partial trainer badge or decision',async()=>{
 const f=fixture();await pending(f);f.faults.audit=true;const log=console.error;console.error=()=>{};try{assert.equal((await f.admin('approve')).code,500);}finally{console.error=log;}assert.equal(f.trainer().status,'pending');assert.equal(f.request().status,'pending');assert.equal(f.rows.has('sportVerifiedClaims/'+cid),false);
});
test('trainer fingerprint includes every discipline; public projection excludes private metadata and suspended trainers',()=>{
 const make=sports=>claimFromPassport({},claim,{enabled:true,sports});
 assert.notEqual(claimFingerprint(make(['Бег'])),claimFingerprint(make(['Бег','Теннис'])));
 assert.equal(claimFingerprint(make(['Бег','Теннис'])),claimFingerprint(make(['Теннис','Бег'])));
 const user={personalTrainer:{enabled:true,status:'verified',sports:['Бег'],evidenceUrls:['secret'],note:'private'}};
 assert.equal(JSON.stringify(publicProfile('u',user)).includes('secret'),false);assert.equal(publicTrainer({...user,isSuspended:true}),null);assert.equal(publicTrainer({...user,isDemo:true}),null);
 assert.ok(affectsPublicProfiles('admin-sport-id-verification',{operation:'revoke'}));assert.ok(affectsPublicProfiles('sport-id-verification',{action:'trainerSave'}));assert.equal(affectsPublicProfiles('sport-id-verification',{action:'trainers'}),false);
});

test('trainer directory is paginated, excludes applicants and suspended accounts, and exposes no evidence',async()=>{
 const f=fixture();for(let i=0;i<26;i++)f.rows.set('users/t'+String(i).padStart(2,'0'),{name:'Trainer',personalTrainer:{enabled:true,status:'verified',sports:['Бег'],evidenceUrls:['secret']},isSuspended:i===0});
 f.rows.set('users/applicant',{personalTrainer:{enabled:true,status:'pending',sports:['Бег']}});
 const first=await f.athlete({action:'trainers'});assert.equal(first.code,200);assert.equal(first.body.trainers.length,23);assert.equal(first.body.nextCursor,'t23');assert.equal(JSON.stringify(first.body).includes('secret'),false);
 const next=await f.athlete({action:'trainers',cursor:first.body.nextCursor});assert.equal(next.body.trainers.length,2);assert.equal(next.body.nextCursor,null);
 assert.equal((await f.athlete({action:'trainers',cursor:'invalid/id'})).code,400);
});

test('stale admin decisions cannot approve, reject or revoke replacement documents',async()=>{
 const f=fixture();await pending(f);const oldVersion=f.request().requestVersion;
 await mutateTrainer(f.db,'u','trainerCancel');
 await mutateTrainer(f.db,'u','trainerSubmit',{...evidence,note:'Другой курс, новые документы'});
 assert.notEqual(f.request().requestVersion,oldVersion);
 for(const op of ['approve','reject'])assert.equal((await f.admin(op,'Старая карточка',oldVersion)).code,409);
 assert.equal(f.request().status,'pending');
 assert.equal((await f.admin('approve','Обновлённая карточка')).code,200);
 assert.equal((await f.admin('revoke','Старая карточка',oldVersion)).code,409);
 assert.equal(f.trainer().status,'verified');
});
