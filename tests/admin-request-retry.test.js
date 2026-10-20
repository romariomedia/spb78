import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
test('admin create preserves retry key after lost response even without storage',async()=>{
 const calls=[];let fail=true;globalThis.__adminRetryFetch=async(path,options)=>{calls.push(JSON.parse(options.body));if(fail)throw Error('connection lost');return {ok:true,json:async()=>({ok:true})};};
 const result=await build({entryPoints:['src/services/adminRequest.ts'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'mock',setup(b){b.onResolve({filter:/\.\/apiEndpoint|\.\/adminAuth/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.endsWith('adminAuth')?'export const getAdminSession=()=>({sessionId:"s"});':'export const apiFetch=(...args)=>globalThis.__adminRetryFetch(...args);',loader:'js'}));}}]});
 const {adminPost}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const body={operation:'create',partner:{name:'Partner'}};
 await assert.rejects(adminPost('/api/admin-partners',body),/connection lost/);
 fail=false;await adminPost('/api/admin-partners',body);assert.equal(calls[0].requestId,calls[1].requestId);
 await adminPost('/api/admin-partners',body);assert.notEqual(calls[1].requestId,calls[2].requestId);
 delete globalThis.__adminRetryFetch;
});
