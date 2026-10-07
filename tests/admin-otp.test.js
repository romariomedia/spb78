import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { ADMIN_EMAIL, reserveAdminOtp, consumeAdminOtp, discardFailedOtp } from '../server/admin-otp.js';

// Optimistic transactions: concurrent snapshots conflict and the callback retries.
// Commit preconditions are checked before any writes, including injected failure.
function fixture() {
  const rows=new Map(),versions=new Map();let conflicts=0,failSession=false;
  const clone=v=>v instanceof Timestamp?v:Array.isArray(v)?v.map(clone):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clone(x)])):v;
  const db={doc:path=>({path}),async runTransaction(fn){
    for(let retry=0;retry<100;retry++){
      const reads=new Map(),writes=[];
      const tx={get:async ref=>{
        assert.equal(writes.length,0,'All reads must precede writes');reads.set(ref.path,versions.get(ref.path)||0);
        const value=clone(rows.get(ref.path));return {exists:value!==undefined,data:()=>clone(value)};
      }};
      for(const kind of ['create','set','update','delete'])tx[kind]=(ref,value)=>writes.push({kind,path:ref.path,value:clone(value)});
      const result=await fn(tx);
      if([...reads].some(([p,v])=>(versions.get(p)||0)!==v)){conflicts++;continue;}
      for(const w of writes){
        if(w.kind==='create'&&rows.has(w.path))throw Error('already-exists');
        if(failSession&&w.path.startsWith('adminSessions/'))throw Error('storage unavailable');
      }
      for(const w of writes){
        if(w.kind==='delete')rows.delete(w.path);
        else rows.set(w.path,w.kind==='update'?{...rows.get(w.path),...w.value}:w.value);
        versions.set(w.path,(versions.get(w.path)||0)+1);
      }
      return result;
    }
    throw Error('Too much contention');
  }};
  return {db,rows,get conflicts(){return conflicts},set failSession(v){failSession=v}};
}
const now=Date.parse('2026-10-07T10:00:00Z');
const credentials={email:ADMIN_EMAIL,password:'correct-test-password',expectedPassword:'correct-test-password',pepper:'test-pepper-only'};
const verify=code=>({email:ADMIN_EMAIL,code,pepper:credentials.pepper});
const sessions=f=>[...f.rows.keys()].filter(p=>p.startsWith('adminSessions/'));

test('parallel invalid OTP attempts stop at five despite transaction retries',async()=>{
  const f=fixture(),challenge=await reserveAdminOtp(f.db,credentials,now);
  const wrong=String((Number(challenge.code)+1)%10000).padStart(4,'0');
  const results=await Promise.all(Array.from({length:12},()=>consumeAdminOtp(f.db,verify(wrong),now+1)));
  assert.equal(results.filter(r=>r.status===403).length,4);
  assert.equal(results.filter(r=>r.status===429).length,8);
  assert.equal(f.rows.get('adminOtpChallenges/'+challenge.key).attempts,5);
  assert.ok(f.conflicts>0);
  assert.equal((await consumeAdminOtp(f.db,verify(challenge.code),now+2)).status,429);
  assert.equal(sessions(f).length,0);
});
test('parallel valid OTP consumes challenge once and creates only one session',async()=>{
  const f=fixture(),challenge=await reserveAdminOtp(f.db,credentials,now);
  const results=await Promise.all(Array.from({length:8},()=>consumeAdminOtp(f.db,verify(challenge.code),now+1)));
  assert.equal(results.filter(r=>r.status===200).length,1);
  assert.equal(results.filter(r=>r.status===404).length,7);
  assert.equal(sessions(f).length,1);assert.ok(f.conflicts>0);
  assert.equal(f.rows.has('adminOtpChallenges/'+challenge.key),false);
});
test('session storage failure never consumes the challenge',async()=>{
  const f=fixture(),challenge=await reserveAdminOtp(f.db,credentials,now);
  f.failSession=true;
  await assert.rejects(consumeAdminOtp(f.db,verify(challenge.code),now+1),/storage unavailable/);
  assert.ok(f.rows.has('adminOtpChallenges/'+challenge.key));assert.equal(sessions(f).length,0);
  f.failSession=false;assert.equal((await consumeAdminOtp(f.db,verify(challenge.code),now+2)).status,200);
});
test('parallel requests reserve one email; failed password attempts are account-scoped',async()=>{
  const f=fixture();
  const invalid=await Promise.all(Array.from({length:12},()=>reserveAdminOtp(f.db,{...credentials,password:'wrong'},now)));
  assert.equal(f.rows.get('adminOtpRateLimits/credentials').attempts,5);
  assert.equal(invalid.filter(r=>r.status===403).length,4);assert.equal(invalid.filter(r=>r.status===429).length,8);
  const results=await Promise.all(Array.from({length:8},()=>reserveAdminOtp(f.db,credentials,now+1)));
  assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===429).length,7);
  const challenge=results.find(r=>r.status===200),stored=f.rows.get('adminOtpChallenges/'+challenge.key);
  assert.equal(Object.hasOwn(stored,'code'),false);assert.equal(Object.hasOwn(challenge.payload,'code'),false);
});
test('expired codes, malformed input and legacy leading-zero codes are handled safely',async()=>{
  const f=fixture(),challenge=await reserveAdminOtp(f.db,credentials,now);
  assert.equal((await consumeAdminOtp(f.db,verify('bad'),now+1)).status,400);
  assert.equal((await consumeAdminOtp(f.db,{...verify(challenge.code),email:'other@example.com'},now+1)).status,403);
  assert.equal((await consumeAdminOtp(f.db,verify(challenge.code),now+600000)).status,410);
  const key=challenge.key;
  f.rows.set('adminOtpChallenges/'+key,{codeHash:createHash('sha256').update(`${key}:0000:${credentials.pepper}`).digest('hex'),attempts:0,expiresAt:Timestamp.fromMillis(now+600000)});
  assert.equal((await consumeAdminOtp(f.db,verify('0000'),now+2)).status,200);
});
test('late SMTP failure cannot remove a replacement challenge',async()=>{
  const f=fixture(),old=await reserveAdminOtp(f.db,credentials,now);
  const fresh=await reserveAdminOtp(f.db,credentials,now+60000);
  assert.equal(fresh.status,200);assert.notEqual(old.challengeId,fresh.challengeId);
  await discardFailedOtp(f.db,old.key,old.challengeId);
  assert.equal(f.rows.get('adminOtpChallenges/'+fresh.key).challengeId,fresh.challengeId);
  await discardFailedOtp(f.db,fresh.key,fresh.challengeId);
  assert.equal(f.rows.has('adminOtpChallenges/'+fresh.key),false);
});
