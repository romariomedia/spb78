import { apiFetch } from './apiEndpoint';
import { getAdminSession } from './adminAuth';
import { SportIdVerificationRequest } from './sportIdVerification';
async function post<T>(body:Record<string,unknown>):Promise<T>{
  const session=getAdminSession();if(!session)throw new Error('admin-otp-required');
  const response=await apiFetch('/api/admin-sport-id-verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,sessionId:session.sessionId})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data as T;
}
export async function loadAdminSportIdVerificationPage(cursor?:string|null):Promise<{items:SportIdVerificationRequest[];nextCursor:string|null}>{
 const data=await post<{requests:SportIdVerificationRequest[];nextCursor?:string|null}>({operation:'list',cursor});return {items:Array.isArray(data.requests)?data.requests:[],nextCursor:data.nextCursor||null};
}
export async function loadAdminSportIdVerification():Promise<SportIdVerificationRequest[]>{return (await loadAdminSportIdVerificationPage()).items;}

export async function approveSportIdVerification(requestId:string,note='',expectedVersion='',trainerLevel?:'start'|'pro'):Promise<void>{await post({operation:'approve',requestId,note,expectedVersion,...(trainerLevel?{trainerLevel}:{}),auditRequestId:crypto.randomUUID?.()||String(Date.now())});}
export async function rejectSportIdVerification(requestId:string,note:string,expectedVersion=''):Promise<void>{await post({operation:'reject',requestId,note,expectedVersion,auditRequestId:crypto.randomUUID?.()||String(Date.now())});}
export async function revokeSportIdVerification(requestId:string,note:string,expectedVersion=''):Promise<void>{await post({operation:'revoke',requestId,note,expectedVersion,auditRequestId:crypto.randomUUID?.()||String(Date.now())});}

export async function setTrainerLevel(requestId:string,trainerLevel:'start'|'pro',note:string,expectedVersion:string):Promise<void>{await post({operation:'setTrainerLevel',requestId,trainerLevel,note,expectedVersion,auditRequestId:crypto.randomUUID?.()||String(Date.now())});}
