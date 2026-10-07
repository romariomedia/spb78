import test from 'node:test';
import assert from 'node:assert/strict';
import {listVerificationRequests} from '../server/verification-queue.js';
function fixture(){
 const rows=Array.from({length:180},(_,i)=>({id:i.toString(16).padStart(64,'0'),status:i<65?'pending':'approved',updatedAtMs:i}));
 const snap=row=>({id:row?.id,exists:!!row,data:()=>row});
 const db={collection:()=>{let filtered=[...rows];return {where(_key,_op,status){filtered=filtered.filter(x=>x.status===status);return this;},orderBy(){filtered.sort((a,b)=>b.updatedAtMs-a.updatedAtMs);return this;},startAfter(doc){filtered=filtered.filter(x=>x.updatedAtMs<doc.data().updatedAtMs);return this;},limit(n){filtered=filtered.slice(0,n);return this;},get:async()=>({docs:filtered.map(snap)}),doc:id=>({get:async()=>snap(rows.find(x=>x.id===id))})};}};
 return db;
}
test('old pending requests remain reachable despite more than 100 newer decisions',async()=>{
 const db=fixture(),first=await listVerificationRequests(db,{});
 assert.equal(first.requests.length,50);assert.ok(first.requests.every(x=>x.status==='pending'));
 const last=await listVerificationRequests(db,{cursor:first.nextCursor});
 assert.equal(last.requests.length,15);assert.equal(last.nextCursor,null);
 assert.equal(new Set([...first.requests,...last.requests].map(x=>x.id)).size,65);
});
test('verification queue validates status and cursor',async()=>{
 await assert.rejects(listVerificationRequests(fixture(),{status:'forged'}),e=>e.status===400);
 await assert.rejects(listVerificationRequests(fixture(),{cursor:'../../secret'}),e=>e.status===400);
});
