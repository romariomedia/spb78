import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVkEmail, resolveVkIdentity } from '../server/vk-identity.js';
const missing = () => Object.assign(new Error('missing'), { code: 'auth/user-not-found' });
const args = { vkId: '123', profileUids: [], name: 'VK User', avatar: 'invalid' };

test('missing and malformed optional VK emails are ignored', () => {
  for (const email of [undefined, null, ' ', 'not-an-email', 'a b@example.com', {}]) assert.equal(normalizeVkEmail(email), '');
  assert.equal(normalizeVkEmail(' User@Example.com '), 'user@example.com');
});
test('VK account creation requires no email and repeats reuse the same UID', async () => {
  let saved;
  const auth = {
    async getUser(uid) { if (!saved) throw missing(); return { ...saved, uid }; },
    async createUser(data) { saved = data; return data; }
  };
  const first = await resolveVkIdentity({ ...args, auth });
  assert.equal(first.user.uid, 'vk_123');
  assert.equal(first.isNewAccount, true);
  assert.equal(Object.hasOwn(saved, 'email'), false);
  assert.equal(Object.hasOwn(saved, 'emailVerified'), false);
  assert.equal(Object.hasOwn(saved, 'photoURL'), false);
  const second = await resolveVkIdentity({ ...args, auth });
  assert.equal(second.user.uid, first.user.uid);
  assert.equal(second.isNewAccount, false);
});
test('mapping and legacy identity preserve canonical UID', async () => {
  const auth = { async getUser(uid) { return { uid }; } };
  assert.equal((await resolveVkIdentity({ ...args, auth, mappedUid: 'canonical' })).user.uid, 'canonical');
  assert.equal((await resolveVkIdentity({ ...args, auth, profileUids: ['legacy'] })).user.uid, 'legacy');
  await assert.rejects(resolveVkIdentity({ ...args, auth, profileUids: ['one', 'two'] }), /Ambiguous/);
});
test('Auth service failures do not trigger creation', async () => {
  const error = Object.assign(new Error('unavailable'), { code: 'auth/internal-error' });
  const auth = { async getUser() { throw error; }, async createUser() { assert.fail('must not create'); } };
  await assert.rejects(resolveVkIdentity({ ...args, auth }), error);
});
test('concurrent first logins resolve to the same deterministic UID', async () => {
  let calls = 0;
  const auth = {
    async getUser(uid) { if (++calls === 1) throw missing(); return { uid }; },
    async createUser() { throw Object.assign(new Error('exists'), { code: 'auth/uid-already-exists' }); }
  };
  assert.equal((await resolveVkIdentity({ ...args, auth })).user.uid, 'vk_123');
});
