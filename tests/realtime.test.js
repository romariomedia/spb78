import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

/**
 * Слушатели Firestore заменяются заглушкой: тест проверяет не сеть, а логику
 * агрегации изменений — какие разделы и сколько раз получает вызывающий код.
 */
const bundled = await build({
  entryPoints: ['src/services/realtime.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{
    name: 'fake-firestore',
    setup(b) {
      b.onResolve({ filter: /^firebase\/firestore$/ }, (args) => ({ path: args.path, namespace: 'fake' }));
      b.onResolve({ filter: /lib\/firebase$/ }, () => ({ path: 'lib/firebase', namespace: 'fake' }));
      b.onLoad({ filter: /.*/, namespace: 'fake' }, (args) => ({
        contents: args.path === 'lib/firebase'
          ? 'export const db = { name: "fake" };'
          : [
            'export const doc = (_db, name, id) => ({ name, id });',
            'export const collection = (_db, name) => ({ name });',
            'export const onSnapshot = (ref, next) => {',
            '  globalThis.__listeners.push({ ref, next });',
            '  return () => { globalThis.__stopped += 1; };',
            '};'
          ].join('\n'),
        loader: 'js'
      }));
    }
  }]
});

const { subscribeAppInvalidation } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);

function listenerFor(name) {
  return globalThis.__listeners.find((entry) => entry.ref.name === name);
}

test('изменения разделов копятся и приходят одним вызовом', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout','setInterval'] });
  globalThis.__listeners = [];
  globalThis.__stopped = 0;

  const calls = [];
  const stop = subscribeAppInvalidation((sections) => calls.push([...sections]), 'athlete-a');

  assert.equal(listenerFor('users').ref.id, 'athlete-a');
  assert.equal(globalThis.__listeners.length, 1);
  assert.equal(listenerFor('feed'),undefined,'private feed must not be subscribed directly');

  listenerFor('users').next();
  listenerFor('users').next();
  assert.equal(listenerFor('trainings'),undefined,'private catalog must use API');
  assert.deepEqual(calls, [], 'до истечения задержки вызовов быть не должно');

  t.mock.timers.tick(350);
  assert.deepEqual(calls, [['users']], 'разделы отдаются один раз и без повторов');

  stop();
  assert.equal(globalThis.__stopped, 1, 'при отписке слушатели снимаются');
});

test('после отписки изменения больше не приходят', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout','setInterval'] });
  globalThis.__listeners = [];
  globalThis.__stopped = 0;

  const calls = [];
  const stop = subscribeAppInvalidation((sections) => calls.push([...sections]), 'athlete-a');
  listenerFor('users').next();
  stop();
  t.mock.timers.tick(350);

  assert.deepEqual(calls, [], 'вызов после отписки недопустим');
});

test('feed refreshes through invalidation polling and stops after cleanup',t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});globalThis.__listeners=[];globalThis.__stopped=0;
 const calls=[];const stop=subscribeAppInvalidation(s=>calls.push([...s]),'a');
 t.mock.timers.tick(60000);t.mock.timers.tick(350);assert.deepEqual(calls,[['trainings','feed']]);
 stop();t.mock.timers.tick(120000);assert.equal(calls.length,1);
});
