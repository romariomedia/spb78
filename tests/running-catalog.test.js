import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { distanceM } from '../shared/running.js';
const routes=JSON.parse(readFileSync(new URL('../shared/running-routes.json',import.meta.url),'utf8'));
test('three route cards have maps, three scenery assets and consistent display distances',()=>{
 assert.equal(routes.length,3);
 assert.equal(new Set(routes.map(r=>r.id)).size,3);
 for(const r of routes){
  assert.equal(r.images.length,3);
  for(const image of [r.mapImage,...r.images]) assert.ok(existsSync(new URL(`../public${image}`,import.meta.url)),image);
  assert.ok(r.displayPath.length>20);
  for(const p of r.displayPath) assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  const length=r.displayPath.slice(1).reduce((sum,p,i)=>sum+distanceM(r.displayPath[i],p),0);
  assert.ok(Math.abs(length-r.distanceM)/r.distanceM<0.05,`${r.id}: ${length}`);
  assert.ok(distanceM(r.displayPath[0],r.displayPath.at(-1))<60);
  assert.equal(r.verified,false);assert.deepEqual(r.path,[]);
 }
});
test('park loop stays inside the park area and Neva loop reaches both bridges',()=>{
 const park=routes.find(r=>r.id==='park300');
 assert.ok(park.displayPath.every(p=>p.lat<59.9857&&p.lat>59.981&&p.lng>30.189&&p.lng<30.212));
 const neva=routes.find(r=>r.id==='neva-bridges');
 for(const bridge of [{lat:59.941,lng:30.3078},{lat:59.9349,lng:30.2897}]){
  assert.ok(neva.displayPath.some(p=>distanceM(p,bridge)<220));
 }
});
