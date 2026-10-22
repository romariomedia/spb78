import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {seedCityEvents,sameCityFixture,validateCityEventCatalog} from '../server/city-event-seed.js';
const rows=JSON.parse(readFileSync(new URL('../data/city-events-spb-2026-10.json',import.meta.url)));
const sources=JSON.parse(readFileSync(new URL('../data/city-events-spb-2026-10-sources.json',import.meta.url)));
const now=Date.parse('2026-10-22T00:00:00+03:00');
function mockDb(){
 const docs=new Map();return {docs,collection:name=>({doc:id=>`${name}/${id}`,where:()=>({collection:name})}),async runTransaction(fn){
 const writes=[];const result=await fn({get:async ref=>typeof ref==='string'?{exists:docs.has(ref),data:()=>docs.get(ref)}:{docs:[...docs].filter(([k,v])=>k.startsWith(ref.collection+'/')&&v.category==='spectator').map(([k,v])=>({id:k.split('/')[1],data:()=>v}))},create:(ref,data)=>{assert.ok(!docs.has(ref));writes.push([ref,data]);}});
 for(const [k,v] of writes)docs.set(k,v);return result;
 }};
}
test('curated future fixtures have distinct real posters, sources and Moscow dates',()=>{
 validateCityEventCatalog(rows);assert.equal(rows.length,14);assert.equal(sources.length,14);
 const hashes=[];for(const r of rows){const p=new URL('../public'+new URL(r.coverUrl).pathname,import.meta.url);assert.ok(existsSync(p));hashes.push(createHash('sha256').update(readFileSync(p)).digest('hex'));assert.ok(sources.find(v=>v.id===r.id)?.posterUrl.startsWith('https://'));}
 assert.equal(new Set(hashes).size,14);
});
test('dry-run and repeated import preserve hidden edits and later deletions',async()=>{
 const db=mockDb();assert.ok((await seedCityEvents(db,rows,{now})).every(r=>r.status==='would-create'));assert.equal(db.docs.size,0);
 await seedCityEvents(db,rows,{now,apply:true});assert.equal(db.docs.size,28);
 const key='events/'+rows[0].id;db.docs.set(key,{...rows[0],status:'draft',participantIds:['real-user'],title:'Admin edit'});
 db.docs.delete('events/'+rows[1].id);await seedCityEvents(db,rows,{now,apply:true});
 assert.equal(db.docs.get(key).title,'Admin edit');assert.deepEqual(db.docs.get(key).participantIds,['real-user']);assert.ok(!db.docs.has('events/'+rows[1].id));
});
test('same match under manual ID preserves participants and is not duplicated',async()=>{
 const db=mockDb();db.docs.set('events/manual',{...rows[0],title:'Изменённый заголовок',status:'draft',participantIds:['real-user']});
 assert.equal((await seedCityEvents(db,[rows[0]],{now,apply:true}))[0].status,'duplicate-preserved');assert.ok(!db.docs.has('events/'+rows[0].id));assert.deepEqual(db.docs.get('events/manual').participantIds,['real-user']);
 assert.ok(!sameCityFixture({...rows[0],sport:'Футбол'},rows[0]));
});
test('past events are skipped and invalid batch never partially writes',async()=>{
 const db=mockDb();assert.equal((await seedCityEvents(db,[rows[0]],{now:rows[0].startsAt,apply:true}))[0].status,'past-skipped');assert.equal(db.docs.size,0);
 await assert.rejects(seedCityEvents(db,[rows[0],{...rows[1],ticketUrl:'http://unsafe.example'}],{now,apply:true}));assert.equal(db.docs.size,0);
});
