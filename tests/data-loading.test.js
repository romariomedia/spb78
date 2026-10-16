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
          export const getDocsFromServer=path=>{if(['users','feed','trainings'].includes(path))throw Error('Raw collection read forbidden');return read(path)},getDocFromServer=read;`,
        '../lib/firebase': 'export const db={};',
        './native': 'export const triggerHapticImpact=()=>{};',
        './schedule': 'export const getActiveTrainings=x=>x;',
        './reset': 'export const createFreshProfile=(id,extra={})=>({id,name:"New",...extra});',
        './serverApi': `export const callServer=async(path,body={})=>{
          if(globalThis.__sbApiHook){const result=await globalThis.__sbApiHook(path,body);if(result!==undefined)return result;}
          if(path==='/api/activities-list'){const value=globalThis.__sbReads.trainings;if(value instanceof Error)throw value;return {items:value.docs.map(d=>({id:d.id,...d.data()})),nextCursor:null};}
          if(path==='/api/feed-list'){const value=globalThis.__sbReads.feed;if(value instanceof Error)throw value;return {posts:value.docs.map(d=>({id:d.id,...d.data()})),nextCursor:null};}
          if(path!=='/api/public-profiles')throw new Error('Unexpected mutation');
          const value=globalThis.__sbReads.users;if(value instanceof Error)throw value;
          const docs=value.docs.filter(d=>body.ids?body.ids.includes(d.id):!body.cursor||d.id>body.cursor);
          const limit=body.ids?50:(body.pageSize||200);
          return {profiles:docs.slice(0,limit).map(d=>({id:d.id,...d.data()})),nextCursor:!body.ids&&docs.length>=limit?docs[limit-1].id:null};
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
  globalThis.__sbApiHook=undefined;
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
  assert.equal(storage.has('sportbuddy_offline_cache_v7'),true);
 });

test('legacy null arrays and unknown medal tier do not break the loaded profile', async () => {
  reset();
  globalThis.__sbReads['users/alice'] = snapshot('alice', {
    name: 'Alice', sports: null, matchIds: null, rewardItems: {}, medalTier: 'legacy-tier', photoPortfolio: null
  });
  const result = await repository.loadAppData();
  assert.deepEqual(result.currentUser.matchIds, []);
  assert.deepEqual(result.currentUser.sports, []);
  assert.deepEqual(result.currentUser.rewardItems, []);
  assert.deepEqual(result.currentUser.photoPortfolio, []);
  assert.equal(result.currentUser.medalTier, 'bronze');
  assert.equal(result.allUsers.length, 2);
});

test('successful feed API load clears warning without direct Firestore feed access',async()=>{
 reset();globalThis.__sbReads.feed=collectionSnapshot([['new',{content:'Visible',createdAt:'2026-10-14'}]]);
 const data=await repository.loadAppData();assert.equal(data.loadWarning,undefined);assert.equal(data.feedPosts[0].content,'Visible');
 globalThis.__sbReads.feed=collectionSnapshot([]);
 assert.deepEqual(await repository.loadFeedPosts(),[]);
});


test('startup fetches one discovery page and hydrates friends outside that page',async()=>{
  reset();
  const users=Array.from({length:105},(_,i)=>['u'+String(i).padStart(3,'0'),{name:'Athlete'}]);
  globalThis.__sbReads.users=collectionSnapshot(users);
  globalThis.__sbReads['users/alice']=snapshot('alice',{name:'Alice',friendIds:['u099'],matchIds:['u100']});
  const calls=[];
  globalThis.__sbApiHook=async(path,body)=>{calls.push({path,body});};
  const data=await repository.loadAppData();
  assert.equal(data.publicProfilesNextCursor,'u039');
  assert.equal(data.publicProfilesStale,false);
  assert.equal(data.allUsers.length,43); // self + 40 discovery + two identities
  assert.ok(data.allUsers.some(user=>user.id==='u099'));
  assert.ok(data.allUsers.some(user=>user.id==='u100'));
  const requests=calls.filter(c=>c.path==='/api/public-profiles');
  assert.equal(requests.length,2);
  assert.deepEqual(requests[1].body.ids,['u099','u100']);
  const page=await repository.loadPublicProfilePage(data.publicProfilesNextCursor);
  assert.equal(page.profiles[0].id,'u040');assert.equal(page.nextCursor,'u079');
});

test('identity requests split at 50 and page requests cannot cross an account change',async()=>{
  reset();
  globalThis.__sbReads.users=collectionSnapshot(Array.from({length:110},(_,i)=>['u'+i,{name:'User'}]));
  const sizes=[];
  globalThis.__sbApiHook=async(path,body)=>{if(body.ids)sizes.push(body.ids.length);};
  const ids=Array.from({length:110},(_,i)=>'u'+i);
  assert.equal((await repository.loadPublicProfilesByIds([...ids,...ids])).length,110);
  assert.deepEqual(sizes,[50,50,10]);
  globalThis.__sbApiHook=async()=>{repository.setCurrentUserId('bob');return {profiles:[],nextCursor:null};};
  await assert.rejects(repository.loadPublicProfilePage(),/Аккаунт изменился/);
});

test('failed identity read preserves cached friends and marks their section stale',async()=>{
  reset();
  globalThis.__sbReads.users=collectionSnapshot(Array.from({length:50},(_,i)=>['u'+String(i).padStart(3,'0'),{name:'User'}]));
  globalThis.__sbReads['users/alice']=snapshot('alice',{name:'Alice',friendIds:['u049']});
  await repository.loadAppData();
  globalThis.__sbApiHook=async(path,body)=>{if(body.ids)throw new Error('offline');};
  const data=await repository.loadAppData();
  assert.ok(data.allUsers.some(user=>user.id==='u049'));
  assert.match(data.loadWarning,/друзья и мэтчи/);
  assert.equal(data.publicProfilesStale,false);
});
