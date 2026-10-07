import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/services/trainingRequests.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'fake-api',setup(b){
 b.onResolve({filter:/\.\/serverApi$/},()=>({path:'api',namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export const callServer=(...args)=>globalThis.__trainingApi(...args);',loader:'js'}));
}}]});
const moduleUrl='data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64');
const {createTrainingRequest}=await import(moduleUrl);
const draft={title:'Бег',dateKey:'2027-01-10',time:'18:00'};
function storage(){const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};return values;}
test('lost response retains request ID even when storage is unavailable',async()=>{
 globalThis.localStorage={getItem(){throw Error('disabled')},setItem(){throw Error('disabled')},removeItem(){throw Error('disabled')}};
 const calls=[];globalThis.__trainingApi=async(_path,body)=>{calls.push(body);if(calls.length===1)throw Error('network');return {training:{id:'one'}}};
 await assert.rejects(createTrainingRequest('offline',draft),/network/);
 await createTrainingRequest('offline',draft);assert.equal(calls[0].requestId,calls[1].requestId);
 await createTrainingRequest('offline',draft);assert.notEqual(calls[1].requestId,calls[2].requestId);
});
test('reload restores pending request and accounts cannot reuse each other request ID',async()=>{
 storage();const calls=[];
 globalThis.__trainingApi=async(_path,body)=>{calls.push(body);throw Error('network')};
 await assert.rejects(createTrainingRequest('reload',draft));
 const reloaded=await import(moduleUrl+'#reloaded');
 await assert.rejects(reloaded.createTrainingRequest('reload',draft));
 assert.equal(calls[0].requestId,calls[1].requestId);
 await assert.rejects(reloaded.createTrainingRequest('other-account',draft));
 assert.notEqual(calls[1].requestId,calls[2].requestId);
});
test('concurrent identical clicks share one request and changed draft is rejected while pending',async()=>{
 storage();let resolve,calls=0;
 globalThis.__trainingApi=()=>{calls++;return new Promise(r=>{resolve=r})};
 const first=createTrainingRequest('parallel',draft),second=createTrainingRequest('parallel',draft);
 assert.equal(first,second);assert.equal(calls,1);
 await assert.rejects(createTrainingRequest('parallel',{...draft,title:'Теннис'}),/Дождитесь/);
 resolve({training:{id:'one'}});assert.deepEqual(await first,await second);
});
test('validation failures clear the pending request so corrected input can be submitted',async()=>{
 const values=storage();globalThis.__trainingApi=async()=>{throw Object.assign(Error('validation'),{status:400})};
 await assert.rejects(createTrainingRequest('invalid',draft));assert.equal(values.size,0);
});
