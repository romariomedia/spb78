import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withoutLegacyLoginAvatar } from '../server/avatar-policy.js';

test('legacy APK VK login cannot overwrite a saved avatar', () => {
  const request = { avatar: 'https://vk.example/photo.jpg', hasRealPhoto: true };
  const patch = withoutLegacyLoginAvatar(request);
  assert.equal(Object.hasOwn(patch, 'avatar'), false);
  assert.equal(request.avatar, 'https://vk.example/photo.jpg');
  const profile = { avatar: 'https://res.cloudinary.com/demo/image/upload/me.jpg' };
  assert.equal({ ...profile, ...patch }.avatar, profile.avatar);
});
test('explicit photo replacement and deletion still work', () => {
  for (const avatar of ['https://res.cloudinary.com/demo/image/upload/new.jpg', '']) {
    assert.deepEqual(withoutLegacyLoginAvatar({ avatar }), { avatar });
  }
});
test('unrelated edits are preserved and invalid input stays invalid', () => {
  assert.deepEqual(withoutLegacyLoginAvatar({ bio: 'Runner' }), { bio: 'Runner' });
  assert.deepEqual(withoutLegacyLoginAvatar({ avatar: 'old', hasRealPhoto: true, bio: 'Runner' }),
    { hasRealPhoto: true, bio: 'Runner' });
  for (const input of [null, undefined, [], 'invalid']) assert.equal(withoutLegacyLoginAvatar(input), input);
});
test('login imports provider photo only through fresh profile bootstrap', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const login = app.slice(app.indexOf('const handleAuthenticated ='), app.indexOf('// Gender onboarding:'));
  assert.ok(!login.includes('updateProfile('));
  assert.ok(app.includes("avatar: freshAccount.vkAvatar || ''"));
  const api = readFileSync(new URL('../api/sportbuddy-mutation.js', import.meta.url), 'utf8');
  assert.ok(api.includes('validateProfileInput(withoutLegacyLoginAvatar(updates))'));
});

test('AuthScreen forwards the server-verified VK avatar into fresh profile bootstrap', () => {
  const auth = readFileSync(new URL('../src/components/AuthScreen.tsx', import.meta.url), 'utf8');
  assert.ok(auth.includes("const verifiedAvatar = getHighQualityVKAvatar(result.avatar || (u.avatar as string) || '')"));
  assert.ok(auth.includes('onAuthenticated(result.account, result.isNewAccount ?? false, verifiedAvatar)'));
  assert.ok(!auth.includes("onAuthenticated(result.account, result.isNewAccount ?? false, getHighQualityVKAvatar((u.avatar as string) || ''))"));
});
