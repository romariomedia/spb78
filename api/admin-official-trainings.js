import { randomUUID } from 'node:crypto';
import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession,writeAdminAudit } from '../server/admin-control.js';
import { validateDistrictId } from '../shared/districts.js';

if(!getApps().length){
  initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
}

const OFFICIAL_OWNER='sportbuddy78-official';
const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const statuses=new Set(['draft','published']);
const levels=new Set(['amateur','semi-pro','pro']);
const genders=new Set(['any','male','female']);

function dateKey(value){
  const v=clean(value,10);
  const d=new Date(v+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v){
    throw Object.assign(new Error('Укажите корректную дату.'),{status:400});
  }
  return v;
}
function timeValue(value){
  const v=clean(value,5);
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Object.assign(new Error('Укажите корректное время.'),{status:400});
  return v;
}
function sanitize(input={},existing={}){
  const title=clean(input.title??existing.title,120);
  if(title.length<2)throw Object.assign(new Error('Укажите название тренировки.'),{status:400});
  const sport=clean(input.sport??existing.sport,80);
  if(!sport)throw Object.assign(new Error('Выберите вид спорта.'),{status:400});
  const date=dateKey(input.dateKey??existing.dateKey);
  const time=timeValue(input.time??existing.time);
  if(input.officialStatus!==undefined&&!statuses.has(input.officialStatus))throw Object.assign(new Error('Для завершения или отмены используйте отдельную операцию.'),{status:400});
  const status=input.officialStatus??existing.officialStatus??'draft';
  const startsAt=Date.parse(`${date}T${time}:00+03:00`);
  if((status==='published'||status==='draft')&&startsAt<=Date.now())throw Object.assign(new Error('Официальная тренировка должна быть запланирована на будущее время (МСК).'),{status:400});
  const lat=input.lat===undefined?existing.lat:input.lat,lng=input.lng===undefined?existing.lng:input.lng;
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Object.assign(new Error('Выберите корректную площадку или координаты.'),{status:400});
  const participantsMax=Number(input.participantsMax??existing.participantsMax);
  if(!Number.isInteger(participantsMax)||participantsMax<2||participantsMax>100)throw Object.assign(new Error('Лимит участников: от 2 до 100.'),{status:400});
  if(participantsMax<(existing.participantIds||[]).length)throw Object.assign(new Error('Лимит не может быть меньше числа записавшихся.'),{status:409});
  const participantGender=genders.has(input.participantGender)?input.participantGender:(existing.participantGender||'any');
  const level=levels.has(input.level)?input.level:(existing.level||'amateur');
  const districtId=input.districtId===undefined?(existing.districtId||''):validateDistrictId(input.districtId);
  return {
    title,sport,dateKey:date,dateLabel:clean(input.dateLabel??existing.dateLabel,80)||date,time,
    districtId,locationName:clean(input.locationName??existing.locationName,160),
    address:clean(input.address??existing.address,240),lat,lng,level,participantsMax,participantGender,
    description:clean(input.description??existing.description,2000),
    venueId:clean(input.venueId??existing.venueId,120),venueName:clean(input.venueName??existing.venueName,160),
    officialStatus:status
  };
}
const view=doc=>({id:doc.id,...doc.data()});

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const op=String(body.operation||'list');

    if(op==='list'){
      const snap=await db.collection('trainings').where('isOfficial','==',true).get();
      const trainings=snap.docs.map(view).sort((a,b)=>String(a.dateKey||'').localeCompare(String(b.dateKey||''))||String(a.time||'').localeCompare(String(b.time||'')));
      return res.json({trainings});
    }

    if(op==='create'){
      const value=sanitize(body.training||{});
      const id=`tr_official_${randomUUID()}`,now=new Date().toISOString();
      const doc={
        ...value,id,isOfficial:true,officialOrganizerName:'SportBuddy78',createdBy:OFFICIAL_OWNER,
        participantIds:[],isCompleted:false,checkedInUserIds:[],ratedParticipantIds:[],organizerRatedByParticipantIds:[],
        createdAt:now,updatedAt:now
      };
      await db.runTransaction(async tx=>{
        tx.create(db.collection('trainings').doc(id),doc);
        await writeAdminAudit(db,session,{action:'officialTraining.create',entityType:'training',entityId:id,after:doc,requestId:String(body.requestId||'')},tx);
      });
      return res.json({training:doc});
    }

    const id=clean(body.id,140);
    if(!id||id.includes('/'))return res.status(400).json({error:'Training id required.'});
    if(!['update','complete','cancel','delete'].includes(op))return res.status(400).json({error:'Unknown operation.'});
    const ref=db.collection('trainings').doc(id),chatRef=db.collection('chats').doc(`training_${id}`);
    const result=await db.runTransaction(async tx=>{
      const [snap,chatSnap]=await Promise.all([tx.get(ref),tx.get(chatRef)]);
      if(!snap.exists)throw Object.assign(new Error('Тренировка не найдена.'),{status:404});
      const before=snap.data()||{};
      if(before.isOfficial!==true)throw Object.assign(new Error('Можно управлять только официальными тренировками SportBuddy78.'),{status:403});
      const now=new Date().toISOString();
      let after=null;
      if(op==='delete'){
        if(before.isCompleted===true||(before.participantIds||[]).length)throw Object.assign(new Error('Нельзя удалить завершённую тренировку или тренировку с участниками. Используйте отмену.'),{status:409});
        tx.delete(ref);
        if(chatSnap.exists)tx.delete(chatRef);
      }else{
        if(op==='complete'&&before.isCompleted===true)return {training:before};
        if(before.isCompleted===true||before.officialStatus==='cancelled')throw Object.assign(new Error('Завершённую или отменённую тренировку нельзя изменять.'),{status:409});
        if(op==='complete'&&before.officialStatus!=='published')throw Object.assign(new Error('Завершить можно только опубликованную тренировку.'),{status:409});
        const patch=op==='update'?sanitize(body.training||{},before):op==='complete'
          ?{isCompleted:true,officialStatus:'completed',completedAt:now}
          :{officialStatus:'cancelled',cancelledAt:now};
        after={...before,...patch,updatedAt:now,updatedBy:String(session.email||'admin')};
        tx.set(ref,after,{merge:false});
        if(chatSnap.exists)tx.set(chatRef,{
          archivedAt:after.officialStatus==='published'?null:now,
          participantIds:Array.isArray(after.participantIds)?after.participantIds:[]
        },{merge:true});
      }
      await writeAdminAudit(db,session,{action:`officialTraining.${op}`,entityType:'training',entityId:id,before,after,requestId:String(body.requestId||'')},tx);
      return op==='delete'?{ok:true}:{training:after};
    });
    return res.json(result);

  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-official-trainings]',error);
    return res.status(status).json({error:status===500?'Official training administration failed.':error.message});
  }
}
