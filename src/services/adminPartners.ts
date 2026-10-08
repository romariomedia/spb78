import { apiBase } from './serverApi';
import { getAdminSession } from './adminAuth';

export type PartnerMediaType='none'|'image'|'video';
export interface AdminPartner{
  id:string;name:string;partnerLabel:string;offerTitle:string;description:string;promoCode:string;
  ctaLabel:string;ctaUrl:string;logoUrl:string;coverUrl:string;mediaUrl:string;mediaType:PartnerMediaType;
  startAt:string;endAt:string;priority:number;isActive:boolean;createdAt?:string;updatedAt?:string;
}
export type PartnerDraft=Omit<AdminPartner,'id'|'createdAt'|'updatedAt'>;

async function post<T>(body:Record<string,unknown>):Promise<T>{
  const session=getAdminSession();if(!session)throw new Error('admin-otp-required');
  const response=await fetch(`${apiBase()}/api/admin-partners`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...body,sessionId:session.sessionId})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data as T;
}

export async function loadAdminPartners():Promise<{visible:boolean;partners:AdminPartner[]}>{
  const data=await post<{visible:boolean;partners:AdminPartner[]}>({operation:'list'});
  return {visible:Boolean(data.visible),partners:Array.isArray(data.partners)?data.partners:[]};
}
export async function setPartnersVisibility(visible:boolean):Promise<boolean>{
  const data=await post<{visible:boolean}>({operation:'setVisibility',visible,requestId:crypto.randomUUID?.()||String(Date.now())});
  return Boolean(data.visible);
}
export async function createAdminPartner(partner:PartnerDraft):Promise<AdminPartner>{
  const data=await post<{partner:AdminPartner}>({operation:'create',partner,requestId:crypto.randomUUID?.()||String(Date.now())});
  return data.partner;
}
export async function updateAdminPartner(id:string,partner:PartnerDraft):Promise<AdminPartner>{
  const data=await post<{partner:AdminPartner}>({operation:'update',id,partner,requestId:crypto.randomUUID?.()||String(Date.now())});
  return data.partner;
}
export async function deleteAdminPartner(id:string):Promise<void>{
  await post({operation:'delete',id,requestId:crypto.randomUUID?.()||String(Date.now())});
}
