import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession,writeAdminAudit } from '../server/admin-control.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
const clean=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const operation=String(body.operation||'list');
    const eventId=clean(body.eventId,180);
    if(!eventId||eventId.includes('/'))return res.status(400).json({error:'Event id required.'});
    const result=await db.runTransaction(async tx=>{
    const eventSnap=await tx.get(db.collection('events').doc(eventId));
    if(!eventSnap.exists)throw Object.assign(new Error('Соревнование не найдено.'),{status:404});
    const event=eventSnap.data()||{};
    if(event.category!=='competition')throw Object.assign(new Error('Результаты SportBuddy78 доступны только для соревнований.'),{status:409});

    if(operation==='list'){
      const participantIds=Array.isArray(event.participantIds)?event.participantIds.map(String).slice(0,100):[];
      const [users,results]=await Promise.all([
        Promise.all(participantIds.map(async id=>{const s=await db.collection('users').doc(id).get();const u=s.data()||{};return{id,name:clean(u.name,120)||'Спортсмен',avatar:clean(u.avatar,1200)};})),
        db.collection('sportPassportResults').where('eventId','==',eventId).get()
      ]);
      return ({
        event:{id:eventId,title:clean(event.title,180),sport:clean(event.sport,80),status:clean(event.status,30)},
        participants:users,
        results:(results?.docs||[]).map(d=>({id:d.id,...d.data()}))
      });
    }

    if(event.status!=='finished')throw Object.assign(new Error('Фиксировать результаты можно только после завершения соревнования.'),{status:409});
    const userId=clean(body.userId,180);
    if(!(Array.isArray(event.participantIds)&&event.participantIds.includes(userId)))throw Object.assign(new Error('Пользователь не зарегистрирован на этом соревновании.'),{status:409});
    const resultId=eventId+'__'+userId;
    const ref=db.collection('sportPassportResults').doc(resultId);
    const beforeSnap=await tx.get(ref),before=beforeSnap.exists?beforeSnap.data():null;

    if(operation==='record'){
      const placement=clean(body.placement,80);
      if(placement.length<1)throw Object.assign(new Error('Укажите место или результат.'),{status:400});
      const userSnap=await tx.get(db.collection('users').doc(userId));
      if(!userSnap.exists)throw Object.assign(new Error('Пользователь не найден.'),{status:404});
      const value={
        id:resultId,userId,eventId,eventTitle:clean(event.title,180),sport:clean(event.sport,80),
        title:clean(body.title,180)||placement,placement,status:'verified',source:'sportbuddy',
        achievedAt:Number(body.achievedAt)||Date.now(),updatedAt:new Date().toISOString(),
        verifiedBy:String(session.email||'admin')
      };
      tx.set(ref,value,{merge:false});
      await writeAdminAudit(db,session,{action:'sportId.result.record',entityType:'sportPassportResult',entityId:resultId,before,after:value,requestId:String(body.requestId||'')},tx);
      return ({ok:true,result:value});
    }

    if(operation==='revoke'){
      if(!beforeSnap.exists)throw Object.assign(new Error('Результат не найден.'),{status:404});
      tx.delete(ref);
      await writeAdminAudit(db,session,{action:'sportId.result.revoke',entityType:'sportPassportResult',entityId:resultId,before,after:null,requestId:String(body.requestId||'')},tx);
      return ({ok:true});
    }

    throw Object.assign(new Error('Unknown operation.'),{status:400});
    });
    return res.json(result);
  }catch(error){
    const status=Number(error?.status||500);if(status===500)console.error('[admin-event-results]',error);
    return res.status(status).json({error:status===500?'Competition results unavailable.':error.message});
  }
}
