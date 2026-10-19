import {apiFetch} from './apiEndpoint';
import {auth} from './firebaseAuth';
import {getAdminSession} from './adminAuth';
export interface MassageListing {
 id:string;providerType:'salon'|'private';name:string;description:string;services:string;priceText:string;
 address:string;district:string;hours:string;phone:string;bookingUrl:string;
 media:{type:'image'|'video';url:string}[];isPublished:boolean;
}
export async function loadMassage(signal?:AbortSignal):Promise<MassageListing[]>{
 const token=await auth.currentUser?.getIdToken();if(!token)throw new Error('Войдите в аккаунт');
 const response=await apiFetch('/api/massage',{signal,headers:{Authorization:`Bearer ${token}`}});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Не удалось загрузить услуги');
 return Array.isArray(data.items)?data.items:[];
}
export async function adminMassage(operation:'list'|'create'|'update'|'delete',id?:string,item?:MassageListing){
 const session=getAdminSession();if(!session)throw new Error('Войдите в админку заново');
 const response=await apiFetch('/api/admin-massage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:session.sessionId,operation,id,item})});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Не удалось сохранить');
 return data as {items?:MassageListing[]};
}
