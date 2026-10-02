import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({entryPoints:['src/services/geolocation.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'location-device',setup(b){
  b.onResolve({filter:/^@capacitor\//},args=>({path:args.path,namespace:'device'}));
  b.onLoad({filter:/.*/,namespace:'device'},args=>({contents:args.path.endsWith('/core')?'export const Capacitor={isNativePlatform:()=>globalThis.__native};':'export const Geolocation={checkPermissions:()=>globalThis.__permissions(),requestPermissions:()=>globalThis.__request(),getCurrentPosition:options=>globalThis.__position(options)};',loader:'js'}));
}}]});
const {getCurrentCoords,calculateDistanceKm}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
function browser(fn){globalThis.__native=false;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{getCurrentPosition:fn}}});}
const fix=(accuracy=20)=>({coords:{latitude:59.93,longitude:30.31,accuracy},timestamp:Date.now()});
test('web requests location directly and preserves device coordinates',async()=>{
  browser((ok,_fail,options)=>{assert.equal(options.maximumAge,60000);ok(fix());});
  assert.deepEqual(await getCurrentCoords(),{lat:59.93,lng:30.31});
});
test('denied and timed-out location never return a default park',async()=>{
  for(const code of [1,2,3]){browser((_ok,fail)=>fail({code}));await assert.rejects(getCurrentCoords());}
});
test('fresh check-in rejects approximate location and does not use cached fixes',async()=>{
  browser((ok,_fail,options)=>{assert.equal(options.maximumAge,0);ok(fix(2000));});
  await assert.rejects(getCurrentCoords({fresh:true}),/точность/);
  browser(ok=>ok(fix(15)));assert.equal((await getCurrentCoords({fresh:true})).lat,59.93);
});
test('out-of-range device coordinates are rejected',async()=>{
  browser(ok=>ok({coords:{latitude:91,longitude:30,accuracy:10}}));await assert.rejects(getCurrentCoords(),/некорректные/);
});
test('native approximate permission works without another request; denial does not fall back to web',async()=>{
  globalThis.__native=true;
  globalThis.__permissions=async()=>({location:'denied',coarseLocation:'granted'});
  globalThis.__request=()=>{throw new Error('unexpected permission request');};
  globalThis.__position=async()=>fix(1000);
  assert.equal((await getCurrentCoords()).lng,30.31);
  globalThis.__permissions=async()=>({location:'denied',coarseLocation:'denied'});
  globalThis.__request=async()=>({location:'denied',coarseLocation:'denied'});
  await assert.rejects(getCurrentCoords(),/запрещён/);
});
test('distance keeps metre precision near radius boundaries',()=>{
  const distance=calculateDistanceKm(0,0,0,0.0001);
  assert.ok(distance>0.011 && distance<0.012);
  assert.equal(calculateDistanceKm(59.93,30.31,59.93,30.31),0);
});
