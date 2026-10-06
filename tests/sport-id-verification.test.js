import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyVerifiedClaims,claimFingerprint,claimFromPassport,sanitizeVerificationEvidence,
  verificationClaimId,verificationRequestId
} from '../server/sport-id-verification.js';

const passport={
  mainSport:'Бег',level:'competitive',rankTitle:'1 разряд',
  declaredAchievements:[
    {id:'a1',title:'Полумарафон',sport:'Бег',date:'2026-09-01',placement:'1:42',verification:'declared'},
    {id:'a2',title:'Городской старт',sport:'Бег',date:'2026-09-15',placement:'3 место',verification:'declared'}
  ]
};

test('rank and achievement claims are built from current SportBuddy78 ID only',()=>{
  const rank=claimFromPassport(passport,{claimType:'rank'});
  assert.equal(rank.rankTitle,'1 разряд');
  const achievement=claimFromPassport(passport,{claimType:'achievement',claimId:'a2'});
  assert.equal(achievement.title,'Городской старт');
  assert.equal(achievement.placement,'3 место');
  assert.throws(()=>claimFromPassport(passport,{claimType:'achievement',claimId:'missing'}),error=>error.status===404);
});

test('verification evidence requires a document or official https link',()=>{
  assert.deepEqual(sanitizeVerificationEvidence({officialUrl:'https://example.org/result',note:'protocol'}),{
    evidenceUrl:'',officialUrl:'https://example.org/result',note:'protocol'
  });
  assert.throws(()=>sanitizeVerificationEvidence({}),error=>error.status===400);
  assert.throws(()=>sanitizeVerificationEvidence({officialUrl:'http://example.org'}),error=>error.status===400);
});

test('verified claim is applied only while the underlying fact is unchanged',()=>{
  const rankClaim=claimFromPassport(passport,{claimType:'rank'});
  const achClaim=claimFromPassport(passport,{claimType:'achievement',claimId:'a2'});
  const claims=[
    {...rankClaim,status:'verified',fingerprint:claimFingerprint(rankClaim)},
    {...achClaim,status:'verified',fingerprint:claimFingerprint(achClaim)}
  ];
  const verified=applyVerifiedClaims(passport,claims);
  assert.equal(verified.rankVerification,'verified');
  assert.equal(verified.achievements.find(x=>x.id==='a2').verification,'verified');

  const changed={...passport,rankTitle:'КМС',declaredAchievements:passport.declaredAchievements.map(x=>x.id==='a2'?{...x,placement:'2 место'}:x)};
  const stale=applyVerifiedClaims(changed,claims);
  assert.equal(stale.rankVerification,'declared');
  assert.equal(stale.achievements.find(x=>x.id==='a2').verification,'declared');
});

test('verification ids are deterministic per user and claim',()=>{
  const claim=claimFromPassport(passport,{claimType:'achievement',claimId:'a1'});
  assert.equal(verificationRequestId('u1',claim),verificationRequestId('u1',claim));
  assert.equal(verificationClaimId('u1',claim),verificationClaimId('u1',claim));
  assert.notEqual(verificationRequestId('u1',claim),verificationRequestId('u2',claim));
});
