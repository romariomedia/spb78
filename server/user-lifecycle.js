import { createHash } from 'node:crypto';

export const ADMIN_EMAIL='support@sportbuddy78.ru';

const countQuery=async query=>{
  try{return Number((await query.count().get()).data().count||0);}
  catch{return Number((await query.get()).size||0);}
};

export function evaluateDeletionSafety({email='',user={},counts={},authDisabled=false}={}){
  const blockers=[];
  if(String(email).toLowerCase()===ADMIN_EMAIL)blockers.push('Основной аккаунт администратора защищён от удаления.');
  if(user.isVerified===true)blockers.push('Верифицированный профиль нельзя удалить через безопасную очистку.');
  if(user.isSuspended!==true||authDisabled!==true)blockers.push('Перед удалением аккаунт должен быть ограничен и отключён в Firebase Auth.');
  if(Number(counts.payments||0)>0||Number(counts.paymentRequests||0)>0)blockers.push('Есть платёжные данные — требуется отдельная процедура хранения/анонимизации.');
  if(Number(counts.ratingsGiven||0)>0||Number(counts.ratingsReceived||0)>0)blockers.push('Есть рейтинги, влияющие на другие профили.');
  if(Number(counts.reportsSent||0)>0||Number(counts.reportsReceived||0)>0)blockers.push('Есть записи модерации/жалобы, которые нельзя удалять обычной очисткой.');
  if(Number(counts.chats||0)>0||Number(counts.friendships||0)>0||Number(counts.friendRequestsFrom||0)>0||Number(counts.friendRequestsTo||0)>0)blockers.push('Есть социальные связи или чаты.');
  if(Number(counts.feed||0)>0||Number(counts.trainingsOwned||0)>0||Number(counts.leisureOwned||0)>0||Number(counts.stories||0)>0)blockers.push('Есть созданный пользователем контент.');
  if(Number(counts.trainingsJoined||0)>0||Number(counts.leisureJoined||0)>0||Number(counts.checkins||0)>0)blockers.push('Есть участие в тренировках или активном отдыхе.');
  if(Number(counts.goals||0)>0||Number(counts.workoutCredits||0)>0||Number(counts.promoCodes||0)>0)blockers.push('Есть прогресс, цели или промокоды.');
  if(String(user.avatar||'').trim()||Array.isArray(user.photoPortfolio)&&user.photoPortfolio.length>0)blockers.push('Есть пользовательские фото — требуется отдельная очистка медиахранилища.');
  if(Number(user.totalWorkouts||0)>0)blockers.push('У профиля есть спортивная история.');
  const activityCount=Object.values(counts).reduce((sum,v)=>sum+Number(v||0),0);
  const signals=[];
  if(user.isVerified!==true)signals.push('не верифицирован');
  if(user.hasRealPhoto!==true)signals.push('нет подтверждённого реального фото');
  if(Number(user.totalWorkouts||0)===0)signals.push('нет тренировок в спортивной истории');
  if(activityCount===0)signals.push('нет связанных документов');
  if(authDisabled===true&&user.isSuspended===true)signals.push('аккаунт предварительно ограничен');
  return {blockers,signals,classification:blockers.length===0&&signals.length>=4?'test_candidate':'review_required',safeToDelete:blockers.length===0};
}

export async function buildUserDeletionPlan(db,auth,userId,{now=Date.now()}={}){
  const userRef=db.collection('users').doc(userId);
  const [userSnap,privateSnap,adminSnap,authUser]=await Promise.all([
    userRef.get(),
    db.collection('usersPrivate').doc(userId).get().catch(()=>null),
    db.collection('userAdmin').doc(userId).get().catch(()=>null),
    auth.getUser(userId).catch(()=>null)
  ]);
  if(!userSnap.exists)throw Object.assign(new Error('Пользователь не найден.'),{status:404});
  const user=userSnap.data()||{},priv=privateSnap?.exists?privateSnap.data()||{}:{};
  const email=String(priv.email||authUser?.email||'').trim().toLowerCase();

  const queries={
    goals:db.collection('goals').where('ownerId','==',userId),
    checkins:db.collection('checkins').where('userId','==',userId),
    feed:db.collection('feed').where('authorId','==',userId),
    chats:db.collection('chats').where('participantIds','array-contains',userId),
    trainingsOwned:db.collection('trainings').where('createdBy','==',userId),
    trainingsJoined:db.collection('trainings').where('participantIds','array-contains',userId),
    friendRequestsFrom:db.collection('friendRequests').where('fromId','==',userId),
    friendRequestsTo:db.collection('friendRequests').where('toId','==',userId),
    friendships:db.collection('friendships').where('participantIds','array-contains',userId),
    leisureOwned:db.collection('leisureEvents').where('createdBy','==',userId),
    leisureJoined:db.collection('leisureEvents').where('participantIds','array-contains',userId),
    stories:db.collection('stories').where('authorId','==',userId),
    ratingsGiven:db.collection('ratings').where('reviewerId','==',userId),
    ratingsReceived:db.collection('ratings').where('targetUserId','==',userId),
    workoutCredits:db.collection('workoutCredits').where('userId','==',userId),
    promoCodes:db.collection('promoCodes').where('ownerId','==',userId),
    pushDevices:db.collection('pushDevices').where('uid','==',userId),
    payments:db.collection('payments').where('userId','==',userId),
    paymentRequests:db.collection('paymentRequests').where('userId','==',userId),
    reportsSent:db.collection('reports').where('reporterId','==',userId),
    reportsReceived:db.collection('reports').where('targetUserId','==',userId)
  };
  const entries=await Promise.all(Object.entries(queries).map(async([key,q])=>[key,await countQuery(q)]));
  const counts=Object.fromEntries(entries);

  const safety=evaluateDeletionSafety({email,user,counts,authDisabled:authUser?.disabled===true});
  const {blockers,signals,classification,safeToDelete}=safety;
  const snapshot={
    userId,email,name:String(user.name||'Спортсмен').slice(0,120),
    isVerified:user.isVerified===true,isSuspended:user.isSuspended===true,
    registeredAt:user.registeredAt?.toDate?.()?.toISOString?.()||String(user.registeredAt||''),
    authCreatedAt:authUser?.metadata?.creationTime||'',authLastSignInAt:authUser?.metadata?.lastSignInTime||'',
    counts,blockers,signals,classification,safeToDelete
  };
  const fingerprint=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return {...snapshot,fingerprint,generatedAt:new Date(now).toISOString()};
}

