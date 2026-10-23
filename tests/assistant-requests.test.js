import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssistantRequests} from '../src/services/assistantRequests.js';
function setup(){const calls=[],results=[],errors=[],busy=[];const client=createAssistantRequests(body=>new Promise((resolve,reject)=>calls.push({body,resolve,reject})),{result:value=>results.push(value),error:value=>errors.push(value),busy:value=>busy.push(value)});return{client,calls,results,errors,busy};}
test('initial loading prevents overlapping mutations and stale state replacement',async()=>{
 const h=setup(),first=h.client.run({action:'state'});
 await h.client.run({action:'read'});assert.equal(h.calls.length,1);
 h.calls[0].resolve({welcomeRead:false});await first;
 const next=h.client.run({action:'read'});h.calls[1].resolve({welcomeRead:true});await next;
 assert.deepEqual(h.results,[{welcomeRead:false},{welcomeRead:true}]);
});
test('retry repeats failed Later mutation rather than reading state',async()=>{
 const h=setup(),p=h.client.run({action:'read'});h.calls[0].reject(new Error('offline'));await p;
 assert.ok(h.errors.at(-1));const retry=h.client.retry();assert.deepEqual(h.calls[1].body,{action:'read'});
 h.calls[1].resolve({welcomeRead:true});await retry;assert.equal(h.results[0].welcomeRead,true);
});
test('lost answer retry keeps original idempotency key and blocks duplicate clicks',async()=>{
 const h=setup(),body={action:'ask',topicId:'premium',requestId:'request-1234'};
 const p=h.client.run(body);h.calls[0].reject(new Error('lost response'));await p;
 const retry=h.client.retry();await h.client.retry();assert.equal(h.calls.length,2);assert.deepEqual(h.calls[1].body,body);
 h.calls[1].resolve({ok:true});await retry;
});
test('unmounted account ignores late results and state changes',async()=>{
 for(const fail of [false,true]){const h=setup(),p=h.client.run({action:'state'});h.client.dispose();const before=h.busy.length;
 if(fail)h.calls[0].reject(new Error('offline'));else h.calls[0].resolve({private:true});await p;
 assert.equal(h.results.length,0);assert.equal(h.busy.length,before);assert.equal(h.errors.at(-1),'');}
});
