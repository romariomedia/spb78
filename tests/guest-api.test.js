import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const b=await build({entryPoints:['api/guest-catalog.js'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake-admin',setup(b){
 b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:a.path==='firebase-admin/app'?'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;':'export const getFirestore=()=>globalThis.__guestDb;',loader:'js'}));
}}]});
const handler=(await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))).default;
const request=async(method,section)=>{const r={code:200,status(n){this.code=n;return this;},json(v){this.body=v;return this;},setHeader(){}};await handler({method,query:{section},headers:{}},r);return r;};
test('anonymous guest GET is read-only, bounded to known sections and returns safe data',async()=>{
 let reads=0;globalThis.__guestDb={collection(name){assert.equal(name,'trainings');return {limit(n){assert.equal(n,200);return this;},get:async()=>{reads++;return {docs:[{id:'t',data:()=>({title:'Бег',participantIds:['private'],createdBy:'private'})}]};}};}};
 for(const method of ['POST','PUT','DELETE'])assert.equal((await request(method,'trainings')).code,405);
 assert.equal((await request('GET','users')).code,400);assert.equal((await request('GET',['trainings'])).code,400);assert.equal(reads,0);
 const result=await request('GET','trainings');assert.equal(result.code,200);assert.equal(result.body.items[0].title,'Бег');assert.ok(!JSON.stringify(result.body).includes('private'));assert.equal(reads,1);
});
