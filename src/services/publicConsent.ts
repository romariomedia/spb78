import {apiFetch} from './apiEndpoint';
import {auth} from './firebaseAuth';

export const PUBLIC_DISSEMINATION_VERSION='SB78-PUBLIC-2026-10-26';

export type PublicConsentGroup='identity'|'profile'|'portfolio'|'location'|'presence'|'reputation'|'trainer';

export interface PublicConsentState{
  active:boolean;
  version:string;
  groups:PublicConsentGroup[];
  grantedAt:string;
  revokedAt:string;
}

async function token(){
  const user=auth.currentUser;
  if(!user)throw new Error('Сначала войдите в аккаунт.');
  return user.getIdToken(true);
}

async function request(body:Record<string,unknown>):Promise<{version:string;consent:PublicConsentState}>{
  const response=await apiFetch('/api/public-consent',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${await token()}`},
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Не удалось изменить настройки публичности.');
  return data;
}

export async function loadPublicConsent():Promise<PublicConsentState>{
  return (await request({operation:'get'})).consent;
}

export async function grantPublicConsent(groups:PublicConsentGroup[]):Promise<PublicConsentState>{
  return (await request({
    operation:'grant',
    version:PUBLIC_DISSEMINATION_VERSION,
    confirmed:true,
    groups
  })).consent;
}

export async function revokePublicConsent():Promise<PublicConsentState>{
  return (await request({operation:'revoke'})).consent;
}
