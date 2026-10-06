import { createHash } from 'node:crypto';

export const ANALYTICS_TIMEZONE='Europe/Moscow';

export function analyticsDayKey(value=Date.now()){
  const date=value instanceof Date?value:new Date(value);
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:ANALYTICS_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'
  }).format(date);
}

export function shiftAnalyticsDay(day,offset){
  const base=new Date(day+'T12:00:00Z');
  base.setUTCDate(base.getUTCDate()+offset);
  return analyticsDayKey(base);
}

export function analyticsDocId(day,userId){
  return `${day}_${createHash('sha256').update(String(userId)).digest('hex').slice(0,24)}`;
}

export function analyticsSessionId(day,userId,sessionId){
  return createHash('sha256').update(`${day}|${userId}|${sessionId}`).digest('hex');
}

export function safeActiveSeconds(requested,{now=Date.now(),lastPulseAt=0,lastCreditedAt=0}={}){
  const value=Math.max(0,Math.min(90,Math.round(Number(requested)||0)));
  if(!lastPulseAt)return 0;
  const sessionElapsed=Math.max(0,Math.floor((now-Number(lastPulseAt))/1000)+5);
  const globalElapsed=lastCreditedAt?Math.max(0,Math.floor((now-Number(lastCreditedAt))/1000)+5):sessionElapsed;
  return Math.max(0,Math.min(value,sessionElapsed,globalElapsed,90));
}

export function parseMillis(value){
  if(value?.toDate)return value.toDate().getTime();
  const numeric=Number(value);
  if(Number.isFinite(numeric)&&numeric>100000000000)return numeric;
  const parsed=Date.parse(String(value||''));
  return Number.isFinite(parsed)?parsed:NaN;
}

export function percent(numerator,denominator){
  return denominator>0?Math.round(numerator/denominator*1000)/10:null;
}
