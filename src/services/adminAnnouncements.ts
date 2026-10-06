import { getAdminSession } from './adminAuth';

export type AnnouncementPlacement='global'|'discover'|'trainings'|'leisure'|'feed'|'profile';
export type AnnouncementAudience='all'|'verified'|'district'|'sport';
export interface AdminAnnouncement{
  id:string;title:string;text:string;imageUrl:string;buttonLabel:string;buttonLink:string;
  placement:AnnouncementPlacement;audienceType:AnnouncementAudience;audienceValue:string;
  startAt:string;endAt:string;priority:number;isActive:boolean;dismissible:boolean;
  createdAt?:string;updatedAt?:string;
}
export type AnnouncementDraft=Omit<AdminAnnouncement,'id'|'createdAt'|'updatedAt'>;

async function post<T>(body:Record<string,unknown>):Promise<T>{
  const session=getAdminSession();if(!session)throw new Error('admin-otp-required');
  const response=await fetch('/api/admin-announcements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,sessionId:session.sessionId})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data as T;
}
export async function loadAdminAnnouncements():Promise<AdminAnnouncement[]>{
  const data=await post<{announcements:AdminAnnouncement[]}>({operation:'list'});
  return Array.isArray(data.announcements)?data.announcements:[];
}
export async function createAdminAnnouncement(announcement:AnnouncementDraft):Promise<AdminAnnouncement>{
  const data=await post<{announcement:AdminAnnouncement}>({operation:'create',announcement,requestId:crypto.randomUUID?.()||String(Date.now())});
  return data.announcement;
}
export async function updateAdminAnnouncement(id:string,announcement:AnnouncementDraft):Promise<AdminAnnouncement>{
  const data=await post<{announcement:AdminAnnouncement}>({operation:'update',id,announcement,requestId:crypto.randomUUID?.()||String(Date.now())});
  return data.announcement;
}
export async function deleteAdminAnnouncement(id:string):Promise<void>{
  await post({operation:'delete',id,requestId:crypto.randomUUID?.()||String(Date.now())});
}
