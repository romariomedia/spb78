import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({entryPoints:['src/services/venues.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'deps',setup(b){
 b.onResolve({filter:/\/adminAuth$/},()=>({path:'admin',namespace:'fake'}));
 b.onResolve({filter:/\/serverApi$/},()=>({path:'base',namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:args.path==='admin'?'export const getAdminSession=()=>({sessionId:"test"})':'export const apiBase=()=>"https://sportbuddy78.pro"',loader:'js'}));
}}]});
const {mergeVenueCatalog,loadOfficialTrainingVenues}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('admin catalog keeps hidden and unmapped venues, excludes archived; public catalog stays private',()=>{
 const managed=[{id:'hidden-test',name:'Hidden',address:'Street',isPublished:false},{id:'archived-test',archived:true},{id:'new-test',name:'New',address:'Other'}];
 const admin=mergeVenueCatalog(managed,true),publicItems=mergeVenueCatalog(managed);
 assert.ok(admin.some(v=>v.id==='hidden-test'&&v.isPublished===false));
 assert.ok(admin.some(v=>v.id==='new-test'&&!v.coordinates));
 assert.ok(!admin.some(v=>v.id==='archived-test'));
 assert.ok(!publicItems.some(v=>v.id==='hidden-test'));
});
test('official training catalog resolves researched seed coordinates and never writes private cache',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage;
 globalThis.localStorage={setItem(){throw new Error('private cache write');}};
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://sportbuddy78.pro/api/admin-mutate-venue');
  assert.equal(JSON.parse(options.body).sessionId,'test');
  return {ok:true,json:async()=>({venues:[{id:'fabrika-futbola',address:'Changed address'},{id:'hidden-test',isPublished:false,coordinates:{lat:60,lng:30}}]})};
 };
 try{
  const rows=await loadOfficialTrainingVenues();
  assert.equal(rows.find(v=>v.id==='fabrika-futbola').coordinates,null);
  assert.deepEqual(rows.find(v=>v.id==='hidden-test').coordinates,{lat:60,lng:30});
  assert.ok(rows.filter(v=>v.coordinates).length>20);
 }finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;}
});
