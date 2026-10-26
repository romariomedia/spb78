import {apiFetch} from './apiEndpoint';
import {auth} from './firebaseAuth';

export type PrivacyRequestType='access'|'correction'|'restriction'|'stop_processing'|'deletion'|'other';
export interface PrivacyRequest{
  id:string;type:PrivacyRequestType;status:string;details:string;createdAt:string;updatedAt:string;responseNote:string;
}

async function call<T>(body:Record<string,unknown>):Promise<T>{
  const user=auth.currentUser;if(!user)throw new Error('Сначала войдите в аккаунт.');
  const token=await user.getIdToken(true);
  const response=await apiFetch('/api/privacy-request',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Не удалось обработать запрос по персональным данным.');
  return data as T;
}

export async function loadPrivacyRequests(){return (await call<{requests:PrivacyRequest[]}>({operation:'list'})).requests;}
export async function createPrivacyRequest(type:PrivacyRequestType,details:string){
  return (await call<{request:PrivacyRequest}>({operation:'create',type,details})).request;
}
