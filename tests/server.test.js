import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { API_ROUTES, createApiApp } from '../server/app.js';

async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'sportbuddy-api-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'package.json'), '{"type":"module"}');
  for (const name of API_ROUTES) {
    const source = Object.hasOwn(overrides, name) ? overrides[name]
      : 'export default (req,res) => res.json({ method: req.method, body: req.body });';
    if (source !== null) await writeFile(join(dir, `${name}.js`), source);
  }
  return dir;
}

test('missing, broken and invalid handlers prevent app startup', async t => {
  for (const source of [null, 'throw new Error("secret-value")', 'export default 1;']) {
    const apiDir = await fixture(t, { 'vk-login': source });
    await assert.rejects(createApiApp({ apiDir }), { message: 'Cannot load required API route: vk-login' });
  }
});

test('health, route forwarding and JSON errors', async t => {
  const apiDir = await fixture(t, { 'feed-create': 'export default async () => { throw new Error("secret-value"); }' });
  const app = await createApiApp({ apiDir });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/health', '/api/health']) {
    const result = await fetch(base + path);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).routesLoaded, 11);
  }
  const result = await fetch(base + '/api/sportbuddy-mutation', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":"bootstrapProfile"}'
  });
  assert.deepEqual(await result.json(), { method: 'POST', body: { action: 'bootstrapProfile' } });
  assert.equal((await fetch(base + '/api/unknown')).status, 404);
  const broken = await fetch(base + '/api/feed-create');
  assert.equal(broken.status, 500);
  assert.deepEqual(await broken.json(), { error: 'Internal server error' });
  const malformed = await fetch(base + '/api/sportbuddy-mutation', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{'
  });
  assert.equal(malformed.status, 400);
});
