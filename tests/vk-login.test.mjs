// Regression checks for VK identity selection. These tests replace external
// Firebase/VK calls with deterministic in-memory fakes; they do not exercise
// production credentials or deployed infrastructure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../api/vk-login.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default async function handler', 'async function handler');

function harness({ vkId = '42', vkEmail = '', existing = [], mappedUid = null, vkRequestFails = false } = {}) {
  const users = new Map(existing.map(user => [user.uid, { ...user }]));
  const emails = new Map(existing.filter(user => user.email).map(user => [user.email, user.uid]));
  const identities = new Map(mappedUid ? [[vkId, { uid: mappedUid }]] : []);
  const privateUsers = new Map();
  const profileDocs = existing.filter(user => user.vkId).map(user => ({
    id: user.uid, data: () => ({ vkId: user.vkId })
  }));
  let created = 0;
  const auth = {
    async getUser(uid) {
      if (!users.has(uid)) throw Object.assign(new Error('Not found'), { code: 'auth/user-not-found' });
      return users.get(uid);
    },
    async getUserByEmail(email) {
      const uid = emails.get(email);
      if (!uid) throw Object.assign(new Error('Not found'), { code: 'auth/user-not-found' });
      return users.get(uid);
    },
    async createUser(input) {
      if (users.has(input.uid) || emails.has(input.email)) throw new Error('Duplicate Firebase identity');
      const user = { ...input };
      created++;
      users.set(user.uid, user);
      emails.set(user.email, user.uid);
      return user;
    },
    async createCustomToken(uid, claims) {
      return JSON.stringify({ uid, claims });
    }
  };
  const firestore = {
    collection(name) {
      if (name === 'vkIdentities') return {
        doc(id) {
          return {
            async get() {
              return { exists: identities.has(id), data: () => identities.get(id) };
            },
            async set(value) {
              identities.set(id, { ...identities.get(id), ...value });
            }
          };
        }
      };
      if (name === 'usersPrivate') return {
        doc(id) {
          return {
            async set(value) {
              privateUsers.set(id, { ...privateUsers.get(id), ...value });
            }
          };
        }
      };
      if (name === 'users') return {
        where(key, op, value) {
          assert.equal(key, 'vkId');
          assert.equal(op, '==');
          return {
            limit() {
              return { async get() {
                return { docs: profileDocs.filter(doc => doc.data().vkId === value) };
              } };
            }
          };
        }
      };
      throw new Error('Unexpected collection: ' + name);
    }
  };
  const sandbox = {
    getApps: () => ['already-initialized'],
    getAuth: () => auth,
    getFirestore: () => firestore,
    process: { env: { VK_WEB_APP_ID: '1234' } },
    URLSearchParams,
    Date,
    JSON,
    String,
    Number,
    console,
    fetch: async (_url, options) => {
      const token = new URLSearchParams(options.body).get('access_token');
      if (vkRequestFails || token !== 'trusted-token') return { ok: false };
      return { ok: true, json: async () => ({
        user: { user_id: vkId, email: vkEmail, first_name: 'Test', last_name: 'Athlete' }
      }) };
    }
  };
  const handler = vm.runInNewContext(source + '\nhandler', sandbox, { filename: 'api/vk-login.js' });
  async function request(body = { accessToken: 'trusted-token', vkUserId: vkId }) {
    const res = {
      code: 200,
      status(code) { this.code = code; return this; },
      json(data) { return { status: this.code, body: data }; }
    };
    return handler({ method: 'POST', body }, res);
  }
  return { request, users, identities, privateUsers, get created() { return created; } };
}

test('a client-supplied email never signs VK into an unrelated password account', async () => {
  const h = harness({ existing: [{ uid: 'password-account', email: 'victim@example.com' }] });
  const response = await h.request({
    accessToken: 'trusted-token', vkUserId: '42', email: 'victim@example.com'
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.uid, 'vk_42');
  assert.equal(h.users.get('password-account').uid, 'password-account');
  assert.equal(h.created, 1);
});

test('even a VK-supplied email collision does not take over an email account', async () => {
  const h = harness({
    vkEmail: 'victim@example.com',
    existing: [{ uid: 'password-account', email: 'victim@example.com' }]
  });
  const response = await h.request();
  assert.equal(response.status, 200);
  assert.equal(response.body.uid, 'vk_42');
  assert.equal(h.users.get('vk_42').email, 'vk_42@sportbuddy78.pro');
});

test('the same verified VK ID returns one stable account across logins', async () => {
  const h = harness();
  const first = await h.request();
  const second = await h.request({ accessToken: 'trusted-token', vkUserId: '42', email: 'different@example.com' });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body.uid, second.body.uid);
  assert.equal(first.body.isNewAccount, true);
  assert.equal(second.body.isNewAccount, false);
  assert.equal(h.created, 1);
  assert.equal(h.identities.get('42').uid, 'vk_42');
});

test('verified VK ID must match requested VK ID', async () => {
  const h = harness();
  const response = await h.request({ accessToken: 'trusted-token', vkUserId: 'not-42' });
  assert.equal(response.status, 401);
  assert.equal(h.created, 0);
});

test('an invalid VK token never creates an account', async () => {
  const h = harness({ vkRequestFails: true });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await h.request();
    assert.equal(response.status, 401);
    assert.equal(h.created, 0);
    assert.equal(h.identities.size, 0);
  } finally {
    console.error = originalConsoleError;
  }
});

test('existing verified VK mapping is reused, not overwritten with a new UID', async () => {
  const h = harness({
    existing: [{ uid: 'legacy-vk-user', email: 'legacy@example.com' }],
    mappedUid: 'legacy-vk-user'
  });
  const response = await h.request();
  assert.equal(response.status, 200);
  assert.equal(response.body.uid, 'legacy-vk-user');
  assert.equal(h.created, 0);
});
