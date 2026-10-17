import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/services/useDeferredFeed.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'fake',setup(b){
 b.onResolve({filter:/^(react|\.\/repository)$/},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({loader:'js',contents:a.path==='react'
 ?'export const useState=(...a)=>globalThis.__feedHarness.state(...a),useEffect=(...a)=>globalThis.__feedHarness.effect(...a),useCallback=(f)=>f;'
 :'export let CURRENT_USER_ID="alice";export function setUid(id){CURRENT_USER_ID=id;} export const loadFeedPosts=(options)=>globalThis.__feedHarness.load(options);'}));
}}]});
const {useDeferredFeed}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function harness(){
 const values=[],effects=[],listeners=new Set();let index=0,pending=[];const calls=[],received=[];
 globalThis.document={visibilityState:'visible',addEventListener:(_e,f)=>listeners.add(f),removeEventListener:(_e,f)=>listeners.delete(f)};
 const h={
 state(initial){const i=index++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v;}];},
 effect(fn,deps){const i=index++;if(!effects[i]||deps.some((d,n)=>d!==effects[i].deps[n]))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});},
 load(options){calls.push(options);return h.response();},response:async()=>[{id:'fresh'}],
 render(enabled=true,uid='alice'){globalThis.__feedHarness=h;index=0;pending=[];const result=useDeferredFeed(uid,enabled,onPosts);pending.forEach(f=>f());return result;},
 hide(){document.visibilityState='hidden';listeners.forEach(f=>f());},show(){document.visibilityState='visible';listeners.forEach(f=>f());},
 close(){effects.forEach(e=>e?.cleanup?.());},calls,received
 };const onPosts=posts=>received.push(posts);return h;
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('offscreen invalidations do not read feed; opening coalesces a burst',async()=>{
 const h=harness();try{
 let ui=h.render(false);for(let i=0;i<10;i++){ui.refreshFeed();ui=h.render(false);}
 await pause(330);assert.equal(h.calls.length,0);
 ui=h.render();ui.refreshFeed();ui=h.render();ui.refreshFeed();h.render();
 await pause(330);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0],{strict:true});assert.equal(h.received.length,1);
 }finally{h.close();}
});
test('hidden document defers reads until return; cancelled response cannot replace posts',async()=>{
 const h=harness();try{
 h.render();h.hide();h.render();await pause(330);assert.equal(h.calls.length,0);
 let finish;h.response=()=>new Promise(resolve=>{finish=resolve;});h.show();h.render();await pause(330);assert.equal(h.calls.length,1);
 h.render(false);finish([{id:'late'}]);await pause(0);assert.equal(h.received.length,0);
 }finally{h.close();}
});
test('failed refresh preserves displayed posts and supports explicit retry',async()=>{
 const h=harness();try{
 h.response=async()=>{throw Error('offline')};h.render();await pause(330);let ui=h.render();assert.ok(ui.feedError);assert.equal(h.received.length,0);
 h.response=async()=>[{id:'recovered'}];ui.refreshFeed();h.render();await pause(330);ui=h.render();assert.equal(ui.feedError,'');assert.equal(h.received[0][0].id,'recovered');
 }finally{h.close();}
});
