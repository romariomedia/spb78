import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({entryPoints:['src/services/venues.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'deps',setup(b){
 b.onResolve({filter:/\/adminAuth$/},()=>({path:'admin',namespace:'fake'}));
 b.onResolve({filter:/\/apiEndpoint$/},()=>({path:'base',namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:args.path==='admin'?'export const getAdminSession=()=>({sessionId:"test"})':'export const apiFetch=(path,init)=>fetch("https://sportbuddy78.pro"+path,init)',loader:'js'}));
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

const bundledNetworks=await build({entryPoints:['src/lib/venueNetworks.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {venueNetworkGroups}=await import('data:text/javascript;base64,'+Buffer.from(bundledNetworks.outputFiles[0].text).toString('base64'));
test('networks group visible branches while branch IDs, addresses and admin overrides remain distinct',()=>{
 const all=mergeVenueCatalog([]);
 const groups=venueNetworkGroups(all);
 assert.equal(groups.length,4);
 assert.deepEqual(groups.map(g=>g.name),['DDX Fitness','Fitness House','URBANFIT','ALEX FITNESS']);
 for(const g of groups)assert.ok(g.branches.length>1,g.name);
 const branch=groups[0].branches[0], other=groups[0].branches[1];
 const changed=mergeVenueCatalog([{id:branch.id,name:'Изменённый клуб',address:'Новый адрес',coordinates:{lat:60,lng:30}}]);
 assert.equal(venueNetworkGroups(changed)[0].branches.find(b=>b.id===branch.id).address,'Новый адрес');
 const hidden=mergeVenueCatalog([{id:branch.id,isPublished:false}]);
 assert.ok(!venueNetworkGroups(hidden)[0].branches.some(b=>b.id===branch.id));
 assert.ok(venueNetworkGroups(hidden)[0].branches.some(b=>b.id===other.id));
 const removed=mergeVenueCatalog(groups[0].branches.map(b=>({id:b.id,archived:true})));
 assert.ok(!venueNetworkGroups(removed).some(g=>g.id===groups[0].id));
});
