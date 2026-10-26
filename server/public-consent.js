export const PUBLIC_DISSEMINATION_VERSION='SB78-PUBLIC-2026-10-26';

export const PUBLIC_CONSENT_GROUPS=Object.freeze({
  identity:['name','age','gender','avatar'],
  profile:['bio','sports','activeLooking'],
  portfolio:['photoPortfolio'],
  location:['districtId','locationName','lat','lng','hasUsedGeolocation','lastGeoAt'],
  presence:['lastSeenAt'],
  reputation:['rating','ratingCount','totalWorkouts','totalDailyMedals','medalTier','isVerified'],
  trainer:['personalTrainer']
});

export const PUBLIC_CONSENT_GROUP_IDS=Object.freeze(Object.keys(PUBLIC_CONSENT_GROUPS));

const clean=value=>typeof value==='string'?value.trim():'';
const millis=value=>{
  const raw=value?.toDate?value.toDate().getTime():Date.parse(String(value||''));
  return Number.isFinite(raw)?raw:0;
};

export function sanitizePublicConsentGroups(value){
  if(!Array.isArray(value))return [];
  return [...new Set(value.map(clean).filter(group=>PUBLIC_CONSENT_GROUP_IDS.includes(group)))];
}

export function publicConsentState(user={}){
  const raw=user.publicDissemination||{};
  const groups=sanitizePublicConsentGroups(raw.groups);
  return {
    active:raw.active===true&&raw.version===PUBLIC_DISSEMINATION_VERSION&&groups.length>0,
    version:clean(raw.version),
    groups,
    grantedAt:millis(raw.grantedAt)?new Date(millis(raw.grantedAt)).toISOString():'',
    revokedAt:millis(raw.revokedAt)?new Date(millis(raw.revokedAt)).toISOString():''
  };
}

export function hasPublicDisseminationConsent(user={}){
  return publicConsentState(user).active;
}

function copySafe(result,user,key){
  if(user[key]!==undefined)result[key]=user[key];
}

function roundCoordinate(value){
  const number=Number(value);
  if(!Number.isFinite(number))return undefined;
  return Math.round(number*100)/100;
}

export function consentedPublicProfile(id,user={}){
  const consent=publicConsentState(user);
  if(!consent.active)return null;
  const result={id,publicConsentVersion:consent.version};
  for(const group of consent.groups){
    for(const key of PUBLIC_CONSENT_GROUPS[group]||[]){
      if(key==='lat'||key==='lng')continue;
      copySafe(result,user,key);
    }
  }
  if(consent.groups.includes('location')){
    const lat=roundCoordinate(user.lat),lng=roundCoordinate(user.lng);
    if(lat!==undefined&&lng!==undefined){result.lat=lat;result.lng=lng;}
  }
  return result;
}

export function publicConsentDocument(uid,groups,now=new Date()){
  const selected=sanitizePublicConsentGroups(groups);
  if(selected.length===0)throw Object.assign(new Error('Выберите хотя бы одну категорию данных для публичного профиля.'),{status:400,code:'PUBLIC_CONSENT_EMPTY'});
  const at=now instanceof Date?now:new Date(now);
  if(!Number.isFinite(at.getTime()))throw new Error('Invalid consent date');
  const grantedAt=at.toISOString();
  return {
    ownerUserId:uid,
    active:true,
    version:PUBLIC_DISSEMINATION_VERSION,
    groups:selected,
    grantedAt,
    revokedAt:'',
    purpose:'Публичный профиль SportBuddy78, поиск спортивных партнёров, отображение в сообществе и функциях рекомендаций.',
    recipients:'Авторизованные пользователи SportBuddy78 и, для отдельно включённых публичных страниц, неопределённый круг лиц.',
    operator:'ИП Сайдашев Роман Витальевич, ИНН 272199019189'
  };
}

export function revokedPublicConsentDocument(uid,previous={},now=new Date()){
  const at=now instanceof Date?now:new Date(now);
  const revokedAt=Number.isFinite(at.getTime())?at.toISOString():new Date().toISOString();
  return {
    ownerUserId:uid,
    active:false,
    version:clean(previous.version)||PUBLIC_DISSEMINATION_VERSION,
    groups:sanitizePublicConsentGroups(previous.groups),
    grantedAt:previous.grantedAt||'',
    revokedAt,
    purpose:clean(previous.purpose),
    recipients:clean(previous.recipients),
    operator:clean(previous.operator)
  };
}
