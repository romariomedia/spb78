import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/services/friendRealtime.ts'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake-firestore',setup(b){
 b.onResolve({filter:/^firebase\/firestore$|lib\/firebase$/},args=>({path:args.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},args=>({loader:'js',contents:args.path.endsWith('lib/firebase')?'export const db={};':`
 export const collection=(_,name)=>({name});
 export const where=(field,op,value)=>({field,op,value});
 export const query=(ref,filter)=>({...ref,filter});
 export const onSnapshot=(ref,options,next,error)=>{const item={ref,options,next,error,stopped:false};globalThis.friendListeners.push(item);return()=>{item.stopped=true;};};
 `}));
}}]});
const api=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const snapshot=(rows,fromCache=false)=>({metadata:{fromCache},docs:rows.map((data,i)=>({id:String(i),data:()=>data}))});
test('incoming and outgoing subscriptions select the signed-in user and expose only pending requests',()=>{
 globalThis.friendListeners=[];
 const incoming=[],outgoing=[];
 const stops=[api.subscribeIncomingFriendRequests('b',r=>incoming.push(r)),api.subscribeOutgoingFriendRequests('b',r=>outgoing.push(r))];
 const [a,b]=globalThis.friendListeners;
 assert.deepEqual(a.ref.filter,{field:'toId',op:'==',value:'b'});assert.deepEqual(b.ref.filter,{field:'fromId',op:'==',value:'b'});
 b.next(snapshot([{fromId:'b',toId:'a',status:'accepted',createdAt:1},{fromId:'b',toId:'c',status:'pending',createdAt:2}]));
 assert.deepEqual(outgoing[0].map(r=>r.toId),['c']);
 b.next(snapshot([]));assert.deepEqual(outgoing[1],[]);
 stops.forEach(s=>s());assert.ok(globalThis.friendListeners.every(l=>l.stopped));
});
test('cache and errors do not erase relationships; retry recovers and cleanup blocks late callbacks',t=>{
 t.mock.timers.enable({apis:['setTimeout']});globalThis.friendListeners=[];
 const states=[],errors=[];
 const stop=api.subscribeFriendships('b',ids=>states.push(ids),failed=>errors.push(failed));
 const first=globalThis.friendListeners[0];
 assert.equal(first.options.includeMetadataChanges,true);
 first.next(snapshot([{participantIds:['a','b']}],true));assert.deepEqual(states,[]);
 first.next(snapshot([{participantIds:['a','b']}]));assert.deepEqual(states,[['a']]);
 first.error(Error('permission-denied'));assert.deepEqual(states,[['a']]);assert.deepEqual(errors,[false,true]);
 t.mock.timers.tick(15000);assert.equal(globalThis.friendListeners.length,2);
 const retry=globalThis.friendListeners[1];retry.next(snapshot([]));assert.deepEqual(states,[['a'],[]]);
 stop();retry.next(snapshot([{participantIds:['b','c']}]));retry.error(Error());t.mock.timers.tick(30000);
 assert.deepEqual(states,[['a'],[]]);assert.equal(globalThis.friendListeners.length,2);assert.ok(retry.stopped);
});
