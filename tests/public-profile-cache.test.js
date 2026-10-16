import test from 'node:test';
import assert from 'node:assert/strict';
import {createPageCache,publicProfileCache,invalidatePublicProfiles,affectsPublicProfiles} from '../server/public-profile-cache.js';
test('100 simultaneous page requests share one read; expiry reloads',async()=>{
 let time=0,reads=0;const cache=createPageCache({ttlMs:30,now:()=>time});
 const loader=async()=>{reads++;return {profiles:[{id:'athlete'}],nextCursor:null};};
 const results=await Promise.all(Array.from({length:100},()=>cache.get('',loader)));
 assert.equal(reads,1);assert.equal(results.length,100);
 await cache.get('',loader);assert.equal(reads,1);
 time=30;await cache.get('',loader);assert.equal(reads,2);
});
test('failure is not cached and retry works',async()=>{
 const cache=createPageCache();
 await assert.rejects(cache.get('',async()=>{throw Error('offline');}));
 assert.deepEqual(await cache.get('',async()=>({profiles:[]})),{profiles:[]});
 assert.equal(cache.stats().failures,1);
});
test('entry and byte limits bound retained pages',async()=>{
 const cache=createPageCache({maxEntries:2,maxBytes:30});
 for(let i=0;i<20;i++)await cache.get(String(i),async()=>'1234567890');
 assert.ok(cache.stats().entries<=2);assert.ok(cache.stats().bytes<=30);
 let reads=0;for(let i=0;i<2;i++)await cache.get('large',async()=>{reads++;return 'x'.repeat(100);});
 assert.equal(reads,2);
});
test('invalidating in-flight page prevents its retention',async()=>{
 const cache=createPageCache();let finish;
 const pending=cache.get('',()=>new Promise(resolve=>{finish=resolve;}));
 await Promise.resolve();cache.clear();finish('old');
 assert.equal(await pending,'old');assert.equal(cache.stats().entries,0);
 assert.equal(await cache.get('',async()=>'new'),'new');
});
test('database isolation and successful mutation invalidation',async()=>{
 const first={},second={};
 assert.equal(await publicProfileCache(first).get('',async()=>'first'),'first');
 assert.equal(await publicProfileCache(second).get('',async()=>'second'),'second');
 invalidatePublicProfiles();
 assert.equal(await publicProfileCache(first).get('',async()=>'changed'),'changed');
 assert.equal(affectsPublicProfiles('sportbuddy-mutation',{action:'profile'}),true);
 assert.equal(affectsPublicProfiles('admin-users',{action:'suspend'}),true);
 assert.equal(affectsPublicProfiles('sportbuddy-mutation',{action:'chat'}),false);
});
