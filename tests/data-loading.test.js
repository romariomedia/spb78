import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the real loader with controlled Firestore responses; never contact production.
const bundled = await build({
  entryPoints: ['src/services/repository.ts'], bundle: true, write: false, format: 'esm', platform: 'node',
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_ENABLE_SAMPLE_DATA': '"false"' },
  plugins: [{ name: 'fake-io', setup(b) {
    b.onResolve({ filter: /^(firebase\/firestore|\.\.\/lib\/firebase|\.\/native|\.\/schedule|\.\/reset|\.\/serverApi)$/ }, args => ({ path: args.path, namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, args => {
      const sources = {
        'firebase/firestore': `export const collection=(_db,name)=>name; export const doc=(_db,name,id)=>name+'/'+id;
          const read=async path=>{const value=globalThis.__sbReads[path];if(value instanceof Error)throw value;return value;};
          export const getDocsFromServer=path=>{if(path==='users')throw Error('Raw user collection read forbidden');return read(path)},getDocFromServer=read;`,
        '../lib/firebase': 'export const db={};',
        './native': 'export const triggerHapticImpact=()=>{};',
        './schedule': 'export const getActiveTrainings=x=>x;',
        './reset': 'export const createFreshProfile=(id,extra={})=>({id,name:"New",...extra});',
        './serverApi': `export const callServer=async(path)=>{
          if(path!=='/api/public-profiles')throw new Error('Unexpected mutation');
          const value=globalThis.__sbReads.users;if(value instanceof Error)throw value;
          return {profiles:value.docs.map(d=>({id:d.id,...d.data()})),nextCursor:null};
        };`
      };
      return { contents: sources[args.path], loader: 'js' };
    });
  }}]
});
const repository = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text + "\n//# sourceURL=sportbuddy-test-repository.js").toString('base64')}`);
const helper = await build({ entryPoints: ['src/services/dataLoading.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { readSection, joinedTrainingIds } = await import(`data:text/javascript;base64,${Buffer.from(helper.outputFiles[0].text).toString('base64')}`);
const snapshot = (id, value) => ({ id, exists: () => value !== null, data: () => value });
const collectionSnapshot = (items) => ({ docs: items.map(([id, value]) => snapshot(id, value)) });
let storage;
function reset() {
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
  storage = new Map();
  globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k=>storage.delete(k) };
  repository.setCurrentUserId('alice');
  globalThis.__sbReads = {
    'users/alice': snapshot('alice', { name: 'Alice' }),
    users: collectionSnapshot([['alice', { name: 'Alice' }], ['bob', { name: 'Bob' }]]),
    trainings: collectionSnapshot([['training-1', { participantIds: ['alice'] }]]),
    feed: collectionSnapshot([]), 'usersPrivate/alice': snapshot('alice', { email: 'alice@example.com' })
  };
}

test('private data failure does not hide successful trainings or public profiles', async () => {
  reset(); globalThis.__sbReads['usersPrivate/alice'] = new Error('permission-denied');
  const data = await repository.loadAppData();
  assert.equal(data.currentUser.name, 'Alice');
  assert.equal(data.trainings[0].id, 'training-1'); // Document ID works even without id/createdAt fields.
  assert.equal(data.allUsers.find(u=>u.id==='bob').name, 'Bob');
  assert.ok(data.loadWarning);
});
test('failed collection keeps its cache while successful sections update', async () => {
  reset(); await repository.loadAppData();
  globalThis.__sbReads.trainings = new Error('unavailable');
  globalThis.__sbReads['users/alice'] = snapshot('alice', { name: 'Updated' });
  const data = await repository.loadAppData();
  assert.equal(data.currentUser.name, 'Updated');
  assert.equal(data.trainings[0].id, 'training-1');
});
test('failed profile read without same-account cache never invents a new profile', async () => {
  reset(); globalThis.__sbReads['users/alice'] = new Error('permission-denied');
  await assert.rejects(repository.loadAppData(), /Не удалось загрузить профиль/);
  assert.equal(storage.size, 0);
});
test('another account cannot use the previous account cache', async () => {
  reset(); await repository.loadAppData(); repository.setCurrentUserId('bob');
  globalThis.__sbReads['users/bob'] = new Error('unavailable');
  globalThis.__sbReads['usersPrivate/bob'] = snapshot('bob', null);
  await assert.rejects(repository.loadAppData(), /Не удалось загрузить профиль/);
});
test('only confirmed absent profile requests bootstrap', async () => {
  reset(); globalThis.__sbReads['users/alice'] = snapshot('alice', null);
  assert.equal((await repository.loadAppData()).profileMissing, true);
  assert.equal(storage.size, 0);
});
test('a successful empty collection clears stale entries', async () => {
  reset(); await repository.loadAppData(); globalThis.__sbReads.trainings = collectionSnapshot([]);
  assert.deepEqual((await repository.loadAppData()).trainings, []);
});
test('hanging sections time out independently', async () => {
  const [hung, healthy] = await Promise.all([
    readSection(new Promise(()=>{}), ()=>['cached'], 10),
    readSection(Promise.resolve(['fresh']), ()=>[], 10)
  ]);
  assert.deepEqual(hung, { value: ['cached'], stale: true });
  assert.deepEqual(healthy, { value: ['fresh'], stale: false });
});
test('membership on a second device uses server participants', () => {
  assert.deepEqual([...joinedTrainingIds([{ id: 't1', participantIds: ['alice'] }, { id: 't2', participantIds: ['bob'] }], 'alice')], ['t1']);
  assert.equal(joinedTrainingIds([{ id: 't1', participantIds: ['alice'] }], 'bob').size, 0);
});

 test('upgrade removes old community cache containing private social fields',async()=>{
  reset();storage.set('sportbuddy_offline_cache_v4',JSON.stringify({allUsers:[{email:'secret',friendIds:['other']}]}));
  await repository.loadAppData();
  assert.equal(storage.has('sportbuddy_offline_cache_v4'),false);
  assert.equal(storage.has('sportbuddy_offline_cache_v5'),true);
 });
