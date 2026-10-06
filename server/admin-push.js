import { FieldPath } from 'firebase-admin/firestore';
import { validateDistrictId } from '../shared/districts.js';

const cleanText=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';

export function sanitizeAdminPushAudience(input={}) {
  const userId=cleanText(input.userId,180);
  if(userId.includes('/')) throw Object.assign(new Error('Некорректный UID пользователя.'),{status:400});
  const districtId=input.districtId ? validateDistrictId(input.districtId) : '';
  const sport=cleanText(input.sport,80);
  const verifiedOnly=input.verifiedOnly===true;
  const activeWithinDays=input.activeWithinDays===30 ? 30 : 0;
  return {userId,districtId,sport,verifiedOnly,activeWithinDays};
}

export function matchesAdminPushAudience(user,audience,now=Date.now()) {
  if(!user || user.isSuspended===true)return false;
  if(audience.userId && user.id!==audience.userId)return false;
  if(audience.districtId && user.districtId!==audience.districtId)return false;
  if(audience.sport && !(Array.isArray(user.sports)&&user.sports.includes(audience.sport)))return false;
  if(audience.verifiedOnly && user.isVerified!==true)return false;
  if(audience.activeWithinDays){
    const last=Number(user.lastSeenAt||0);
    if(!Number.isFinite(last)||last<now-audience.activeWithinDays*86400000)return false;
  }
  return true;
}

export function sanitizeAdminPushContent(input={}) {
  const title=cleanText(input.title,100);
  const message=cleanText(input.message,240);
  const link=cleanText(input.link,512)||'#notifications';
  if(title.length<2)throw Object.assign(new Error('Заголовок должен содержать минимум 2 символа.'),{status:400});
  if(message.length<2)throw Object.assign(new Error('Сообщение должно содержать минимум 2 символа.'),{status:400});
  if(!/^#[A-Za-z0-9_?=&%+\-:./]*$/.test(link))throw Object.assign(new Error('Допустима только внутренняя ссылка SportBuddy78, начинающаяся с #.'),{status:400});
  return {title,message,link};
}

export function sanitizeAdminPushSchedule(value,now=Date.now()) {
  if(!value)return now;
  const parsed=Date.parse(String(value));
  if(!Number.isFinite(parsed))throw Object.assign(new Error('Некорректное время отправки.'),{status:400});
  if(parsed<now-60000)return now;
  if(parsed>now+30*86400000)throw Object.assign(new Error('Рассылку можно запланировать максимум на 30 дней вперёд.'),{status:400});
  return parsed;
}

export async function resolveAdminPushAudience(db,audience,{sampleLimit=5,maxScan=10000,now=Date.now()}={}) {
  let cursor='',scanned=0,count=0;
  const sample=[];
  while(scanned<maxScan){
    let query=db.collection('users').orderBy(FieldPath.documentId()).limit(Math.min(250,maxScan-scanned));
    if(cursor)query=query.startAfter(cursor);
    const page=await query.get();
    if(page.empty)break;
    scanned+=page.size;
    cursor=page.docs.at(-1).id;
    for(const doc of page.docs){
      const user={...doc.data(),id:doc.id};
      if(!matchesAdminPushAudience(user,audience,now))continue;
      count++;
      if(sample.length<sampleLimit)sample.push({
        id:doc.id,
        name:cleanText(user.name,120)||'Спортсмен',
        districtId:cleanText(user.districtId,80),
        sports:Array.isArray(user.sports)?user.sports.filter(v=>typeof v==='string').slice(0,5):[]
      });
    }
    if(page.size<250)break;
  }
  if(scanned>=maxScan)throw Object.assign(new Error('Аудитория слишком большая для безопасного предпросмотра. Уточните фильтр.'),{status:409});
  return {count,sample,scanned};
}
