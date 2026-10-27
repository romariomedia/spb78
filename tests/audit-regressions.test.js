import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

async function load(file){
 const result=await build({entryPoints:[file],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake',setup(b){
 b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{
 'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
 'firebase-admin/auth':'export const getAuth=()=>({verifyIdToken:async()=>({uid:"u"})});',
 'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__auditDb;export const FieldPath={documentId:()=>"__name__"};'
 }[a.path],loader:'js'}));}}]});
 return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const {privacyRequestPage}=await load('server/privacy-request-page.js');
const {enforceLegalAcceptance,requiresLegalAcceptance}=await load('server/legal-acceptance-gate.js');
const {readGuestCatalog}=await load('server/guest-catalog.js');
const venues=(await load('api/venues.js')).default,massage=(await load('api/massage.js')).default;
function dbFor(rows){return {collection(name){let filters=[],orders=[],after=null,max=Infinity;return {
 doc(id){return {get:async()=>({exists:!!rows[name]?.[id],data:()=>rows[name]?.[id]})};},
 where(field,op,value){filters.push([field,value]);return this;},orderBy(field,dir){orders.push([field,dir]);return this;},startAfter(...values){after=values;return this;},limit(n){max=n;return this;},
 async get(){let docs=Object.entries(rows[name]||{}).map(([id,data])=>({id,data:()=>data})).filter(d=>filters.every(([f,v])=>d.data()[f]===v));
 const value=(d,f)=>f==='__name__'?d.id:d.data()[f];const compare=(a,b)=>{for(let i=0;i<orders.length;i++){const [f,dir]=orders[i],av=value(a,f),bv=Array.isArray(b)?b[i]:value(b,f);if(av!==bv)return (av<bv?-1:1)*(dir==='desc'?-1:1);}return 0;};
 docs.sort(compare);if(after)docs=docs.filter(d=>compare(d,after)>0);return {docs:docs.slice(0,max)};
 }
 };}};}
function response(){return {statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}

test('privacy pagination reaches every request beyond old limits, ties are stable and owner is isolated',async()=>{
 const rows={privacyRequests:{}};for(let i=0;i<231;i++)rows.privacyRequests['r'+String(i).padStart(3,'0')]={ownerUserId:i%2?'u':'v',createdAt:new Date(Date.UTC(2026,9,1,0,Math.floor(i/3))).toISOString()};
 const db=dbFor(rows);
 for(const ownerUserId of [undefined,'u']){
  const ids=[];let cursor=null;do{const page=await privacyRequestPage(db,{ownerUserId,cursor});ids.push(...page.docs.map(d=>d.id));cursor=page.nextCursor;}while(cursor);
  const expected=Object.entries(rows.privacyRequests).filter(([,r])=>!ownerUserId||r.ownerUserId===ownerUserId).sort((a,b)=>b[1].createdAt.localeCompare(a[1].createdAt)||b[0].localeCompare(a[0])).map(([id])=>id);
  assert.deepEqual(ids,expected);assert.equal(new Set(ids).size,ids.length);
 }
 await assert.rejects(privacyRequestPage(db,{cursor:{id:'bad/path',createdAt:'x'}}),e=>e.status===400);
});

test('catalog endpoints enforce beta pause and expose granted promotion using actual billing policy',async()=>{
 const now=Date.now;Date.now=()=>Date.parse('2026-10-27T10:00:00Z');
 try{
  const rows={users:{u:{}},venues:{paused:{name:'Paused'},promoted:{name:'Promoted'},normal:{name:'Normal'}},massageServices:{},businessSubscriptions:{}};
  for(const id of ['paused','promoted','normal']){
   rows.massageServices[id]={name:id,description:'Описание услуг массажа',address:'СПб',priceText:'от 1000',bookingUrl:'https://example.com',isPublished:true};
   for(const type of ['venue','massage'])rows.businessSubscriptions[type+id]={subjectType:type,subjectId:id,adminPaused:id==='paused',promotedUntil:id==='promoted'?'2026-12-01T00:00:00Z':''};
  }
  globalThis.__auditDb=dbFor(rows);
  const v=response();await venues({method:'GET'},v);assert.equal(v.statusCode,200);assert.equal(v.body.venues.find(x=>x.id==='paused').isPublished,false);assert.equal(v.body.venues.find(x=>x.id==='promoted').isPromoted,true);
  const m=response();await massage({method:'GET',headers:{authorization:'Bearer token'}},m);assert.equal(m.statusCode,200);assert.deepEqual(m.body.items.map(x=>x.id),['promoted','normal']);
  const guest=await readGuestCatalog(globalThis.__auditDb,'massage');assert.deepEqual(guest.map(x=>x.id),['promoted','normal']);
  const guestVenues=await readGuestCatalog(globalThis.__auditDb,'venues');assert.equal(guestVenues.find(x=>x.id==='paused').isPublished,false);
 }finally{Date.now=now;}
});

test('server consent gate blocks old clients, permits acceptance/privacy and resumes after explicit acceptance',async()=>{
 const rows={legalAcceptances:{}};globalThis.__auditDb=dbFor(rows);
 const req={method:'POST',headers:{authorization:'Bearer token'},body:{action:'training',operation:'createTraining'}};
 const res=response();assert.equal(await enforceLegalAcceptance('sportbuddy-mutation',req,res),true);assert.equal(res.statusCode,428);assert.equal(res.body.code,'LEGAL_ACCEPTANCE_REQUIRED');
 for(const name of ['legal-acceptance','privacy-request','admin-privacy-requests','payment-webhook','vk-login'])assert.equal(requiresLegalAcceptance(name,req),false);
 assert.equal(requiresLegalAcceptance('sport-passport',{...req,body:{action:'setPublic',enabled:false}}),false);
 rows.legalAcceptances['u:terms:2026-10-26']={};assert.equal(await enforceLegalAcceptance('feed-create',req,response()),true);
 rows.legalAcceptances['u:personal_data:2026-10-26']={};assert.equal(await enforceLegalAcceptance('feed-create',req,response()),false);
 globalThis.__auditDb={collection(){throw Error('offline')}};const unavailable=response();assert.equal(await enforceLegalAcceptance('feed-create',req,unavailable),true);assert.equal(unavailable.statusCode,503);
});
