import { getAdminSession } from './adminAuth';

export interface AdminUserRow {
  id:string;
  name:string;
  email:string;
  districtId:string;
  sports:string[];
  isVerified:boolean;
  verifiedAt:string;
  registeredAt:string;
  lastSeenAt:number;
  premiumUntil:string;
  hasRealPhoto:boolean;
  subscriptionPlan:'free'|'premium';
}

export interface AppConfig {
  featureFlags:{
    activeLeisureEnabled:boolean;
    datingEnabled:boolean;
    pushEnabled:boolean;
    storiesEnabled:boolean;
    sportPassportEnabled:boolean;
    boxEnabled:boolean;
  };
  product:{
    freeMatches:number;
    matchWindowDays:number;
    premiumFreeUntil:string;
    boxLaunchAt:string;
    minimumAndroidVersion:string;
    ruStoreUrl:string;
    maintenanceMode:boolean;
    maintenanceMessage:string;
  };
}

async function post<T>(path:string, body:Record<string,unknown>):Promise<T>{
  const session=getAdminSession();
  if(!session) throw new Error('admin-otp-required');
  const response=await fetch(path,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...body,sessionId:session.sessionId})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||`HTTP ${response.status}`);
  return data as T;
}

export async function loadAdminUsers(query=''):Promise<AdminUserRow[]>{
  const data=await post<{users:AdminUserRow[]}>('/api/admin-users',{operation:'list',query});
  return data.users;
}
export async function setAdminUserVerification(userId:string,verified:boolean):Promise<void>{
  await post('/api/admin-users',{operation:'setVerification',userId,verified,requestId:crypto.randomUUID?.()||String(Date.now())});
}
export async function setAdminUserPremiumUntil(userId:string,premiumUntil:string):Promise<void>{
  await post('/api/admin-users',{operation:'setPremiumUntil',userId,premiumUntil,requestId:crypto.randomUUID?.()||String(Date.now())});
}
export async function loadAppConfig():Promise<AppConfig>{
  const data=await post<{config:AppConfig}>('/api/admin-config',{operation:'get'});
  return data.config;
}
export async function saveFeatureFlags(featureFlags:AppConfig['featureFlags']):Promise<AppConfig>{
  const data=await post<{config:AppConfig}>('/api/admin-config',{operation:'saveFeatureFlags',featureFlags,requestId:crypto.randomUUID?.()||String(Date.now())});
  return data.config;
}
export async function saveProductSettings(product:AppConfig['product']):Promise<AppConfig>{
  const data=await post<{config:AppConfig}>('/api/admin-config',{operation:'saveProductSettings',product,requestId:crypto.randomUUID?.()||String(Date.now())});
  return data.config;
}
