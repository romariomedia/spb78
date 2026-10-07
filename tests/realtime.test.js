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
            'export const collection = (_db, name) => ({ name });',
            'export const where=(...args)=>args; export const query=(ref,...filters)=>({...ref,filters});',
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
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.__listeners = [];
  globalThis.__stopped = 0;

  const calls = [];
  const stop = subscribeAppInvalidation((sections) => calls.push([...sections]));

  assert.equal(globalThis.__listeners.length, 3, 'должны слушаться три коллекции');

  listenerFor('feed').next();
  listenerFor('feed').next();
  listenerFor('trainings').next();
  assert.deepEqual(calls, [], 'до истечения задержки вызовов быть не должно');

  t.mock.timers.tick(350);
  assert.deepEqual(calls, [['feed', 'trainings']], 'разделы отдаются один раз и без повторов');

  stop();
  assert.equal(globalThis.__stopped, 3, 'при отписке слушатели снимаются');
});

test('после отписки изменения больше не приходят', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.__listeners = [];
  globalThis.__stopped = 0;

  const calls = [];
  const stop = subscribeAppInvalidation((sections) => calls.push([...sections]));
  listenerFor('users').next();
  stop();
  t.mock.timers.tick(350);

  assert.deepEqual(calls, [], 'вызов после отписки недопустим');
});

test('feed subscription asks only for server-readable visible posts',()=>{globalThis.__listeners=[];globalThis.__stopped=0;const stop=subscribeAppInvalidation(()=>{});assert.deepEqual(listenerFor('feed').ref.filters,[['isHidden','==',false]]);stop();});