async function docs(query){return (await query.get()).docs;}

export async function executeSafeUserDeletion(db,auth,plan){
  if(!plan.safeToDelete)throw Object.assign(new Error('План удаления содержит блокирующие факторы.'),{status:409});
  const uid=plan.userId;
  const [
    goals,checkins,feed,chats,trainingsOwned,trainingsJoined,friendFrom,friendTo,friendships,
    leisureOwned,leisureJoined,stories,workouts,promos,pushDevices
  ]=await Promise.all([
    docs(db.collection('goals').where('ownerId','==',uid)),
    docs(db.collection('checkins').where('userId','==',uid)),
    docs(db.collection('feed').where('authorId','==',uid)),
    docs(db.collection('chats').where('participantIds','array-contains',uid)),
    docs(db.collection('trainings').where('createdBy','==',uid)),
    docs(db.collection('trainings').where('participantIds','array-contains',uid)),
    docs(db.collection('friendRequests').where('fromId','==',uid)),
    docs(db.collection('friendRequests').where('toId','==',uid)),
    docs(db.collection('friendships').where('participantIds','array-contains',uid)),
    docs(db.collection('leisureEvents').where('createdBy','==',uid)),
    docs(db.collection('leisureEvents').where('participantIds','array-contains',uid)),
    docs(db.collection('stories').where('authorId','==',uid)),
    docs(db.collection('workoutCredits').where('userId','==',uid)),
    docs(db.collection('promoCodes').where('ownerId','==',uid)),
    docs(db.collection('pushDevices').where('uid','==',uid))
  ]);

  const deleteMap=new Map();
  for(const d of [...goals,...checkins,...feed,...chats,...trainingsOwned,...friendFrom,...friendTo,...friendships,...leisureOwned,...stories,...workouts,...promos,...pushDevices])deleteMap.set(d.ref.path,d.ref);

  const writer=db.bulkWriter();
  for(const ref of deleteMap.values())writer.delete(ref);

  const ownedTrainingIds=new Set(trainingsOwned.map(d=>d.id));
  for(const d of trainingsJoined){
    if(ownedTrainingIds.has(d.id))continue;
    const v=d.data()||{};
    writer.update(d.ref,{
      participantIds:(v.participantIds||[]).filter(id=>id!==uid),
      checkedInUserIds:(v.checkedInUserIds||[]).filter(id=>id!==uid),
      ratedParticipantIds:(v.ratedParticipantIds||[]).filter(id=>id!==uid),
      organizerRatedByParticipantIds:(v.organizerRatedByParticipantIds||[]).filter(id=>id!==uid)
    });
  }
  const ownedLeisureIds=new Set(leisureOwned.map(d=>d.id));
  for(const d of leisureJoined){
    if(ownedLeisureIds.has(d.id))continue;
    const v=d.data()||{};
    writer.update(d.ref,{participantIds:(v.participantIds||[]).filter(id=>id!==uid)});
  }

  const userDocs=await db.collection('users').get();
  for(const d of userDocs.docs){
    if(d.id===uid)continue;
    const v=d.data()||{},patch={};let changed=false;
    for(const field of ['likedUserIds','matchIds','friendIds','friendRequestsSent','friendRequestsReceived','blockedUserIds']){
      if(Array.isArray(v[field])&&v[field].includes(uid)){patch[field]=v[field].filter(id=>id!==uid);changed=true;}
    }
    if(Array.isArray(v.matchHistory)&&v.matchHistory.some(x=>x?.userId===uid)){patch.matchHistory=v.matchHistory.filter(x=>x?.userId!==uid);changed=true;}
    if(changed)writer.update(d.ref,patch);
  }

  writer.delete(db.collection('notificationInboxes').doc(uid));
  writer.delete(db.collection('notificationSettings').doc(uid));
  writer.delete(db.collection('storyQuotas').doc(uid));
  writer.delete(db.collection('userAdmin').doc(uid));
  writer.delete(db.collection('usersPrivate').doc(uid));
  writer.delete(db.collection('users').doc(uid));
  await writer.close();
  await auth.deleteUser(uid).catch(error=>{if(error?.code!=='auth/user-not-found')throw error;});
  return {deletedDocuments:deleteMap.size+6,updatedMemberships:trainingsJoined.length+leisureJoined.length};
}
