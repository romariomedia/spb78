import { createHash } from 'node:crypto';
import { hasPremiumAccess } from '../shared/access-policy.js';
import { LEISURE_DESTINATIONS, getLeisureDestination } from '../shared/leisure-destinations.js';
import { enqueueNotification } from './notification-policy.js';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(id);
export function leisureInput(body,now=Date.now(),resolvedPlace=null) {
 const place=resolvedPlace||getLeisureDestination(body.destinationId);
 if(!place)throw fail('Выберите направление из каталога');
 const date=text(body.date,10),time=text(body.time,5);
 const startsAt=Date.parse(`${date}T${time}:00+03:00`);
 const parsed=new Date(date+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!Number.isFinite(startsAt)||startsAt<=now||startsAt>now+366*86400000)throw fail('Выберите будущую дату и время в пределах года (МСК)');
 const title=text(body.title,120),meetingPoint=text(body.meetingPoint,300),description=text(body.description,2000),transport=text(body.transport,300),costs=text(body.costs,300);
 if(title.length<3||meetingPoint.length<5||transport.length<3||costs.length<3)throw fail('Заполните название, место сбора, транспорт и расходы');
 const capacity=body.capacity;
 if(!Number.isInteger(capacity)||capacity<2||capacity>30)throw fail('Количество участников: от 2 до 30, включая организатора');
 const participantGender=body.participantGender||'any';
 if(!['any','male','female'].includes(participantGender))throw fail('Некорректный фильтр участников');
 return {destinationId:place.id,region:place.region,title,date,time,startsAt,meetingPoint,description,transport,costs,capacity,participantGender};
}
export async function createLeisure(db,uid,body,now=Date.now()) {
 if(!validId(body.requestId))throw fail('Некорректный идентификатор встречи');
 const id='out_'+createHash('sha256').update(uid+':'+body.requestId).digest('hex').slice(0,40);
 const ref=db.collection('leisureEvents').doc(id),userRef=db.collection('users').doc(uid),quota=db.collection('leisureQuotas').doc(uid);
 // Stable request identity makes retry after a lost response safe, even after the start time.
 return db.runTransaction(async tx=>{
  const old=await tx.get(ref);if(old.exists)return old.data();
  const destinationRef=db.collection('leisureDestinations').doc(text(body.destinationId,100));
  const userSnap=await tx.get(userRef),q=await tx.get(quota),managedPlace=await tx.get(destinationRef);if(!userSnap.exists)throw fail('Сначала заполните профиль',403);
  const user=userSnap.data();if(!hasPremiumAccess(user,now))throw fail('Создание встреч доступно с Premium',403);
  const place=managedPlace.exists?(managedPlace.data().isPublished===false?null:{id:managedPlace.id,...managedPlace.data()}):getLeisureDestination(body.destinationId);
  const data=leisureInput(body,now,place),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const count=q.data()?.day===day?Number(q.data().count||0):0;if(count>=5)throw fail('Можно создать до 5 встреч в день',429);
  const event={id,...data,createdBy:uid,organizerName:text(user.name,120)||'Участник',participantIds:[uid],status:'open',createdAt:now,updatedAt:now};
  tx.create(ref,event);tx.set(quota,{day,count:count+1});
  enqueueNotification(tx,db,{id:`leisure-new:${id}`,actorId:uid,broadcast:true,category:'events',kind:'leisure_new',entityId:id,title:'Новая встреча: активный отдых',message:event.title,link:'#leisure='+id});
  return event;
 });
}
export async function changeLeisure(db,uid,id,operation,now=Date.now()) {
 if(!validId(id)||!['join','leave','cancel'].includes(operation))throw fail('Некорректное действие');
 const ref=db.collection('leisureEvents').doc(id);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw fail('Встреча не найдена',404);
  const event=snap.data(),members=event.participantIds||[];
  if(operation==='cancel') {
   if(event.createdBy!==uid)throw fail('Отменить встречу может только организатор',403);
   if(event.status==='cancelled')return event;
   const next={...event,status:'cancelled',updatedAt:now};tx.update(ref,{status:'cancelled',updatedAt:now});
   enqueueNotification(tx,db,{id:`leisure-cancel:${id}`,actorId:uid,recipients:members,category:'events',kind:'leisure_cancel',title:'Встреча отменена',message:event.title,link:'#leisure='+id});return next;
  }
  if(operation==='leave') {
   if(uid===event.createdBy)throw fail('Организатор может отменить встречу, но не выйти из неё');
   if(!members.includes(uid))return event;
   const next=members.filter(x=>x!==uid);tx.update(ref,{participantIds:next,updatedAt:now});
   enqueueNotification(tx,db,{id:`leisure-leave:${id}:${uid}:${now}`,actorId:uid,recipients:[event.createdBy],category:'events',kind:'leisure_leave',title:'Участник вышел из встречи',message:event.title,link:'#leisure='+id});return {...event,participantIds:next,updatedAt:now};
  }
  if(event.status!=='open'||event.startsAt<=now)throw fail('Запись на эту встречу закрыта',409);
  if(members.includes(uid))return event;
  const user=await tx.get(db.collection('users').doc(uid)),owner=await tx.get(db.collection('users').doc(event.createdBy));
  if(!user.exists||!owner.exists)throw fail('Профиль участника или организатора недоступен',403);
  if((user.data().blockedUserIds||[]).includes(event.createdBy)||(owner.data().blockedUserIds||[]).includes(uid))throw fail('Запись недоступна',403);
  if(event.participantGender!=='any'&&(user.data().genderSet===false||user.data().gender!==event.participantGender))throw fail('Встреча ограничена по полу участников',403);
  if(members.length>=event.capacity)throw fail('Все места заняты',409);
  const next=[...members,uid];tx.update(ref,{participantIds:next,updatedAt:now});
  enqueueNotification(tx,db,{id:`leisure-join:${id}:${uid}:${now}`,actorId:uid,recipients:[event.createdBy],category:'events',kind:'leisure_join',title:'Новый участник встречи',message:`${text(user.data().name,100)||'Участник'}: ${event.title}`,link:'#leisure='+id});
  return {...event,participantIds:next,updatedAt:now};
 });
}
export async function listLeisure(db,cursor,now=Date.now()) {
 let query=db.collection('leisureEvents').where('startsAt','>=',now-86400000).orderBy('startsAt','asc');
 if(cursor){if(!validId(cursor))throw fail('Некорректная страница');const doc=await db.collection('leisureEvents').doc(cursor).get();if(doc.exists)query=query.startAfter(doc);}
 const page=await query.limit(40).get();return {events:page.docs.map(d=>d.data()),next:page.docs.length===40?page.docs.at(-1).id:null};
}
export async function readLeisure(db,id){if(!validId(id))throw fail('Некорректная встреча');const snap=await db.collection('leisureEvents').doc(id).get();if(!snap.exists)throw fail('Встреча не найдена',404);return snap.data();}


export async function listLeisureDestinations(db) {
 const snap=await db.collection('leisureDestinations').orderBy('name').get().catch(()=>null);
 if(snap && !snap.empty) return snap.docs
   .map(doc=>({id:doc.id,...doc.data()}))
   .filter(place=>place.isPublished!==false);
 return LEISURE_DESTINATIONS.map(place=>({...place,isPublished:true}));
}
