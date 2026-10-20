import test from 'node:test';
import assert from 'node:assert/strict';
import {readAdminPage} from '../server/admin-page.js';
import {officialTrainingNotification as notice} from '../server/official-training-notification.js';
test('admin pages use snapshot cursor, preserve tied dates, and report deleted cursor',async()=>{
 const docs=Array.from({length:105},(_,i)=>({id:String(i),exists:true,data:()=>({updatedAtMs:1})}));
 const query=(offset=0,limit=999)=>({orderBy:()=>query(offset,limit),doc:id=>({get:async()=>docs.find(d=>d.id===id)||{exists:false}}),startAfter:s=>query(docs.indexOf(s)+1,limit),limit:n=>query(offset,n),get:async()=>({docs:docs.slice(offset,offset+limit)})});
 const a=await readAdminPage(query()),b=await readAdminPage(query(),a.nextCursor),c=await readAdminPage(query(),b.nextCursor);
 assert.equal(new Set([...a.items,...b.items,...c.items].map(x=>x.id)).size,105);assert.equal(c.nextCursor,null);
 await assert.rejects(readAdminPage(query(),'deleted'),e=>e.status===409);
 await assert.rejects(readAdminPage(query(),'a/b'),e=>e.status===400);
});
test('official notices cover lifecycle without notifying on identical save or empty audience',()=>{
 const before={participantIds:['u','u'],officialStatus:'published',title:'Бег',time:'10:00'};
 assert.equal(notice(before,{...before},'t',1),null);
 assert.equal(notice({...before,participantIds:[]},{...before,time:'11:00'},'t',1),null);
 for(const [patch,kind] of [[{time:'11:00'},'training_update'],[{officialStatus:'draft'},'training_hidden'],[{officialStatus:'cancelled'},'training_cancelled'],[{isCompleted:true},'training_completed']]){
 const n=notice(before,{...before,...patch},'t',1);assert.equal(n.kind,kind);assert.deepEqual(n.recipients,['u']);
 }
});
