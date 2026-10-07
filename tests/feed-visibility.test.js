import test from 'node:test';
import assert from 'node:assert/strict';
import {backfillFeedVisibility} from '../server/feed-visibility.js';
function fixture(){
 const records=new Map([['old',{content:'legacy'}],['hidden',{isHidden:true}],['shown',{isHidden:false}]]);
 let beforeTransaction=()=>{};
 const snap=id=>({id,ref:{id},exists:records.has(id),data:()=>({...records.get(id)})});
 const db={collection:()=>{let cursor='';return {orderBy(){return this;},limit(){return this;},startAfter(doc){cursor=doc.id;return this;},async get(){const docs=[...records.keys()].sort().filter(id=>id>cursor).map(snap);return {docs,empty:!docs.length};}};},
  runTransaction:async fn=>{beforeTransaction();return fn({get:async ref=>snap(ref.id),update:(ref,patch)=>records.set(ref.id,{...records.get(ref.id),...patch})});}};
 return {db,records,setBefore:fn=>{beforeTransaction=fn;}};
}
test('visibility backfill dry run and repeated apply preserve all moderation decisions',async()=>{
 const f=fixture();
 assert.equal((await backfillFeedVisibility(f.db)).missing,1);assert.equal(f.records.get('old').isHidden,undefined);
 assert.equal((await backfillFeedVisibility(f.db,{apply:true})).updated,1);
 assert.equal(f.records.get('hidden').isHidden,true);assert.equal(f.records.get('shown').isHidden,false);
 assert.equal((await backfillFeedVisibility(f.db,{apply:true})).updated,0);
});
test('a moderator hiding a legacy post during migration always wins',async()=>{
 const f=fixture();f.setBefore(()=>f.records.set('old',{isHidden:true}));
 assert.equal((await backfillFeedVisibility(f.db,{apply:true})).updated,0);
 assert.equal(f.records.get('old').isHidden,true);
});
