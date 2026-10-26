import {adminPost} from './adminRequest';
import {apiFetch} from './apiEndpoint';
import {auth} from './firebaseAuth';
export interface MassageListing {
 id:string;providerType:'salon'|'private';name:string;description:string;services:string;priceText:string;
 address:string;district:string;hours:string;phone:string;bookingUrl:string;
 research?:{rating:number;reviewCount:number;checkedAt:string;reviewUrl:string;officialUrl:string;photoSourceUrl:string}|null;
 media:{type:'image'|'video';url:string}[];isPublished:boolean;isPromoted?:boolean;
}
export async function loadMassage(signal?:AbortSignal):Promise<MassageListing[]>{
 const token=await auth.currentUser?.getIdToken();if(!token)throw new Error('Войдите в аккаунт');
 const response=await apiFetch('/api/massage',{signal,headers:{Authorization:`Bearer ${token}`}});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Не удалось загрузить услуги');
 return Array.isArray(data.items)?data.items:[];
}
export async function adminMassage(operation:'list'|'create'|'update'|'delete',id?:string,item?:MassageListing,cursor?:string|null){
 return adminPost<{items?:MassageListing[];nextCursor?:string|null}>('/api/admin-massage',{operation,id,item,cursor});
}
