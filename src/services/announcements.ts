import { auth } from './firebaseAuth';

export interface AppAnnouncement{
  id:string;title:string;text:string;imageUrl:string;buttonLabel:string;buttonLink:string;
  placement:string;priority:number;dismissible:boolean;updatedAt:string;
}
export async function loadAnnouncements(placement:string):Promise<AppAnnouncement[]>{
  const token=await auth.currentUser?.getIdToken();
  if(!token)return [];
  const response=await fetch(`/api/announcements?placement=${encodeURIComponent(placement)}`,{headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok)return [];
  const data=await response.json().catch(()=>({}));
  return Array.isArray(data.announcements)?data.announcements:[];
}
