import test from 'node:test';
import assert from 'node:assert/strict';
import { complaintDailyId,reportStatus,sanitizeComplaintInput } from '../server/report-policy.js';

test('complaint input only accepts known reasons and safe ids',()=>{
  assert.deepEqual(sanitizeComplaintInput({targetUserId:'u2',chatId:'chat_u1__u2',reason:'spam',details:'реклама'}),{targetUserId:'u2',chatId:'chat_u1__u2',reason:'spam',details:'реклама'});
  assert.equal(sanitizeComplaintInput({targetUserId:'u2',chatId:'chat_u1__u2',reason:'unknown'}).reason,'unsafe');
  assert.throws(()=>sanitizeComplaintInput({targetUserId:'bad/id',chatId:'chat'}),error=>error.status===400);
});
test('complaint dedup id is stable per reporter target chat and UTC day',()=>{
  const a=complaintDailyId('u1','u2','chat',Date.parse('2026-10-06T10:00:00Z'));
  const b=complaintDailyId('u1','u2','chat',Date.parse('2026-10-06T23:59:00Z'));
  const c=complaintDailyId('u1','u2','chat',Date.parse('2026-10-07T00:01:00Z'));
  assert.equal(a,b);assert.notEqual(a,c);
});
test('moderation status falls back to new',()=>{assert.equal(reportStatus('resolved'),'resolved');assert.equal(reportStatus('hacked'),'new');});
