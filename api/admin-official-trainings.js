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
const statuses=new Set(['draft','published','completed','cancelled']);
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
  const status=statuses.has(input.officialStatus)?input.officialStatus:(existing.officialStatus||'draft');
  const startsAt=Date.parse(`${date}T${time}:00+03:00`);
  if((status==='published'||status==='draft')&&startsAt<=Date.now())throw Object.assign(new Error('Официальная тренировка должна быть запланирована на будущее время (МСК).'),{status:400});
  const lat=Number(input.lat??existing.lat),lng=Number(input.lng??existing.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Object.assign(new Error('Выберите корректную площадку или координаты.'),{status:400});
  const participantsMax=Number(input.participantsMax??existing.participantsMax);
  if(!Number.isInteger(participantsMax)||participantsMax<2||participantsMax>100)throw Object.assign(new Error('Лимит участников: от 2 до 100.'),{status:400});
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
      await db.collection('trainings').doc(id).create(doc);
      await writeAdminAudit(db,session,{action:'officialTraining.create',entityType:'training',entityId:id,after:doc,requestId:String(body.requestId||'')});
      return res.json({training:doc});
    }

    const id=clean(body.id,140);
    if(!id||id.includes('/'))return res.status(400).json({error:'Training id required.'});
    const ref=db.collection('trainings').doc(id),snap=await ref.get();
    if(!snap.exists)return res.status(404).json({error:'Тренировка не найдена.'});
    const before=snap.data()||{};
    if(before.isOfficial!==true)return res.status(403).json({error:'Можно управлять только официальными тренировками SportBuddy78.'});

    if(op==='update'){
      if(before.isCompleted===true)return res.status(409).json({error:'Завершённую тренировку нельзя редактировать.'});
      const next=sanitize(body.training||{},before);
      const after={...before,...next,updatedAt:new Date().toISOString(),updatedBy:String(session.email||'admin')};
      await ref.set(after,{merge:false});
      await writeAdminAudit(db,session,{action:'officialTraining.update',entityType:'training',entityId:id,before,after,requestId:String(body.requestId||'')});
      return res.json({training:after});
    }

    if(op==='complete'){
      if(before.isCompleted===true)return res.json({training:before});
      const now=new Date().toISOString();
      const after={...before,isCompleted:true,officialStatus:'completed',completedAt:now,updatedAt:now,updatedBy:String(session.email||'admin')};
      const chatRef=db.collection('chats').doc(`training_${id}`);
      await db.runTransaction(async tx=>{
        const chatSnap=await tx.get(chatRef);
        tx.set(ref,after,{merge:false});
        if(chatSnap.exists)tx.set(chatRef,{...chatSnap.data(),archivedAt:now,participantIds:Array.isArray(before.participantIds)?before.participantIds:[]},{merge:true});
      });
      await writeAdminAudit(db,session,{action:'officialTraining.complete',entityType:'training',entityId:id,before,after,requestId:String(body.requestId||'')});
      return res.json({training:after});
    }

    if(op==='cancel'){
      if(before.isCompleted===true)return res.status(409).json({error:'Завершённую тренировку нельзя отменить.'});
      const now=new Date().toISOString(),after={...before,officialStatus:'cancelled',cancelledAt:now,updatedAt:now,updatedBy:String(session.email||'admin')};
      const chatRef=db.collection('chats').doc(`training_${id}`);
      await db.runTransaction(async tx=>{
        const chatSnap=await tx.get(chatRef);
        tx.set(ref,after,{merge:false});
        if(chatSnap.exists)tx.set(chatRef,{...chatSnap.data(),archivedAt:now,participantIds:Array.isArray(before.participantIds)?before.participantIds:[]},{merge:true});
      });
      await writeAdminAudit(db,session,{action:'officialTraining.cancel',entityType:'training',entityId:id,before,after,requestId:String(body.requestId||'')});
      return res.json({training:after});
    }

    if(op==='delete'){
      if(Array.isArray(before.participantIds)&&before.participantIds.length>0)return res.status(409).json({error:'Нельзя удалить тренировку с участниками. Отмените её — история участников сохранится.'});
      await ref.delete();
      const chatRef=db.collection('chats').doc(`training_${id}`);const chatSnap=await chatRef.get();if(chatSnap.exists)await chatRef.delete();
      await writeAdminAudit(db,session,{action:'officialTraining.delete',entityType:'training',entityId:id,before,after:null,requestId:String(body.requestId||'')});
      return res.json({ok:true});
    }

    return res.status(400).json({error:'Unknown operation.'});
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-official-trainings]',error);
    return res.status(status).json({error:status===500?'Official training administration failed.':error.message});
  }
}
