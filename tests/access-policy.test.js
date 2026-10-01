import test from 'node:test';
import assert from 'node:assert/strict';
import {isBetaActive,hasPremiumAccess,BETA_START,BETA_END} from '../shared/access-policy.js';
import {getPlan} from '../server/payment-config.js';
test('open season ends at exactly Moscow midnight; stale plan cannot grant access',()=>{
  const expired={subscriptionPlan:'premium',premiumUntil:'2020-01-01'};
  assert.equal(isBetaActive(BETA_START-1),false);
  assert.equal(hasPremiumAccess(expired,BETA_START),true);
  assert.equal(hasPremiumAccess(expired,BETA_END-1),true);
  assert.equal(hasPremiumAccess(expired,BETA_END),false);
  assert.equal(hasPremiumAccess({subscriptionPlan:'premium'},BETA_END),false);
  assert.equal(hasPremiumAccess(null,BETA_END-1),false);
  assert.equal(hasPremiumAccess({premiumUntil:'2027-02-01'},BETA_END),true);
});
test('normal prices resume from January 2027',t=>{
  t.mock.timers.enable({apis:['Date'],now:BETA_END});
  assert.equal(getPlan('monthly').amount,'990.00');
  assert.equal(getPlan('yearly').amount,'9900.00');
});
