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
    const eventSnap=await db.collection('events').doc(eventId).get();
    if(!eventSnap.exists)return res.status(404).json({error:'Соревнование не найдено.'});
    const event=eventSnap.data()||{};
    if(event.category!=='competition')return res.status(409).json({error:'Результаты SportBuddy78 доступны только для соревнований.'});

    if(operation==='list'){
      const participantIds=Array.isArray(event.participantIds)?event.participantIds.map(String).slice(0,100):[];
      const [users,results]=await Promise.all([
        Promise.all(participantIds.map(async id=>{const s=await db.collection('users').doc(id).get();const u=s.data()||{};return{id,name:clean(u.name,120)||'Спортсмен',avatar:clean(u.avatar,1200)};})),
        db.collection('sportPassportResults').where('eventId','==',eventId).get().catch(()=>null)
      ]);
      return res.json({
        event:{id:eventId,title:clean(event.title,180),sport:clean(event.sport,80),status:clean(event.status,30)},
        participants:users,
        results:(results?.docs||[]).map(d=>({id:d.id,...d.data()}))
      });
    }

    if(event.status!=='finished')return res.status(409).json({error:'Фиксировать результаты можно только после завершения соревнования.'});
    const userId=clean(body.userId,180);
    if(!(Array.isArray(event.participantIds)&&event.participantIds.includes(userId)))return res.status(409).json({error:'Пользователь не зарегистрирован на этом соревновании.'});
    const resultId=eventId+'__'+userId;
    const ref=db.collection('sportPassportResults').doc(resultId);
    const beforeSnap=await ref.get(),before=beforeSnap.exists?beforeSnap.data():null;

    if(operation==='record'){
      const placement=clean(body.placement,80);
      if(placement.length<1)return res.status(400).json({error:'Укажите место или результат.'});
      const userSnap=await db.collection('users').doc(userId).get();
      if(!userSnap.exists)return res.status(404).json({error:'Пользователь не найден.'});
      const value={
        id:resultId,userId,eventId,eventTitle:clean(event.title,180),sport:clean(event.sport,80),
        title:clean(body.title,180)||placement,placement,status:'verified',source:'sportbuddy',
        achievedAt:Number(body.achievedAt)||Date.now(),updatedAt:new Date().toISOString(),
        verifiedBy:String(session.email||'admin')
      };
      await ref.set(value,{merge:false});
      await writeAdminAudit(db,session,{action:'sportId.result.record',entityType:'sportPassportResult',entityId:resultId,before,after:value,requestId:String(body.requestId||'')});
      return res.json({ok:true,result:value});
    }

    if(operation==='revoke'){
      if(!beforeSnap.exists)return res.status(404).json({error:'Результат не найден.'});
      await ref.delete();
      await writeAdminAudit(db,session,{action:'sportId.result.revoke',entityType:'sportPassportResult',entityId:resultId,before,after:null,requestId:String(body.requestId||'')});
      return res.json({ok:true});
    }

    return res.status(400).json({error:'Unknown operation.'});
  }catch(error){
    const status=Number(error?.status||500);if(status===500)console.error('[admin-event-results]',error);
    return res.status(status).json({error:status===500?'Competition results unavailable.':error.message});
  }
}
