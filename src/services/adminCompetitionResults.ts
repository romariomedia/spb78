import { getAdminSession } from './adminAuth';

export interface CompetitionParticipant {id:string;name:string;avatar:string}
export interface CompetitionResult {id:string;userId:string;eventId:string;eventTitle:string;sport:string;title:string;placement:string;status:'verified';achievedAt:number}
export interface CompetitionResultBundle {
  event:{id:string;title:string;sport:string;status:string};
  participants:CompetitionParticipant[];
  results:CompetitionResult[];
}
async function post<T>(body:Record<string,unknown>):Promise<T>{
  const session=getAdminSession();if(!session)throw new Error('admin-otp-required');
  const response=await fetch('/api/admin-event-results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,sessionId:session.sessionId})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data as T;
}
export async function loadCompetitionResults(eventId:string):Promise<CompetitionResultBundle>{
  return post({operation:'list',eventId});
}
export async function recordCompetitionResult(eventId:string,userId:string,placement:string,title=''):Promise<void>{
  await post({operation:'record',eventId,userId,placement,title,requestId:crypto.randomUUID?.()||String(Date.now())});
}
export async function revokeCompetitionResult(eventId:string,userId:string):Promise<void>{
  await post({operation:'revoke',eventId,userId,requestId:crypto.randomUUID?.()||String(Date.now())});
}
