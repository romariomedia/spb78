import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createLeisure,changeLeisure,leisureInput,listLeisure} from '../server/leisure.js';
import {LEISURE_DESTINATIONS} from '../shared/leisure-destinations.js';
const now=Date.parse('2026-10-06T12:00:00+03:00');
const draft=(extra={})=>({requestId:'request-test-123',destinationId:'ruskeala',title:'Вместе в Рускеалу',date:'2026-10-10',time:'09:00',meetingPoint:'Санкт-Петербург, Финляндский вокзал',transport:'Поезд, билеты каждый покупает сам',costs:'Дорога и билет в парк отдельно',description:'Прогулка вокруг каньона',capacity:2,participantGender:'any',...extra});
function fixture(){
 const records=new Map(['a','b','c'].map(id=>['users/'+id,{name:id,gender:'female',genderSet:true,sports:['Активный отдых']} ]));
 const snap=ref=>({id:ref.id,exists:records.has(ref.path),data:()=>structuredClone(records.get(ref.path))});
 let queue=Promise.resolve();
 const db={collection(name){
  const query={filters:[],after:null,cap:100,where(k,op,v){this.filters.push([k,op,v]);return this;},orderBy(){return this;},startAfter(doc){this.after=doc;return this;},limit(n){this.cap=n;return this;},async get(){let rows=[...records.entries()].filter(([k,v])=>k.startsWith(name+'/')&&this.filters.every(([f,op,x])=>op==='>='?v[f]>=x:v[f]===x)).sort((a,b)=>a[1].startsAt-b[1].startsAt||a[0].localeCompare(b[0]));if(this.after)rows=rows.slice(rows.findIndex(([k])=>k===name+'/'+this.after.id)+1);return {docs:rows.slice(0,this.cap).map(([k])=>snap({id:k.split('/')[1],path:k}))};}};
  return {...query,doc(id){const ref={id,path:name+'/'+id,get:async()=>snap(ref)};return ref;}};
 },runTransaction(callback){
   const run=queue.then(async()=>{const writes=[];let wrote=false;const tx={get:async ref=>{assert.equal(wrote,false,'read before write');return snap(ref);}};
    for(const kind of ['create','set','update'])tx[kind]=(ref,value)=>{wrote=true;assert.ok(!JSON.stringify(value).includes('undefined'));writes.push(()=>{if(kind==='create')assert.equal(records.has(ref.path),false);records.set(ref.path,structuredClone(kind==='update'?{...records.get(ref.path),...value}:value));});};
    const result=await callback(tx);writes.forEach(fn=>fn());return result;
   });queue=run.catch(()=>{});return run;
 }};return {db,records};
}
test('leisure creation is isolated from workouts, retries do not duplicate events or quota',async()=>{
 const f=fixture();const a=await createLeisure(f.db,'a',draft({createdBy:'b',participantIds:['b'],totalWorkouts:999}),now);
 const b=await createLeisure(f.db,'a',draft(),now);assert.equal(a.id,b.id);assert.equal(a.createdBy,'a');assert.deepEqual(a.participantIds,['a']);
 assert.equal(f.records.get('leisureQuotas/a').count,1);assert.equal([...f.records.keys()].some(k=>k.startsWith('trainings/')||k.startsWith('workoutCredits/')),false);assert.equal(f.records.get('users/a').totalWorkouts,undefined);
});
test('last leisure place cannot be taken twice; join and leave are retry safe',async()=>{
 const f=fixture(),event=await createLeisure(f.db,'a',draft(),now);
 const results=await Promise.allSettled(['b','c'].map(uid=>changeLeisure(f.db,uid,event.id,'join',now)));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const member=f.records.get('leisureEvents/'+event.id).participantIds[1];
 assert.equal((await changeLeisure(f.db,member,event.id,'join',now)).participantIds.length,2);
 assert.equal((await changeLeisure(f.db,member,event.id,'leave',now)).participantIds.length,1);
 assert.equal((await changeLeisure(f.db,member,event.id,'leave',now)).participantIds.length,1);
});
test('only organizer cancels; cancellation notifies participants and prevents joining',async()=>{
 const f=fixture(),event=await createLeisure(f.db,'a',draft({capacity:3}),now);await changeLeisure(f.db,'b',event.id,'join',now);
 await assert.rejects(changeLeisure(f.db,'b',event.id,'cancel',now),e=>e.status===403);
 await assert.rejects(changeLeisure(f.db,'a',event.id,'leave',now));
 const result=await changeLeisure(f.db,'a',event.id,'cancel',now);assert.equal(result.status,'cancelled');
 await assert.rejects(changeLeisure(f.db,'c',event.id,'join',now),e=>e.status===409);
 const job=[...f.records.values()].find(x=>x.kind==='leisure_cancel');assert.deepEqual(job.recipients,['a','b']);assert.equal(job.link,'#leisure='+event.id);
 const count=f.records.size;await changeLeisure(f.db,'a',event.id,'cancel',now);assert.equal(count,f.records.size);
});
test('leisure validates destination, real date, future start, capacity, meeting and gender',()=>{
 for(const extra of [{destinationId:'fake'},{date:'2026-02-30'},{date:'2026-01-01'},{time:'24:01'},{capacity:31},{capacity:'3'},{meetingPoint:''},{transport:''},{costs:''},{participantGender:'forged'}])assert.throws(()=>leisureInput(draft(extra),now));
 assert.equal(leisureInput(draft(),now).startsAt,Date.parse('2026-10-10T09:00:00+03:00'));
});
test('leisure enforces stored gender and blocking, limits daily creation, respects Premium deadline',async()=>{
 const f=fixture(),event=await createLeisure(f.db,'a',draft({participantGender:'male'}),now);
 await assert.rejects(changeLeisure(f.db,'b',event.id,'join',now),e=>e.status===403);
 f.records.set('users/b',{gender:'male',blockedUserIds:['a']});await assert.rejects(changeLeisure(f.db,'b',event.id,'join',now),e=>e.status===403);
 for(let n=1;n<5;n++)await createLeisure(f.db,'a',draft({requestId:'new-request-'+n}),now);
 await assert.rejects(createLeisure(f.db,'a',draft({requestId:'new-request-6'}),now),e=>e.status===429);
 await assert.rejects(createLeisure(f.db,'c',draft({date:'2027-01-10'}),Date.parse('2027-01-01T00:00:00+03:00')),e=>e.status===403);
});
test('leisure list pagination orders dates and does not require a compound index',async()=>{
 const f=fixture();for(let n=0;n<42;n++)f.records.set('leisureEvents/event-'+String(n).padStart(4,'0'),{id:'event-'+String(n).padStart(4,'0'),startsAt:now+n*1000});
 const first=await listLeisure(f.db,undefined,now);assert.equal(first.events.length,40);const last=await listLeisure(f.db,first.next,now);assert.equal(last.events.length,2);assert.equal(last.next,null);
});
test('all three regions have distinct real lightweight destination photos and official sources',async()=>{
 assert.equal(LEISURE_DESTINATIONS.length,9);const hashes=new Set();
 for(const region of ['spb','lo','karelia'])assert.equal(LEISURE_DESTINATIONS.filter(x=>x.region===region).length,3);
 for(const d of LEISURE_DESTINATIONS){assert.match(d.source,/^https:\/\//);assert.ok(d.photoCredit);const path='public'+d.photo;const info=await stat(path);assert.ok(info.size>10000&&info.size<450000);hashes.add(createHash('sha256').update(await readFile(path)).digest('hex'));}
 assert.equal(hashes.size,9);
});
