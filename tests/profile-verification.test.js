import test from 'node:test';
import assert from 'node:assert/strict';
import { photoVerificationPatch, hasVerificationPhotos, verificationExpired } from '../server/profile-verification.js';
const now = Date.parse('2026-09-29T12:00:00Z');
const profile = { avatar: 'https://res.cloudinary.com/demo/avatar.jpg', photoPortfolio: ['https://res.cloudinary.com/demo/portfolio.jpg'], registeredAt: new Date(now - 3600000).toISOString(), subscriptionPlan: 'free' };
test('second required photo verifies profile and grants welcome trial once', () => {
  const patch = photoVerificationPatch(profile, now);
  assert.equal(patch.isVerified, true);
  assert.equal(Date.parse(patch.premiumUntil) - now, 30 * 86400000);
  assert.deepEqual(photoVerificationPatch({ ...profile, ...patch }, now + 1000), {});
});
test('missing portfolio and placeholder avatar cannot verify', () => {
  assert.equal(hasVerificationPhotos({ ...profile, photoPortfolio: [' '] }), false);
  assert.deepEqual(photoVerificationPatch({ ...profile, avatar: 'https://ui-avatars.com/api' }, now), {});
});
test('verification preserves paid Premium and previous welcome grants', () => {
  for (const extra of [{ premiumUntil: new Date(now + 60 * 86400000).toISOString() }, { welcomeTrialGrantedAt: 'earlier' }]) {
    const patch = photoVerificationPatch({ ...profile, ...extra }, now);
    assert.equal(patch.isVerified, true);
    assert.equal(patch.premiumUntil, undefined);
  }
});
test('24-hour expiry is consistent at the boundary, including Firestore timestamps', () => {
  const expired = { ...profile, registeredAt: { toDate: () => new Date(now - 86400000) } };
  assert.equal(verificationExpired(expired, now), true);
  assert.deepEqual(photoVerificationPatch(expired, now), {});
});
