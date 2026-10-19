import {apiFetch} from './apiEndpoint';
export interface GuestItem {id:string;title:string;description?:string;services?:string;photo?:string;label?:string;address?:string;price?:string;date?:string;time?:string;sport?:string;participantCount?:number;capacity?:number}
export type GuestSection='trainings'|'events'|'leisure'|'massage'|'partners'|'venues';
export async function loadGuestCatalog<T=GuestItem>(section:GuestSection,signal?:AbortSignal):Promise<T[]>{
 const response=await apiFetch(`/api/guest-catalog?section=${section}`,{signal});const data=await response.json();
 if(!response.ok||!Array.isArray(data.items))throw new Error(data.error||'Не удалось загрузить каталог');return data.items;
}
/** OAuth must keep priority over guest browsing, including a cold Android callback. */
export function needsAuthScreen(url:string,storage?:Pick<Storage,'getItem'>):boolean {
 try{const parsed=new URL(url);if(parsed.searchParams.has('code')||parsed.searchParams.has('error')||parsed.pathname.endsWith('/vk-callback'))return true;
  return !!storage?.getItem('sportbuddy_vk_pending_callback');
 }catch{return false;}
}
