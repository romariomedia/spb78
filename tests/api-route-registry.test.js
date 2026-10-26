import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {API_ROUTES} from '../server/app.js';

test('every top-level API handler is registered by the VPS app',async()=>{
  const files=(await readdir(new URL('../api/',import.meta.url)))
    .filter(name=>name.endsWith('.js'))
    .map(name=>name.slice(0,-3))
    .sort();
  const routes=[...API_ROUTES].sort();
  assert.deepEqual(routes,files);
  assert.equal(new Set(API_ROUTES).size,API_ROUTES.length,'API_ROUTES must not contain duplicates');
});
