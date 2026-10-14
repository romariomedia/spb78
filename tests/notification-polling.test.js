import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const b=await build({entryPoints:['src/services/notificationPolling.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {pollNotificationInbox}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
test('native inbox never overlaps requests or delivers another account response',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0,resolve,current=true;const delivered=[];
 const stop=pollNotificationInbox({read:()=>{calls++;return new Promise(r=>resolve=r)},isCurrent:()=>current,isVisible:()=>true,onData:d=>delivered.push(d),onError:()=>{}});
 t.mock.timers.tick(60000);assert.equal(calls,1);
 current=false;resolve(['private']);await Promise.resolve();assert.deepEqual(delivered,[]);
 stop();t.mock.timers.tick(60000);assert.equal(calls,1);
});
test('native inbox skips hidden app, reports failure and recovers',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let visible=false,fail=true,calls=0;const errors=[],items=[];
 const stop=pollNotificationInbox({read:async()=>{calls++;if(fail)throw Error('offline');return ['new']},isCurrent:()=>true,isVisible:()=>visible,onData:d=>items.push(d),onError:e=>errors.push(e)});
 assert.equal(calls,0);visible=true;t.mock.timers.tick(15000);await Promise.resolve();assert.deepEqual(errors,[true]);
 fail=false;t.mock.timers.tick(15000);await Promise.resolve();assert.deepEqual(errors,[true,false]);assert.deepEqual(items,[['new']]);stop();
});
