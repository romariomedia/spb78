import { auth } from './firebaseAuth';

export type SportIdClaimType='rank'|'achievement';
export type SportIdVerificationStatus='pending'|'approved'|'rejected'|'revoked'|'cancelled';
export interface SportIdVerificationRequest{
  id:string;userId:string;userName:string;userAvatar:string;claimType:SportIdClaimType;claimId:string;
  title:string;sport:string;date?:string;placement?:string;rankTitle?:string;level?:string;
  evidenceUrl:string;officialUrl:string;note:string;status:SportIdVerificationStatus;
  reviewNote:string;createdAt:string;updatedAt:string;reviewedAt:string;reviewedBy:string;
}
async function call<T>(body:Record<string,unknown>):Promise<T>{
  const token=await auth.currentUser?.getIdToken();if(!token)throw new Error('Требуется повторный вход');
  const response=await fetch('/api/sport-id-verification',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data as T;
}
export async function loadSportIdVerificationRequests():Promise<SportIdVerificationRequest[]>{
  const data=await call<{requests:SportIdVerificationRequest[]}>({action:'list'});return Array.isArray(data.requests)?data.requests:[];
}
export async function submitSportIdVerification(input:{claimType:SportIdClaimType;claimId?:string;evidenceUrl?:string;officialUrl?:string;note?:string}):Promise<SportIdVerificationRequest>{
  const data=await call<{request:SportIdVerificationRequest}>({action:'submit',...input});return data.request;
}
export async function cancelSportIdVerification(requestId:string):Promise<void>{await call({action:'cancel',requestId});}
