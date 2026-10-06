import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyticsDayKey,analyticsDocId,analyticsSessionId,percent,safeActiveSeconds,shiftAnalyticsDay
} from '../server/analytics.js';

test('analytics day keys use Moscow calendar boundaries',()=>{
  assert.equal(analyticsDayKey(Date.parse('2026-10-06T20:59:59Z')),'2026-10-06');
  assert.equal(analyticsDayKey(Date.parse('2026-10-06T21:00:00Z')),'2026-10-07');
  assert.equal(shiftAnalyticsDay('2026-10-06',-7),'2026-09-29');
});

test('analytics identifiers are deterministic and do not expose uid',()=>{
  const daily=analyticsDocId('2026-10-06','secret-user-id');
  const session=analyticsSessionId('2026-10-06','secret-user-id','session-1');
  assert.equal(daily,analyticsDocId('2026-10-06','secret-user-id'));
  assert.equal(session,analyticsSessionId('2026-10-06','secret-user-id','session-1'));
  assert.equal(daily.includes('secret-user-id'),false);
  assert.equal(session.includes('secret-user-id'),false);
});

test('active seconds cannot be accelerated by client input',()=>{
  const now=1_000_000;
  assert.equal(safeActiveSeconds(60,{now,lastPulseAt:0,lastCreditedAt:0}),0);
  assert.equal(safeActiveSeconds(999,{now,lastPulseAt:now-30_000,lastCreditedAt:now-30_000}),35);
  assert.equal(safeActiveSeconds(20,{now,lastPulseAt:now-30_000,lastCreditedAt:now-30_000}),20);
  assert.equal(safeActiveSeconds(-5,{now,lastPulseAt:now-30_000,lastCreditedAt:now-30_000}),0);
});

test('retention percent is one decimal and null for empty cohort',()=>{
  assert.equal(percent(2,11),18.2);
  assert.equal(percent(0,5),0);
  assert.equal(percent(0,0),null);
});
