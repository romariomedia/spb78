import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';

async function endpoint(configured = '') {
  const result = await build({ entryPoints: ['src/services/apiEndpoint.ts'], bundle: true, write: false,
    format: 'esm', platform: 'node', define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(configured) } });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const api = await endpoint();

test('native bundled origin is separate from production, while web keeps same-origin requests', async () => {
  const originalWindow = globalThis.window, originalFetch = globalThis.fetch;
  try {
    const config = readFileSync('capacitor.config.ts', 'utf8');
    assert.match(config, /hostname:\s*'localhost'/);
    let request;
    globalThis.fetch = async (url, init) => { request = {url, init}; return Response.json({profiles: [{id: 'other-athlete'}]}); };
    globalThis.window = { location: {origin: 'https://localhost'}, Capacitor: {isNativePlatform: () => true} };
    const init = {method: 'POST', headers: {Authorization: 'Bearer test-token'}, body: '{}'};
    const data = await api.readApiJson(await api.apiFetch('/api/public-profiles', init));
    assert.equal(request.url, 'https://sportbuddy78.pro/api/public-profiles');
    assert.equal(request.init, init);
    assert.equal(data.profiles[0].id, 'other-athlete');
    assert.equal(api.publicSiteOrigin(), 'https://sportbuddy78.pro');
    globalThis.window = {location: {origin: 'https://sportbuddy78.pro'}};
    await api.apiFetch('/api/sport-passport', init);
    assert.equal(request.url, '/api/sport-passport');
    assert.equal((await endpoint('https://staging.example/')).apiBase(), 'https://staging.example');
  } finally { globalThis.window = originalWindow; globalThis.fetch = originalFetch; }
});

test('HTML fallback and malformed JSON cannot become successful empty API data', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<html>local app</html>', {headers: {'Content-Type': 'text/html'}});
    await assert.rejects(api.apiFetch('/api/public-profiles'), /некорректный ответ/);
    await assert.rejects(api.readApiJson(Response.json(null)), /некорректные данные/);
    await assert.rejects(api.readApiJson(Response.json([])), /некорректные данные/);
    await assert.rejects(api.readApiJson(new Response('{broken')), SyntaxError);
    assert.deepEqual(await api.readApiJson(Response.json({error: 'unauthorized'}, {status: 401})), {error: 'unauthorized'});
  } finally { globalThis.fetch = originalFetch; }
});

test('services do not reintroduce relative fetch calls to local WebView API paths', () => {
  for (const file of readdirSync('src/services').filter(name => name.endsWith('.ts'))) {
    const text = readFileSync(`src/services/${file}`, 'utf8');
    assert.doesNotMatch(text, /\bfetch\(['"`]\/api\//, file);
  }
});
