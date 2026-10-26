import {adminPost} from './adminRequest';

export type PartnerMediaType='none'|'image'|'video';
export interface AdminPartner{
  id:string;name:string;partnerLabel:string;offerTitle:string;description:string;promoCode:string;
  ctaLabel:string;ctaUrl:string;logoUrl:string;coverUrl:string;mediaUrl:string;mediaType:PartnerMediaType;
  startAt:string;endAt:string;priority:number;isActive:boolean;
  isAdvertising:boolean;advertiserName:string;advertiserInn:string;erid:string;ordName:string;
  adContractNumber:string;adContractDate:string;adExemptionReason:string;
  createdAt?:string;updatedAt?:string;
}
export type PartnerDraft=Omit<AdminPartner,'id'|'createdAt'|'updatedAt'>;

async function post<T>(body:Record<string,unknown>):Promise<T>{return adminPost<T>('/api/admin-partners',body);}

export async function loadAdminPartners(cursor?:string|null):Promise<{visible:boolean;partners:AdminPartner[];nextCursor:string|null}>{
  const data=await post<{visible:boolean;partners:AdminPartner[];nextCursor?:string|null}>({operation:'list',cursor});
  return {visible:Boolean(data.visible),partners:Array.isArray(data.partners)?data.partners:[],nextCursor:data.nextCursor||null};
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
