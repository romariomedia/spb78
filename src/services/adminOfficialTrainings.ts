import { apiBase } from './serverApi';
import { getAdminSession } from './adminAuth';
import { Training } from '../lib/types';

export type OfficialTrainingStatus='draft'|'published'|'completed'|'cancelled';
export interface OfficialTraining extends Training{
  isOfficial:true;
  officialOrganizerName:string;
  officialStatus:OfficialTrainingStatus;
  updatedAt?:string;
  cancelledAt?:string;
}
export interface OfficialTrainingDraft{
  title:string;sport:string;dateKey:string;dateLabel:string;time:string;districtId?:string;
  locationName:string;address:string;lat:number;lng:number;level:'amateur'|'semi-pro'|'pro';
  participantsMax:number;participantGender:'any'|'male'|'female';description:string;
  venueId?:string;venueName?:string;officialStatus:OfficialTrainingStatus;
}
async function post<T>(body:Record<string,unknown>):Promise<T>{
  const session=getAdminSession();if(!session)throw new Error('admin-otp-required');
  const response=await fetch(`${apiBase()}/api/admin-official-trainings`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...body,sessionId:session.sessionId})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data as T;
}
export async function loadOfficialTrainings():Promise<OfficialTraining[]>{
  const data=await post<{trainings:OfficialTraining[]}>({operation:'list'});
  return Array.isArray(data.trainings)?data.trainings:[];
}
export async function createOfficialTraining(training:OfficialTrainingDraft):Promise<OfficialTraining>{
  const data=await post<{training:OfficialTraining}>({operation:'create',training,requestId:crypto.randomUUID?.()||String(Date.now())});return data.training;
}
export async function updateOfficialTraining(id:string,training:OfficialTrainingDraft):Promise<OfficialTraining>{
  const data=await post<{training:OfficialTraining}>({operation:'update',id,training,requestId:crypto.randomUUID?.()||String(Date.now())});return data.training;
}
export async function completeOfficialTraining(id:string):Promise<OfficialTraining>{
  const data=await post<{training:OfficialTraining}>({operation:'complete',id,requestId:crypto.randomUUID?.()||String(Date.now())});return data.training;
}
export async function cancelOfficialTraining(id:string):Promise<OfficialTraining>{
  const data=await post<{training:OfficialTraining}>({operation:'cancel',id,requestId:crypto.randomUUID?.()||String(Date.now())});return data.training;
}
export async function deleteOfficialTraining(id:string):Promise<void>{
  await post({operation:'delete',id,requestId:crypto.randomUUID?.()||String(Date.now())});
}
