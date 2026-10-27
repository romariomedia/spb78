import test from 'node:test';
import assert from 'node:assert/strict';
import {guestItem,readGuestCatalog,createGuestReader} from '../server/guest-catalog.js';
import {effectiveOperations,operationDenial} from '../shared/operational-policy.js';
const now=Date.parse('2026-10-19T12:00:00Z');
test('guest training projection omits identity, coordinates, private copy and participant arrays',()=>{
 const item=guestItem('trainings','t',{title:'Бег',sport:'Бег',dateKey:'2026-10-20',participantIds:['secret1','secret2'],createdBy:'owner',email:'private',phone:'private',description:'private',address:'private',lat:60,lng:30,checkedInUserIds:['secret1'],ratedParticipantIds:['secret2']},now);
 assert.equal(item.participantCount,2);
 const json=JSON.stringify(item);for(const secret of ['secret1','secret2','private','owner','createdBy','lat','lng'])assert.ok(!json.includes(secret),secret);
 for(const patch of [{isHidden:true},{isCompleted:true},{cancelledAt:1},{isOfficial:true,officialStatus:'draft'},{dateKey:'2026-10-18'}])assert.equal(guestItem('trainings','t',{...patch},now),null);
 assert.ok(guestItem('trainings','t',{isOfficial:true,officialStatus:'published'},now));
});
test('guest editorial cards respect publication and strip direct booking and internal fields',()=>{
 for(const section of ['events','massage','partners','leisure']){
  const data={name:'Название',title:'Событие',isPublished:true,status:'published',isActive:true,bookingUrl:'https://private.example',phone:'secret',internalNotes:'secret',createdBy:'secret',participantIds:['secret']};
  assert.ok(!JSON.stringify(guestItem(section,'id',data,now)).includes('secret'));
  assert.equal(guestItem(section,'id',{...data,isPublished:false},now),null);
 }
 assert.equal(guestItem('events','id',{status:'draft'},now),null);
 assert.equal(guestItem('events','id',{status:'published',startsAt:1},now),null);
 assert.equal(guestItem('massage','id',{}),null);
 assert.equal(guestItem('partners','id',{isActive:true,startAt:'broken'}),null);
 assert.equal(guestItem('events','id',{status:'published',coverUrl:'javascript:alert(1)'},now).photo,'');
});
test('guest catalog never reads users, chats or messages and hidden seed venues stay hidden',async()=>{
 const reads=[];
 const db={collection(name){reads.push(name);return {doc(){return {get:async()=>({exists:false})};},where(){return this;},limit(){return this;},get:async()=>({docs:[{id:'hidden',data:()=>({name:'Private name',isPublished:false,archived:true})}]})};}};
 assert.deepEqual(await readGuestCatalog(db,'venues'),[{id:'hidden',isPublished:false}]);
 await assert.rejects(()=>readGuestCatalog(db,'users'),{status:400});assert.deepEqual(reads,['venues','billingConfig','businessSubscriptions']);
});
test('anonymous catalog coalesces reads and never caches failures',async()=>{
 let calls=0,resolve;const read=createGuestReader(()=>{calls++;return new Promise(r=>resolve=r);});
 const a=read('events'),b=read('events');await Promise.resolve();assert.equal(calls,1);resolve([{id:'a'}]);assert.deepEqual(await a,await b);await read('events');assert.equal(calls,1);
 let errors=0;const bad=createGuestReader(()=>{errors++;throw Error('offline');});await assert.rejects(()=>bad('events'));await assert.rejects(()=>bad('events'));assert.equal(errors,2);
});
test('maintenance and disabled leisure also protect guest catalog',()=>{
 const config=effectiveOperations({operationsVersion:1,featureFlags:{activeLeisureEnabled:false}});
 assert.equal(operationDenial(config,'guest-catalog','leisure').status,403);
 assert.equal(operationDenial({...config,maintenanceMode:true},'guest-catalog','events').status,503);
});
