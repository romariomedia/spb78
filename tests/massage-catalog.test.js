import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sanitizeMassage,publicMassage} from '../server/massage.js';
import {guestItem} from '../server/guest-catalog.js';
import {seedMassageCatalog} from '../server/massage-seed.js';
const catalog=JSON.parse(readFileSync(new URL('../data/massage-spb.json',import.meta.url),'utf8'));
test('ten distinct publishable SPA branches have real local covers and sourced review snapshots',()=>{
 assert.equal(catalog.length,10);assert.equal(new Set(catalog.map(v=>v.id)).size,10);
 const hashes=[];
 for(const {id,...item} of catalog){
  const clean=sanitizeMassage(item);assert.equal(clean.isPublished,true);assert.equal(clean.providerType,'salon');
  assert.ok(clean.research.reviewCount>=100);assert.equal(clean.research.checkedAt,'2026-10-21');
  const path=new URL('../public'+new URL(clean.media[0].url).pathname,import.meta.url);assert.ok(existsSync(path));
  const bytes=readFileSync(path);assert.ok(bytes.length>10000);hashes.push(createHash('sha256').update(bytes).digest('hex'));
  assert.equal(guestItem('massage',id,item).photo,clean.media[0].url);
  assert.equal(publicMassage(id,item).research.rating,5);
 }
 assert.equal(new Set(hashes).size,10);
});
test('research survives ordinary admin edits, can be removed, and rejects unsafe URLs',()=>{
 const item=catalog[0];assert.deepEqual(sanitizeMassage({name:'Новое имя'},item).research,item.research);
 assert.equal(sanitizeMassage({research:null},item).research,undefined);
 assert.throws(()=>sanitizeMassage({...item,research:{...item.research,reviewUrl:'javascript:alert(1)'}}));
 assert.throws(()=>sanitizeMassage({...item,research:{...item.research,rating:6}}));
 assert.equal(publicMassage('id',{...item,internalNotes:'secret'}).internalNotes,undefined);
});
function mockDb(){
 const docs=new Map();return {docs,collection:name=>({doc:id=>`${name}/${id}`}),async runTransaction(fn){
 const writes=[];const result=await fn({get:async ref=>({exists:docs.has(ref),data:()=>docs.get(ref)}),create:(ref,data)=>{assert.ok(!docs.has(ref));writes.push([ref,data]);}});
 for(const [key,value] of writes)docs.set(key,value);return result;
 }};
}
test('SPA import dry-run, rerun, admin edit, hiding and deletion are safe',async()=>{
 const db=mockDb(),rows=catalog.slice(0,2);
 assert.ok((await seedMassageCatalog(db,rows)).every(v=>v.status==='would-create'));assert.equal(db.docs.size,0);
 await seedMassageCatalog(db,rows,{apply:true});assert.equal(db.docs.size,4);
 const key=`massageServices/${rows[0].id}`;db.docs.set(key,{name:'Admin edit',isPublished:false});
 db.docs.delete(`massageServices/${rows[1].id}`);
 assert.ok((await seedMassageCatalog(db,rows,{apply:true})).every(v=>v.status==='already-imported'));
 assert.deepEqual(db.docs.get(key),{name:'Admin edit',isPublished:false});assert.equal(db.docs.size,3);
});
test('pre-existing entry is never overwritten and import validates all entries before writing',async()=>{
 const db=mockDb(),key=`massageServices/${catalog[0].id}`;db.docs.set(key,{name:'Existing'});
 assert.equal((await seedMassageCatalog(db,[catalog[0]],{apply:true}))[0].status,'existing-preserved');
 assert.deepEqual(db.docs.get(key),{name:'Existing'});
 const fresh=mockDb();await assert.rejects(seedMassageCatalog(fresh,[catalog[0],{...catalog[1],bookingUrl:'http://unsafe.test'}],{apply:true}));assert.equal(fresh.docs.size,0);
});
