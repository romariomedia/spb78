import {apiFetch} from './apiEndpoint';
import {auth} from './firebaseAuth';
import {adminPost} from './adminRequest';

export type BusinessSubjectType='trainer'|'venue'|'massage';
export type BusinessBillingInterval='monthly'|'yearly';

export interface BusinessPlan {
  label:string;
  monthlyRub:number;
  yearlyRub:number;
}
export interface BusinessBillingConfig {
  enabled:boolean;
  commercialLaunchAt:string;
  billingOpen:boolean;
  plans:Record<BusinessSubjectType,BusinessPlan>;
}
export interface BusinessSubscription {
  id?:string;
  subjectType:BusinessSubjectType;
  subjectId:string;
  subjectLabel:string;
  ownerUserId:string;
  activeUntil:string;
  paidUntil:string;
  complimentaryUntil:string;
  foundingCoachFreeUntil?:string;
  status:'active'|'inactive';
  lastPaymentAt:string;
  lastGrantedAt:string;
}
export interface BusinessBillingState {
  config:BusinessBillingConfig;
  subjects:BusinessSubscription[];
}
export interface AdminBillingState {
  config:Omit<BusinessBillingConfig,'billingOpen'>;
  items:BusinessSubscription[];
  catalog:Record<BusinessSubjectType,Array<{id:string;name:string}>>;
}

const REQUEST_TIMEOUT_MS=20_000;
const pending=new Map<string,{id:string;at:number}>();

async function idToken():Promise<string>{
  const user=auth.currentUser;
  if(!user)throw new Error('Сначала войдите в аккаунт.');
  return user.getIdToken(true);
}
export async function loadBusinessBilling():Promise<BusinessBillingState>{
  const token=await idToken();
  const response=await apiFetch('/api/business-billing',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:'{}'
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Не удалось загрузить коммерческие подписки.');
  return data as BusinessBillingState;
}
function requestKey(uid:string,subjectType:BusinessSubjectType,subjectId:string,interval:BusinessBillingInterval){
  return `sb78_business_payment_${uid}_${subjectType}_${subjectId}_${interval}`;
}
export async function createBusinessPayment(subjectType:BusinessSubjectType,subjectId:string,interval:BusinessBillingInterval){
  const user=auth.currentUser;if(!user)throw new Error('Сначала войдите в аккаунт.');
  const key=requestKey(user.uid,subjectType,subjectId,interval);
  let current=pending.get(key);
  try{
    const stored=JSON.parse(sessionStorage.getItem(key)||'null');
    if(stored&&typeof stored.id==='string'&&Number.isFinite(stored.at))current=stored;
  }catch{/* storage optional */}
  if(!current||Date.now()-current.at>=23*3600000||current.at>Date.now())current={id:crypto.randomUUID(),at:Date.now()};
  pending.set(key,current);try{sessionStorage.setItem(key,JSON.stringify(current));}catch{/* optional */}
  const clear=()=>{pending.delete(key);try{sessionStorage.removeItem(key);}catch{/* optional */}};
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  try{
    const token=await user.getIdToken(true);
    if(auth.currentUser?.uid!==user.uid)throw new Error('Аккаунт изменился. Начните оплату заново.');
    const response=await apiFetch('/api/create-business-payment',{
      method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({subjectType,subjectId,interval,requestId:current.id})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      if([400,401,403,404,409].includes(response.status))clear();
      const error=Object.assign(new Error(data.error||'Не удалось создать платёж ЮKassa.'),{code:data.code,status:response.status});
      throw error;
    }
    clear();
    return {confirmationUrl:String(data.confirmationUrl||''),paymentId:String(data.paymentId||''),amount:String(data.amount||'')};
  }catch(error){
    if(error instanceof DOMException&&error.name==='AbortError')throw new Error('Сервер оплаты не ответил. Проверьте интернет.');
    throw error;
  }finally{window.clearTimeout(timer);}
}

export async function loadAdminBilling():Promise<AdminBillingState>{
  return adminPost<AdminBillingState>('/api/admin-billing',{operation:'get'});
}
export async function saveAdminBillingConfig(config:AdminBillingState['config']):Promise<AdminBillingState['config']>{
  const result=await adminPost<{config:AdminBillingState['config']}>('/api/admin-billing',{operation:'saveConfig',config});
  return result.config;
}
export async function assignBusinessOwner(subjectType:BusinessSubjectType,subjectId:string,ownerUserId:string,note=''){
  return adminPost<{item:BusinessSubscription}>('/api/admin-billing',{operation:'assignOwner',subjectType,subjectId,ownerUserId,note});
}
export async function unlinkBusinessOwner(subjectType:BusinessSubjectType,subjectId:string,note=''){
  return adminPost<{item:BusinessSubscription}>('/api/admin-billing',{operation:'unlinkOwner',subjectType,subjectId,note});
}
export async function grantBusinessAccess(subjectType:BusinessSubjectType,subjectId:string,days:number,note:string){
  return adminPost<{item:BusinessSubscription}>('/api/admin-billing',{operation:'grant',subjectType,subjectId,days,note});
}
