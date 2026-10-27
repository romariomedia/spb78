import { randomBytes } from 'node:crypto';
import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { competitionStats,levelLabel,sanitizeSportPassportDraft } from '../server/sport-passport.js';
import { requireActiveUser } from '../server/user-status.js';
import { applyVerifiedClaims,claimFingerprint,claimFromPassport } from '../server/sport-id-verification.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';
const PUBLIC_SPORT_ID_CONSENT_VERSION='SB78-SPORT-ID-PUBLIC-2026-10-26';

async function buildSportIdSnapshot(db,uid,user){
  const [checkinsSnap,ownedSnap,resultsSnap,claimsSnap]=await Promise.all([
    db.collection('checkins').where('userId','==',uid).get().catch(()=>null),
    db.collection('trainings').where('createdBy','==',uid).get().catch(()=>null),
    db.collection('sportPassportResults').where('userId','==',uid).get().catch(()=>null),
    db.collection('sportVerifiedClaims').where('userId','==',uid).get().catch(()=>null)
  ]);
  const checkins=(checkinsSnap?.docs||[]).map(d=>d.data()||{}).sort((a,b)=>Number(b.timestamp||0)-Number(a.timestamp||0));
  const trainingIds=[...new Set(checkins.map(x=>String(x.trainingId||'')).filter(Boolean))].slice(0,30);
  const trainingSnaps=await Promise.all(trainingIds.map(id=>db.collection('trainings').doc(id).get().catch(()=>null)));
  const trainings=new Map(trainingSnaps.filter(Boolean).filter(s=>s.exists).map(s=>[s.id,s.data()||{}]));
  const history=checkins.slice(0,20).map(item=>{
    const training=trainings.get(String(item.trainingId||''))||{};
    return {
      id:String(item.id||''),trainingId:String(item.trainingId||''),
      title:clean(training.title||item.trainingTitle,180)||'Тренировка',
      sport:clean(training.sport||item.sport,80),dateKey:clean(training.dateKey,10),
      locationName:clean(training.locationName,180),timestamp:Number(item.timestamp||0),verified:item.verified===true
    };
  });
  const officialResults=(resultsSnap?.docs||[]).map(doc=>({id:doc.id,...doc.data()}))
    .filter(x=>x.status==='verified')
    .sort((a,b)=>Number(b.achievedAt||0)-Number(a.achievedAt||0))
    .slice(0,50)
    .map(x=>({
      id:String(x.id),title:clean(x.title,180),sport:clean(x.sport,80),placement:clean(x.placement,80),
      eventTitle:clean(x.eventTitle,180),achievedAt:Number(x.achievedAt||0),verification:'sportbuddy'
    }));
  const comp=competitionStats(officialResults);
  const draft=sanitizeSportPassportDraft(user.sportPassport||{},Array.isArray(user.sports)?user.sports:[]);
  const verified=applyVerifiedClaims(draft,(claimsSnap?.docs||[]).map(doc=>doc.data()||{}));
  return {
    identity:{
      id:uid,name:clean(user.name,120)||'Спортсмен',avatar:clean(user.avatar,2000),
      districtId:clean(user.districtId,80),locationName:clean(user.locationName,180),
      isVerified:user.isVerified===true,registeredAt:user.registeredAt?.toDate?.()?.toISOString?.()||String(user.registeredAt||'')
    },
    profile:{...draft,declaredAchievements:verified.achievements,rankVerification:verified.rankVerification,levelLabel:levelLabel(draft.level)},
    public:{
      enabled:draft.publicEnabled===true
        && user.sportPassport?.publicConsent?.active===true
        && user.sportPassport?.publicConsent?.version===PUBLIC_SPORT_ID_CONSENT_VERSION,
      slug:draft.publicSlug||''
    },
    stats:{
      totalWorkouts:Number(user.totalWorkouts||0),verifiedCheckins:checkins.filter(x=>x.verified===true).length,
      organizedTrainings:ownedSnap?.size||0,rating:Number(user.rating||0),ratingCount:Number(user.ratingCount||0),
      sportBuddyWins:comp.wins,sportBuddyPodiums:comp.podiums
    },
    achievements:verified.achievements,
    officialResults,history
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

    if(action==='read')return res.json({sportId:await buildSportIdSnapshot(db,uid,user)});

    if(action==='update'){
      const current=sanitizeSportPassportDraft(user.sportPassport||{},Array.isArray(user.sports)?user.sports:[]);
      const next=sanitizeSportPassportDraft({...req.body?.sportId,publicEnabled:current.publicEnabled,publicSlug:current.publicSlug},Array.isArray(user.sports)?user.sports:[]);
      await db.collection('users').doc(uid).update({sportPassport:{...next,updatedAt:new Date().toISOString()}});
      const claims=await db.collection('sportVerifiedClaims').where('userId','==',uid).get().catch(()=>null);
      const stale=[];
      for(const doc of claims?.docs||[]){
        const claim=doc.data()||{};
        try{
          const current=claimFromPassport(next,claim);
          if(claimFingerprint(current)!==claim.fingerprint)stale.push({doc,claim});
        }catch{stale.push({doc,claim});}
      }
      if(stale.length){
        const batch=db.batch(),now=new Date().toISOString();
        for(const item of stale){
          batch.delete(item.doc.ref);
          if(item.claim.sourceRequestId){
            batch.set(db.collection('sportVerificationRequests').doc(String(item.claim.sourceRequestId)),{
              status:'revoked',reviewNote:'Подтверждение автоматически отозвано: данные Спортивного ID были изменены пользователем.',
              reviewedAt:now,reviewedBy:'system',updatedAt:now,updatedAtMs:Date.now()
            },{merge:true});
          }
        }
        await batch.commit();
      }
      const fresh=(await db.collection('users').doc(uid).get()).data()||{};
      return res.json({sportId:await buildSportIdSnapshot(db,uid,fresh)});
    }

    if(action==='setPublic'){
      const current=sanitizeSportPassportDraft(user.sportPassport||{},Array.isArray(user.sports)?user.sports:[]);
      const enabled=req.body?.enabled===true;
      if(enabled&&(req.body?.publicConsentConfirmed!==true||String(req.body?.publicConsentVersion||'')!==PUBLIC_SPORT_ID_CONSENT_VERSION))
        return res.status(409).json({code:'SPORT_ID_PUBLIC_CONSENT_REQUIRED',error:'Перед публикацией QR Sport ID отдельно подтвердите распространение указанных в карточке персональных данных в сети Интернет. Если поля согласия нет, обновите приложение или выполните действие на sportbuddy78.pro.'});
      const publicSlug=current.publicSlug||randomBytes(12).toString('base64url');
      const now=new Date().toISOString();
      const consent=enabled?{
        active:true,version:PUBLIC_SPORT_ID_CONSENT_VERSION,grantedAt:now,revokedAt:'',
        scope:'Внешняя read-only страница SportBuddy78 ID по непредсказуемой ссылке/QR.',
        fields:['name','avatar','district/location','verification','sports','experience','rank','achievements','SportBuddy78 results','rating','workout statistics','verified trainer public fields']
      }:{
        ...(user.sportPassport?.publicConsent||{}),active:false,version:String(user.sportPassport?.publicConsent?.version||PUBLIC_SPORT_ID_CONSENT_VERSION),revokedAt:now
      };
      const eventRef=db.collection('legalConsentEvents').doc(`sport-id:${uid}:${Date.now()}:${randomBytes(5).toString('hex')}`);
      await db.runTransaction(async tx=>{
        const ref=db.collection('users').doc(uid),fresh=await tx.get(ref);
        if(!fresh.exists)throw Object.assign(new Error('Профиль не найден.'),{status:404});
        tx.update(ref,{
          'sportPassport.publicEnabled':enabled,
          'sportPassport.publicSlug':publicSlug,
          'sportPassport.publicConsent':consent,
          'sportPassport.updatedAt':now
        });
        tx.create(eventRef,{
          ownerUserId:uid,kind:'sport_id_public',action:enabled?'grant':'revoke',
          version:consent.version,createdAt:now,scope:consent.scope||'',fields:consent.fields||[]
        });
      });
      const fresh=(await db.collection('users').doc(uid).get()).data()||{};
      return res.json({sportId:await buildSportIdSnapshot(db,uid,fresh)});
    }

    return res.status(400).json({error:'Неизвестное действие'});
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[sport-id]',error);
    return res.status(status).json({error:status===500?'Спортивный ID SportBuddy78 временно недоступен.':error.message});
  }
}
