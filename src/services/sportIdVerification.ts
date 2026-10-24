import { apiFetch } from './apiEndpoint';
import { auth } from './firebaseAuth';

export type SportIdClaimType='rank'|'achievement'|'trainer';
export type SportIdVerificationStatus='pending'|'approved'|'rejected'|'revoked'|'cancelled';
export interface SportIdVerificationRequest{
  id:string;userId:string;userName:string;userAvatar:string;claimType:SportIdClaimType;claimId:string;
  title:string;sport:string;date?:string;placement?:string;rankTitle?:string;level?:string;
  evidenceUrls?:string[];sports?:string[];
  evidenceUrl:string;officialUrl:string;note:string;status:SportIdVerificationStatus;
  reviewNote:string;createdAt:string;updatedAt:string;reviewedAt:string;reviewedBy:string;
}
async function call<T>(body:Record<string,unknown>):Promise<T>{
  const uid=auth.currentUser?.uid;
  const token=await auth.currentUser?.getIdToken();if(!token)throw new Error('Требуется повторный вход');
  const response=await apiFetch('/api/sport-id-verification',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));if(auth.currentUser?.uid!==uid)throw new Error('Аккаунт изменился. Откройте раздел заново.');if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data as T;
}
export async function loadSportIdVerificationRequests():Promise<SportIdVerificationRequest[]>{
  const data=await call<{requests:SportIdVerificationRequest[]}>({action:'list'});return Array.isArray(data.requests)?data.requests:[];
}
export async function submitSportIdVerification(input:{claimType:SportIdClaimType;claimId?:string;evidenceUrl?:string;officialUrl?:string;note?:string}):Promise<SportIdVerificationRequest>{
  const data=await call<{request:SportIdVerificationRequest}>({action:'submit',...input});return data.request;
}
export async function cancelSportIdVerification(requestId:string):Promise<void>{await call({action:'cancel',requestId});}

export interface PersonalTrainer {enabled:boolean;sports:string[];status:string;verifiedAt?:string}
export interface TrainerState {trainer:PersonalTrainer;request?:SportIdVerificationRequest|null}
export const loadPersonalTrainer=()=>call<TrainerState>({action:'trainerRead'});
export const savePersonalTrainer=(enabled:boolean,sports:string[])=>call<TrainerState>({action:'trainerSave',enabled,sports});
export const submitPersonalTrainer=(evidenceUrls:string[],note:string,officialUrl:string)=>call<TrainerState>({action:'trainerSubmit',evidenceUrls,note,officialUrl});
export const cancelPersonalTrainer=()=>call<TrainerState>({action:'trainerCancel'});
export const loadPersonalTrainers=(cursor:string|null=null)=>call<{trainers:import('../lib/types').UserProfile[];nextCursor:string|null}>({action:'trainers',cursor});
