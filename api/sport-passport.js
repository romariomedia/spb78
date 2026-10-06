import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { buildAutomaticAchievements,levelLabel,sanitizeSportPassportDraft } from '../server/sport-passport.js';
import { requireActiveUser } from '../server/user-status.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';

async function buildSnapshot(db,uid,user){
  const [checkinsSnap,ownedSnap,resultsSnap]=await Promise.all([
    db.collection('checkins').where('userId','==',uid).get().catch(()=>null),
    db.collection('trainings').where('createdBy','==',uid).get().catch(()=>null),
    db.collection('sportPassportResults').where('userId','==',uid).get().catch(()=>null)
  ]);
  const checkins=(checkinsSnap?.docs||[]).map(d=>d.data()||{}).sort((a,b)=>Number(b.timestamp||0)-Number(a.timestamp||0));
  const trainingIds=[...new Set(checkins.map(x=>String(x.trainingId||'')).filter(Boolean))].slice(0,30);
  const trainingSnaps=await Promise.all(trainingIds.map(id=>db.collection('trainings').doc(id).get().catch(()=>null)));
  const trainings=new Map(trainingSnaps.filter(Boolean).filter(s=>s.exists).map(s=>[s.id,s.data()||{}]));
  const history=checkins.slice(0,20).map(item=>{
    const training=trainings.get(String(item.trainingId||''))||{};
    return {
      id:String(item.id||''),
      trainingId:String(item.trainingId||''),
      title:clean(training.title||item.trainingTitle,180)||'Тренировка',
      sport:clean(training.sport||item.sport,80),
      dateKey:clean(training.dateKey,10),
      locationName:clean(training.locationName,180),
      timestamp:Number(item.timestamp||0),
      verified:item.verified===true
    };
  });
  const officialResults=(resultsSnap?.docs||[]).map(doc=>({id:doc.id,...doc.data()}))
    .filter(x=>x.status==='verified')
    .sort((a,b)=>Number(b.achievedAt||0)-Number(a.achievedAt||0))
    .slice(0,20)
    .map(x=>({
      id:String(x.id),title:clean(x.title,180),sport:clean(x.sport,80),placement:clean(x.placement,80),
      eventTitle:clean(x.eventTitle,180),achievedAt:Number(x.achievedAt||0),verification:'sportbuddy'
    }));

  const draft=sanitizeSportPassportDraft(user.sportPassport||{},Array.isArray(user.sports)?user.sports:[]);
  const automatic=buildAutomaticAchievements(user);
  return {
    identity:{
      id:uid,name:clean(user.name,120)||'Спортсмен',avatar:clean(user.avatar,2000),
      districtId:clean(user.districtId,80),locationName:clean(user.locationName,180),
      isVerified:user.isVerified===true,registeredAt:user.registeredAt?.toDate?.()?.toISOString?.()||String(user.registeredAt||'')
    },
    profile:{...draft,levelLabel:levelLabel(draft.level)},
    stats:{
      totalWorkouts:Number(user.totalWorkouts||0),verifiedCheckins:checkins.filter(x=>x.verified===true).length,
      organizedTrainings:ownedSnap?.size||0,rating:Number(user.rating||0),ratingCount:Number(user.ratingCount||0),
      totalDailyMedals:Number(user.totalDailyMedals||0)
    },
    achievements:[...automatic,...draft.declaredAchievements],
    officialResults,
    history
  };
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется вход'});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();
    const {profile:user}=await requireActiveUser(db,uid);
    const action=String(req.body?.action||'read');

    if(action==='read')return res.json({passport:await buildSnapshot(db,uid,user)});

    if(action==='update'){
      const next=sanitizeSportPassportDraft(req.body?.passport||{},Array.isArray(user.sports)?user.sports:[]);
      await db.collection('users').doc(uid).update({sportPassport:{...next,updatedAt:new Date().toISOString()}});
      const fresh=(await db.collection('users').doc(uid).get()).data()||{};
      return res.json({passport:await buildSnapshot(db,uid,fresh)});
    }
    return res.status(400).json({error:'Неизвестное действие'});
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[sport-passport]',error);
    return res.status(status).json({error:status===500?'Спортивный паспорт временно недоступен.':error.message});
  }
}
