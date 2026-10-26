import {createHash} from 'node:crypto';
import {businessSubscriptionId,validBusinessSubjectId,validBusinessSubjectType} from './business-billing.js';

export const BUSINESS_EVENT_TYPES = Object.freeze(['view','click','lead']);
const TARGETS = new Set(['card','profile','website','phone','booking','training','directions']);

const clean=(value,max=120)=>typeof value==='string'?value.trim().slice(0,max):'';
const count=(value)=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;

export function businessDayKey(now=Date.now()){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date(now));
  const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function sanitizeBusinessEvent(input={}){
  const subjectType=clean(input.subjectType,30),subjectId=clean(input.subjectId,180);
  const eventType=clean(input.eventType,30),target=clean(input.target,40)||'card';
  if(!validBusinessSubjectType(subjectType)||!validBusinessSubjectId(subjectId))
    throw Object.assign(new Error('Некорректный коммерческий объект.'),{status:400});
  if(!BUSINESS_EVENT_TYPES.includes(eventType))
    throw Object.assign(new Error('Некорректное событие.'),{status:400});
  if(!TARGETS.has(target))
    throw Object.assign(new Error('Некорректная точка взаимодействия.'),{status:400});
  return {subjectType,subjectId,eventType,target};
}

export function metricDocRef(db,subjectType,subjectId,day){
  return db.collection('businessMetrics').doc(businessSubscriptionId(subjectType,subjectId)).collection('days').doc(day);
}

function dedupId({actorId,subjectType,subjectId,eventType,target,day,dedupKey}){
  return createHash('sha256').update(JSON.stringify([
    clean(actorId,180),subjectType,subjectId,eventType,target,day,clean(dedupKey,180)
  ])).digest('hex');
}

export async function recordBusinessMetric(db,input={}){
  const event=sanitizeBusinessEvent(input);
  const actorId=clean(input.actorId,180);
  if(!actorId)throw Object.assign(new Error('Нужен пользователь события.'),{status:400});
  const day=businessDayKey(input.now||Date.now());
  const metricRef=metricDocRef(db,event.subjectType,event.subjectId,day);
  const seenRef=db.collection('businessMetricDedup').doc(dedupId({...event,actorId,day,dedupKey:input.dedupKey}));
  return db.runTransaction(async tx=>{
    const [seen,metric]=await Promise.all([tx.get(seenRef),tx.get(metricRef)]);
    if(seen.exists)return {counted:false};
    const before=metric.exists?metric.data()||{}:{};
    const views=count(before.views)+(event.eventType==='view'?1:0);
    const clicks=count(before.clicks)+(event.eventType==='click'?1:0);
    const leads=count(before.leads)+(event.eventType==='lead'?1:0);
    const next={
      day,eventTypeVersion:1,subjectType:event.subjectType,subjectId:event.subjectId,
      views,clicks,leads,updatedAt:new Date().toISOString()
    };
    tx.set(metricRef,next,{merge:false});
    tx.create(seenRef,{
      subjectType:event.subjectType,subjectId:event.subjectId,eventType:event.eventType,
      target:event.target,actorIdHash:createHash('sha256').update(actorId).digest('hex'),
      day,createdAt:new Date().toISOString(),
      expiresAt:new Date(Date.now()+40*86400000).toISOString()
    });
    return {counted:true};
  });
}

export async function loadBusinessMetricSeries(db,subjectType,subjectId,days=30,now=Date.now()){
  businessSubscriptionId(subjectType,subjectId);
  const rows=[];
  for(let offset=days-1;offset>=0;offset--){
    const at=now-offset*86400000;
    rows.push({day:businessDayKey(at),ref:metricDocRef(db,subjectType,subjectId,businessDayKey(at))});
  }
  const snapshots=await Promise.all(rows.map(row=>row.ref.get()));
  return rows.map((row,index)=>{
    const data=snapshots[index].exists?snapshots[index].data()||{}:{};
    return {day:row.day,views:count(data.views),clicks:count(data.clicks),leads:count(data.leads)};
  });
}

export function summarizeBusinessMetrics(series=[]){
  const total=series.reduce((acc,row)=>({
    views:acc.views+count(row.views),clicks:acc.clicks+count(row.clicks),leads:acc.leads+count(row.leads)
  }),{views:0,clicks:0,leads:0});
  const recent=series.slice(-7).reduce((acc,row)=>({
    views:acc.views+count(row.views),clicks:acc.clicks+count(row.clicks),leads:acc.leads+count(row.leads)
  }),{views:0,clicks:0,leads:0});
  return {
    total30:total,total7:recent,
    conversion30:total.views>0?Number(((total.leads/total.views)*100).toFixed(1)):0,
    clickRate30:total.views>0?Number(((total.clicks/total.views)*100).toFixed(1)):0
  };
}
