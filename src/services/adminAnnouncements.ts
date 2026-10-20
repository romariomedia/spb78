import {adminPost} from './adminRequest';

export type AnnouncementPlacement='global'|'discover'|'trainings'|'leisure'|'feed'|'profile';
export type AnnouncementAudience='all'|'verified'|'district'|'sport';
export interface AdminAnnouncement{
  id:string;title:string;text:string;imageUrl:string;buttonLabel:string;buttonLink:string;
  placement:AnnouncementPlacement;audienceType:AnnouncementAudience;audienceValue:string;
  startAt:string;endAt:string;priority:number;isActive:boolean;dismissible:boolean;
  createdAt?:string;updatedAt?:string;
}
export type AnnouncementDraft=Omit<AdminAnnouncement,'id'|'createdAt'|'updatedAt'>;

async function post<T>(body:Record<string,unknown>):Promise<T>{return adminPost<T>('/api/admin-announcements',body);}

export async function loadAdminAnnouncementsPage(cursor?:string|null):Promise<{items:AdminAnnouncement[];nextCursor:string|null}>{
 const data=await post<{announcements:AdminAnnouncement[];nextCursor?:string|null}>({operation:'list',cursor});return {items:Array.isArray(data.announcements)?data.announcements:[],nextCursor:data.nextCursor||null};
}
export async function loadAdminAnnouncements():Promise<AdminAnnouncement[]>{return (await loadAdminAnnouncementsPage()).items;}

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
