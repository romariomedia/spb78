import { createHash, randomUUID } from 'node:crypto';
import { publicTrainer } from './personal-trainer.js';
import { assertUserActive } from './user-status.js';
import { buildServerChatId } from './chat-policy.js';
import { enqueueNotification } from './notification-policy.js';
import {hasBusinessAccess} from './business-billing.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const idValue=value=>{if(typeof value!=='string'||!value||value.length>1500||value.includes('/'))fail('Некорректный идентификатор.');return value;};
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export const bookingId=(trainerId,clientId)=>createHash('sha256').update(JSON.stringify([trainerId,clientId])).digest('hex');
export function trainerServices(input){
  if(!Number.isSafeInteger(input.hourlyRate)||input.hourlyRate<1||input.hourlyRate>1000000)fail('Укажите стоимость от 1 до 1 000 000 ₽ за 60 минут.');
  return {hourlyRate:input.hourlyRate,serviceDescription:text(input.serviceDescription,1200)};
}
export async function saveTrainerServices(db,uid,input){
  const services=trainerServices(input),ref=db.collection('users').doc(uid);
  return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists)fail('Профиль не найден.',404);
    const user=snap.data();assertUserActive(user);
    if(!user.personalTrainer?.enabled)fail('Сначала включите статус тренера.',409);
    const trainer={...user.personalTrainer,...services};tx.update(ref,{personalTrainer:trainer});return {trainer};
  });
}
export async function mutateTrainerBooking(db,uid,action,body){
  const create=action==='bookingCreate';
  const createTrainerId=create?idValue(body.trainerId):'';
  if(create&&!await hasBusinessAccess(db,'trainer',createTrainerId))fail('Размещение тренера временно неактивно.',409);
  const requestId=create?bookingId(createTrainerId,uid):idValue(body.requestId);
  const ref=db.collection('trainerBookings').doc(requestId);
  return db.runTransaction(async tx=>{
    const before=await tx.get(ref),old=before.exists?before.data():null;
    if(!create&&!old)fail('Заявка не найдена.',404);
    const trainerId=create?body.trainerId:old.trainerId,clientId=create?uid:old.clientId;
    if(trainerId===clientId)fail('Нельзя записаться к себе.');
    if(uid!==trainerId&&uid!==clientId)fail('Нет доступа к заявке.',403);
    const trainerSnap=await tx.get(db.collection('users').doc(trainerId)),clientSnap=await tx.get(db.collection('users').doc(clientId));
    if(!trainerSnap.exists||!clientSnap.exists)fail('Профиль не найден.',404);
    const trainer=trainerSnap.data(),client=clientSnap.data();
    assertUserActive(uid===trainerId?trainer:client);
    const chatId=buildServerChatId(trainerId,clientId),chatRef=db.collection('chats').doc(chatId);
    const chatSnap=await tx.get(chatRef);
    const date=new Date().toISOString();
    if(create){
      if(old&&['pending','accepted'].includes(old.status))return {request:old};
      assertUserActive(trainer);
      if(!publicTrainer(trainer))fail('Этот тренер пока недоступен для записи.',409);
      if(trainer.blockedUserIds?.includes(clientId)||client.blockedUserIds?.includes(trainerId))fail('Запись к этому пользователю недоступна.',403);
      const rate=trainer.personalTrainer.hourlyRate;
      if(!Number.isSafeInteger(rate)||rate<=0)fail('Тренер ещё не указал стоимость услуги.',409);
      if(body.hourlyRate!==rate)fail('Стоимость изменилась. Обновите каталог перед отправкой заявки.',409);
      if(!trainer.personalTrainer.sports.includes(body.sport))fail('Выберите дисциплину этого тренера.');
      const preferredTime=text(body.preferredTime,200),note=text(body.note,600);
      if(!preferredTime)fail('Укажите удобное время для занятия.');
      if(old&&Date.now()-Date.parse(old.updatedAt)<86400000)fail('Повторную заявку можно отправить через 24 часа после отмены или отказа.',429);
      const request={id:requestId,version:randomUUID(),trainerId,clientId,trainerName:text(trainer.name,120)||'Тренер',clientName:text(client.name,120)||'Спортсмен',sport:body.sport,hourlyRate:rate,currency:'RUB',durationMinutes:60,serviceDescription:text(trainer.personalTrainer.serviceDescription,1200),preferredTime,note,status:'pending',createdAt:date,updatedAt:date,chatId:''};
      tx.set(ref,request);
      enqueueNotification(tx,db,{id:`trainer-booking:${requestId}:${request.version}`,actorId:uid,recipients:[trainerId],category:'trainings',kind:'trainer_booking',entityId:requestId,requestVersion:request.version,bookingStatus:'pending',title:'Новая заявка к вам',message:`${request.clientName} хочет записаться: ${request.sport}.`,link:'#trainer-requests'});
      return {request};
    }
    const status=action==='bookingAccept'?'accepted':action==='bookingReject'?'rejected':action==='bookingCancel'?'cancelled':null;
    if(!status)fail('Неизвестное действие.');
    if(status==='cancelled'?uid!==clientId:uid!==trainerId)fail('Нет права изменять эту заявку.',403);
    if(body.version!==old.version)fail('Заявка обновилась. Обновите список.',409);
    if(old.status===status)return {request:old};
    if(old.status!=='pending')fail('Эта заявка уже обработана.',409);
    if(status==='accepted'){
      assertUserActive(client);
      if(!publicTrainer(trainer)||!trainer.personalTrainer.sports.includes(old.sport))fail('Для принятия заявки нужна подтверждённая дисциплина тренера.',409);
      if(trainer.blockedUserIds?.includes(clientId)||client.blockedUserIds?.includes(trainerId))fail('Общение с этим пользователем недоступно.',403);
      // Only this server transaction can grant this additional relationship. No friendship or match is fabricated.
      const existing=chatSnap.exists?chatSnap.data():null;
      if(existing&&(existing.participantIds?.length!==2||!existing.participantIds.includes(uid)||!existing.participantIds.includes(clientId)))fail('Некорректный диалог.',409);
      tx.set(chatRef,{...(existing||{id:chatId,kind:'direct',participantIds:[trainerId,clientId],createdAt:date,lastMessageAt:Date.now(),messages:[],recentMessages:[],readAt:{},unreadCount:{[trainerId]:0,[clientId]:0},messageCount:0}),trainerBookingApproved:true});
    }
    const request={...old,status,updatedAt:date,chatId:status==='accepted'?chatId:''};tx.set(ref,request);
    enqueueNotification(tx,db,{id:`trainer-booking:${requestId}:${old.version}:${status}`,actorId:uid,recipients:[uid===trainerId?clientId:trainerId],category:'trainings',kind:'trainer_booking',entityId:requestId,requestVersion:old.version,bookingStatus:status,title:status==='accepted'?'Тренер принял заявку':status==='rejected'?'Тренер отклонил заявку':'Заявка отменена',message:status==='accepted'?'Откройте чат и согласуйте время и место занятия.':`${old.sport} · ${old.trainerName}`,link:status==='accepted'?'#chat='+encodeURIComponent(chatId):'#trainer-requests'});
    return {request};
  });
}
export async function listTrainerBookings(db,uid,body,documentId){
  const role=body.role==='trainer'?'trainerId':body.role==='client'?'clientId':null;
  if(!role)fail('Выберите список заявок.');
  let q=db.collection('trainerBookings').where(role,'==',uid).orderBy(documentId).limit(20);
  if(body.cursor)q=q.startAfter(idValue(body.cursor));
  const snap=await q.get();return {requests:snap.docs.map(d=>({...d.data(),id:d.id})),nextCursor:snap.docs.length===20?snap.docs.at(-1).id:null};
}
