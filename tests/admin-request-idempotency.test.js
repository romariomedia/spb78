import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const calls=[];
let failFirst=true;
const built=await build({
  entryPoints:['src/services/adminRequest.ts'],
  bundle:true,format:'esm',platform:'browser',write:false,
  plugins:[{name:'fakes',setup(b){
    b.onResolve({filter:/\.\/apiEndpoint$/},()=>({path:'api',namespace:'fake'}));
    b.onResolve({filter:/\.\/adminAuth$/},()=>({path:'auth',namespace:'fake'}));
    b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:{
      api:`export const apiFetch=async(path,opts)=>{globalThis.__adminCalls.push(JSON.parse(opts.body));if(globalThis.__adminFail){globalThis.__adminFail=false;throw new Error("network lost");}return {ok:true,status:200,json:async()=>({ok:true})};};`,
      auth:'export const getAdminSession=()=>({sessionId:"session-1"});'
    }[args.path],loader:'js'}));
  }}]
});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));

function storage(){
  const data=new Map();
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}

test('lost admin grant response retries with exactly the same requestId',async()=>{
  globalThis.sessionStorage=storage();
  globalThis.__adminCalls=calls;
  globalThis.__adminFail=true;
  calls.length=0;
  const body={operation:'grant',subjectType:'trainer',subjectId:'athlete',days:30,note:'Компенсация партнёру'};
  await assert.rejects(api.adminPost('/api/admin-billing',body),/network lost/);
  await api.adminPost('/api/admin-billing',body);
  assert.equal(calls.length,2);
  assert.ok(calls[0].requestId);
  assert.equal(calls[0].requestId,calls[1].requestId);
});

test('changed grant terms receive a different idempotency key',async()=>{
  globalThis.sessionStorage=storage();
  globalThis.__adminCalls=calls;
  globalThis.__adminFail=true;
  calls.length=0;
  const base={operation:'grant',subjectType:'trainer',subjectId:'athlete',days:30,note:'Компенсация партнёру'};
  await assert.rejects(api.adminPost('/api/admin-billing',base));
  globalThis.__adminFail=true;
  await assert.rejects(api.adminPost('/api/admin-billing',{...base,days:60}));
  assert.notEqual(calls[0].requestId,calls[1].requestId);
});
