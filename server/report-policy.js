import { createHash } from 'node:crypto';

const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const reasons=new Set(['unsafe','harassment','spam','fake','other']);

export function sanitizeComplaintInput(input={}){
  const targetUserId=clean(input.targetUserId,180);
  const chatId=clean(input.chatId,240);
  const reason=reasons.has(input.reason)?input.reason:'unsafe';
  const details=clean(input.details,800);
  if(!targetUserId||targetUserId.includes('/'))throw Object.assign(new Error('Некорректный пользователь.'),{status:400});
  if(!chatId||chatId.includes('/'))throw Object.assign(new Error('Некорректный чат.'),{status:400});
  return {targetUserId,chatId,reason,details};
}

export function complaintDailyId(reporterId,targetUserId,chatId,now=Date.now()){
  const day=new Date(now).toISOString().slice(0,10);
  return createHash('sha256').update([reporterId,targetUserId,chatId,day].join('|')).digest('hex');
}

export function reportStatus(value){
  return ['new','reviewing','resolved','dismissed'].includes(value)?value:'new';
}
