import {districtLabel} from '../shared/districts.js';
import {LEISURE_CATALOG} from '../shared/leisure-destinations.js';
import {businessListingStates,getBillingConfig} from './business-billing.js';
const text=(v,n=300)=>typeof v==='string'?v.slice(0,n):'';
const image=v=>{const s=text(v,1800);if(/^\/(?!\/)[a-zA-Z0-9_./-]+$/.test(s))return s;try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?s:'';}catch{return '';}};
export const GUEST_SECTIONS=['trainings','events','leisure','massage','partners','venues'];
/** Anonymous projection: never serialize source objects, members, profiles or precise personal meeting points. */
export function guestItem(section,id,v,now=Date.now()){
 if(!v||v.archived===true||v.isHidden===true||v.adminHidden===true||v.isPublished===false)return null;
 if(section==='trainings'){
  if(v.isCompleted||v.cancelledAt||(v.isOfficial===true&&v.officialStatus!=='published'))return null;
  if(typeof v.dateKey==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.dateKey)&&v.dateKey<new Date(now+3*3600000).toISOString().slice(0,10))return null;
  return {id,title:text(v.title,160),sport:text(v.sport,60),date:text(v.dateLabel,80),time:text(v.time,30),label:v.isOfficial?'Тренировка SportBuddy78':'Тренировка сообщества',address:text(v.venueName||districtLabel(v.districtId),160),description:'Точное место встречи и участие доступны после входа.',participantCount:Array.isArray(v.participantIds)?v.participantIds.length:0,capacity:Number.isFinite(v.participantsMax)?v.participantsMax:0};
 }
 if(section==='events'){
  if(v.status!=='published'||(Number(v.startsAt)>0&&Number(v.startsAt)<now))return null;
  return {id,title:text(v.title,160),description:text(v.description,2500),photo:image(v.coverUrl),date:text(v.dateLabel,80),time:text(v.time,30),address:text(v.locationName||v.address),sport:text(v.sport,60),label:'Афиша Петербурга'};
 }
 if(section==='massage'){
  if(v.isPublished!==true)return null;
  return {id,title:text(v.name,100),description:text(v.description,5000),services:text(v.services,2000),price:text(v.priceText,1500),address:text(v.address),label:v.providerType==='private'?'Частный специалист':'Массажный салон',photo:image(v.media?.find(m=>m.type==='image')?.url),isPromoted:v.isPromoted===true};
 }
 if(section==='partners'){
  if(v.isActive!==true||(v.startAt&&(!Number.isFinite(Date.parse(v.startAt))||Date.parse(v.startAt)>now))||(v.endAt&&(!Number.isFinite(Date.parse(v.endAt))||Date.parse(v.endAt)<=now)))return null;
  return {id,title:text(v.offerTitle,160),description:text(v.description,700),photo:image(v.coverUrl||v.logoUrl),label:text(v.name,100)};
 }
 if(section==='leisure')return {id,title:text(v.name,160),description:text(v.description,2500),photo:image(v.photo),label:text(v.format||'Активный отдых',100),address:text(v.address||v.region),price:text(v.priceText,500),services:text(v.plan,1800)};
 if(section==='venues'){
  const result={id};for(const key of ['name','networkId','sports','address','coordinates','hours','priceText','photos','status','isPublished','checkedAt','isPromoted'])if(v[key]!==undefined)result[key]=v[key];return result;
 }
 return null;
}
export async function readGuestCatalog(db,section,now=Date.now()){
 if(!GUEST_SECTIONS.includes(section))throw Object.assign(new Error('Неизвестный раздел'),{status:400});
 if(section==='partners'){
  const config=await db.collection('partnerConfig').doc('main').get();
  if(!config.exists||config.data().visible!==true)return [];
 }
 const collection={trainings:'trainings',events:'events',leisure:'leisureDestinations',massage:'massageServices',partners:'partners',venues:'venues'}[section];
 let query=db.collection(collection);
 if(section==='massage')query=query.where('isPublished','==',true);
 if(section==='events')query=query.where('status','==','published');
 if(section==='partners')query=query.where('isActive','==',true);
 const snap=await query.limit(section==='venues'?400:200).get();
 let rows=snap.docs.map(doc=>({id:doc.id,value:doc.data()}));
 if(section==='massage'||section==='venues'){
  const billingConfig=await getBillingConfig(db);
  const subjectType=section==='massage'?'massage':'venue';
  const states=await businessListingStates(db,subjectType,rows.map(row=>row.id),billingConfig,now);
  rows=rows.map(row=>{
   const state=states.get(row.id);
   if(state?.allowed!==true)return section==='venues'?{id:row.id,value:{isPublished:false,commercialInactive:true}}:null;
   return state?.isPromoted?{...row,value:{...row.value,isPromoted:true}}:row;
  }).filter(Boolean).sort((a,b)=>Number(b.value?.isPromoted===true)-Number(a.value?.isPromoted===true));
 }
 if(section==='leisure'){
  const map=new Map(LEISURE_CATALOG.map(v=>[v.id,{id:v.id,value:v}]));for(const row of rows)map.set(row.id,row);rows=[...map.values()];
 }
 // Tombstones must survive merging the client venue seed, without leaking hidden content.
 return rows.map(({id,value})=>section==='venues'&&(value.isPublished===false||value.archived===true)?{id,isPublished:false}:guestItem(section,id,value,now)).filter(Boolean);
}
export function createGuestReader(read,ttl=30000){
 const cache=new Map(),pending=new Map();
 return async section=>{
  const cached=cache.get(section);if(cached&&cached.until>Date.now())return cached.items;
  if(pending.has(section))return pending.get(section);
  const request=Promise.resolve().then(()=>read(section)).then(items=>{cache.set(section,{items,until:Date.now()+ttl});return items;}).finally(()=>pending.delete(section));
  pending.set(section,request);return request;
 };
}
