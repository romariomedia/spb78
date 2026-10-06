import { createHash,randomBytes } from 'node:crypto';

const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const TYPES=new Set(['rank','achievement']);

export function claimFingerprint(claim={}){
  const canonical={
    claimType:clean(claim.claimType,30),
    claimId:clean(claim.claimId,100),
    title:clean(claim.title,180),
    sport:clean(claim.sport,80),
    date:clean(claim.date,10),
    placement:clean(claim.placement,80),
    rankTitle:clean(claim.rankTitle,120),
    level:clean(claim.level,30)
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function claimFromPassport(passport={},input={}){
  const claimType=TYPES.has(input.claimType)?input.claimType:'';
  if(!claimType)throw Object.assign(new Error('Выберите факт для подтверждения.'),{status:400});
  if(claimType==='rank'){
    const rankTitle=clean(passport.rankTitle,120);
    if(rankTitle.length<2)throw Object.assign(new Error('Сначала укажите разряд или спортивный статус в Спортивном ID.'),{status:409});
    return {
      claimType:'rank',claimId:'rank',title:rankTitle,rankTitle,
      sport:clean(passport.mainSport,80),level:clean(passport.level,30)
    };
  }
  const claimId=clean(input.claimId,100);
  const achievement=(passport.declaredAchievements||[]).find(item=>String(item.id)===claimId);
  if(!achievement)throw Object.assign(new Error('Достижение не найдено в Спортивном ID.'),{status:404});
  return {
    claimType:'achievement',claimId,
    title:clean(achievement.title,180),sport:clean(achievement.sport||passport.mainSport,80),
    date:clean(achievement.date,10),placement:clean(achievement.placement,80)
  };
}

export function sanitizeVerificationEvidence(input={}){
  const evidenceUrl=clean(input.evidenceUrl,1500);
  const officialUrl=clean(input.officialUrl,1500);
  const note=clean(input.note,800);
  if(!evidenceUrl&&!officialUrl)throw Object.assign(new Error('Добавьте документ/скриншот или официальную ссылку.'),{status:400});
  if(evidenceUrl&&!/^https:\/\//i.test(evidenceUrl))throw Object.assign(new Error('Некорректная ссылка на документ.'),{status:400});
  if(officialUrl&&!/^https:\/\//i.test(officialUrl))throw Object.assign(new Error('Официальная ссылка должна начинаться с https://'),{status:400});
  return {evidenceUrl,officialUrl,note};
}

export function verificationRequestId(uid,claim){
  return createHash('sha256').update(uid+'|'+claim.claimType+'|'+claim.claimId).digest('hex');
}

export function verificationClaimId(uid,claim){
  return createHash('sha256').update('claim|'+uid+'|'+claim.claimType+'|'+claim.claimId).digest('hex');
}

export function publicClaimToken(){
  return randomBytes(10).toString('base64url');
}

export function applyVerifiedClaims(passport={},claims=[]){
  const active=claims.filter(item=>item?.status==='verified');
  let rankFingerprint='';
  try{rankFingerprint=claimFingerprint(claimFromPassport(passport,{claimType:'rank'}));}catch{}
  const rankClaim=rankFingerprint?active.find(item=>item.claimType==='rank'&&item.fingerprint===rankFingerprint):null;
  const verifiedByAchievement=new Map();
  for(const achievement of passport.declaredAchievements||[]){
    const current=claimFromPassport(passport,{claimType:'achievement',claimId:achievement.id});
    const fingerprint=claimFingerprint(current);
    const claim=active.find(item=>item.claimType==='achievement'&&item.claimId===achievement.id&&item.fingerprint===fingerprint);
    if(claim)verifiedByAchievement.set(achievement.id,claim);
  }
  return {
    rankVerification:rankClaim?'verified':'declared',
    achievements:(passport.declaredAchievements||[]).map(item=>({...item,verification:verifiedByAchievement.has(item.id)?'verified':'declared'}))
  };
}
