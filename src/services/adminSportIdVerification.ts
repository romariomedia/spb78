import { downloadPrivateEvidence,EvidenceDownload } from './privateEvidence';
import { getAdminSession } from './adminAuth';
import { SportIdVerificationRequest } from './sportIdVerification';
async function post<T>(body:Record<string,unknown>):Promise<T>{
  const session=getAdminSession();if(!session)throw new Error('admin-otp-required');
  const response=await fetch('/api/admin-sport-id-verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,sessionId:session.sessionId})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data as T;
}
export async function loadAdminSportIdVerification(status='pending',cursor=''):Promise<{requests:SportIdVerificationRequest[];nextCursor:string|null}>{
  return post({operation:'list',status,cursor});
}
export async function approveSportIdVerification(requestId:string,note=''):Promise<void>{await post({operation:'approve',requestId,note,auditRequestId:crypto.randomUUID?.()||String(Date.now())});}
export async function rejectSportIdVerification(requestId:string,note:string):Promise<void>{await post({operation:'reject',requestId,note,auditRequestId:crypto.randomUUID?.()||String(Date.now())});}
export async function revokeSportIdVerification(requestId:string,note:string):Promise<void>{await post({operation:'revoke',requestId,note,auditRequestId:crypto.randomUUID?.()||String(Date.now())});}

export async function downloadAdminSportIdEvidence(requestId:string):Promise<void>{
  const result=await post<{file:EvidenceDownload}>({operation:'downloadEvidence',requestId});
  downloadPrivateEvidence(result.file);
}
