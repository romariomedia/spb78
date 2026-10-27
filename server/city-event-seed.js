import {eventStart} from '../shared/event-time.js';
export const CITY_EVENT_SEED_ID='spb-sport-2026-10';
const START=Date.parse('2026-10-22T00:00:00+03:00');
const END=Date.parse('2026-11-27T00:00:00+03:00');
const norm=value=>String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]/gu,'');
const team=value=>norm(value).replace(/санктпетербург|новосибирск|махачкала|москва/g,'').replace(/шанхайскиедраконы|шанхайдрагонс/g,'шанхайдрэгонс');
export function sameCityFixture(a,b){
 if(a.category!=='spectator'||a.sport!==b.sport)return false;
 const day=v=>new Date(eventStart(v)).toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'});
 if(!Number.isFinite(eventStart(a))||day(a)!==day(b))return false;
 if(norm(a.title)===norm(b.title))return true;
 return !!(a.homeTeam&&a.awayTeam&&team(a.homeTeam)===team(b.homeTeam)&&team(a.awayTeam)===team(b.awayTeam));
}
export function validateCityEventCatalog(entries){
 const ids=new Set();
 for(const item of entries){
  if(!/^evt-spb-2026-[a-z0-9-]+$/.test(item.id)||ids.has(item.id))throw new Error('Invalid or duplicate event ID');
  ids.add(item.id);
  if(!['Хоккей','Футбол','Баскетбол','Волейбол'].includes(item.sport)||item.category!=='spectator'||item.audienceMode!=='spectator'||item.status!=='published')throw new Error('Invalid event category');
  if(!Number.isFinite(item.startsAt)||item.startsAt<START||item.startsAt>=END||Date.parse(`${item.dateKey}T${item.time}:00+03:00`)!==item.startsAt)throw new Error('Invalid Moscow event time');
  for(const k of ['title','description','locationName','address','homeTeam','awayTeam','ticketSourceName'])if(typeof item[k]!=='string'||!item[k].trim())throw new Error(`Missing ${k}`);
  for(const k of ['coverUrl','officialSourceUrl','ticketUrl']){const u=new URL(item[k]);if(u.protocol!=='https:'||u.username||u.password)throw new Error(`Unsafe ${k}`);}
  if(!Number.isFinite(item.lat)||!Number.isFinite(item.lng)||item.lat<59||item.lat>61||item.lng<29||item.lng>31)throw new Error('Invalid SPb coordinates');
  if(item.ticketVerified!==true||item.isOfficial!==false||item.participantIds?.length!==0||item.participantsMax!==100)throw new Error('Invalid attendance defaults');
 }
 return entries;
}
/** Create-only import; receipts preserve later admin deletions. */
export async function seedCityEvents(db,entries,{apply=false,now=Date.now()}={}){
 validateCityEventCatalog(entries);
 const results=[];
 for(const item of entries){
  if(item.startsAt<=now){results.push({id:item.id,status:'past-skipped'});continue;}
  const ref=db.collection('events').doc(item.id);
  const receipt=db.collection('catalogImports').doc(`${CITY_EVENT_SEED_ID}-${item.id}`);
  const query=db.collection('events').where('category','==','spectator');
  results.push(await db.runTransaction(async tx=>{
   const [old,done,existing]=await Promise.all([tx.get(ref),tx.get(receipt),tx.get(query)]);
   const duplicate=existing.docs.find(d=>sameCityFixture(d.data(),item));
   const status=done.exists?'already-imported':old.exists?'existing-preserved':duplicate?'duplicate-preserved':apply?'created':'would-create';
   if(apply&&!done.exists){
    if(!old.exists&&!duplicate)tx.create(ref,{...item,ticketVerifiedAt:new Date(now).toISOString(),ticketVerifiedBy:`catalog:${CITY_EVENT_SEED_ID}`});
    tx.create(receipt,{catalog:CITY_EVENT_SEED_ID,entityId:item.id,existingId:old.exists?item.id:duplicate?.id||null,status,importedAtMs:now});
   }
   return {id:item.id,status,...(duplicate?{existingId:duplicate.id}:{})};
  }));
 }
 return results;
}
