import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertRunStart} from '../shared/running.js';
const routes=JSON.parse(readFileSync(new URL('../shared/running-routes.json',import.meta.url),'utf8'));
const now=1800000000000;
const fix=(lat,lng,extra={})=>({lat,lng,accuracy:10,timestamp:now,segment:0,...extra});

test('Peterhof cannot start a Neva route but can start a free run',()=>{
 const neva=routes.find(r=>r.id==='neva-bridges');
 assert.ok(neva);
 const peterhof=fix(59.8845,29.9086);
 assert.throws(()=>assertRunStart(peterhof,neva,now),/До старта маршрута/);
 assert.doesNotThrow(()=>assertRunStart(peterhof,null,now));
});
test('each route accepts a precise fix at its start and rejects a distant one',()=>{
 for(const route of routes){
  assert.doesNotThrow(()=>assertRunStart(fix(route.start.lat,route.start.lng),route,now));
  assert.throws(()=>assertRunStart(fix(route.start.lat+.002,route.start.lng),route,now),/100 м/);
 }
});
test('stale, inaccurate, invalid or future fixes never start even a free run',()=>{
 for(const changes of [{accuracy:51},{timestamp:now-15001},{timestamp:now+1001},{lat:NaN}]){
  assert.throws(()=>assertRunStart(fix(60,30,changes),null,now),/координаты/);
 }
});
