import { getAdminSession } from './adminAuth';

export interface AdminPushAudience {
  userId:string;
  districtId:string;
  sport:string;
  verifiedOnly:boolean;
  activeWithinDays:0|30;
}

export interface AdminPushSample {
  id:string;
  name:string;
  districtId:string;
  sports:string[];
}

export interface AdminPushPreview {
  id:string;
  audience:AdminPushAudience;
  audienceCount:number;
  sample:AdminPushSample[];
  title:string;
  message:string;
  link:string;
  scheduledAt:string;
  expiresAt:string;
}

export interface AdminPushCampaign {
  id:string;
  title:string;
  message:string;
  link:string;
  audience:AdminPushAudience;
  audienceCount:number;
  processedCount:number;
  status:'scheduled'|'queued'|'processing'|'retrying'|'completed'|'failed'|'expired'|'cancelled'|string;
  createdAt:string;
  scheduledAt:string;
  completedAt:string;
  createdBy:string;
  lastError:string;
}

async function post<T>(body:Record<string,unknown>):Promise<T>{
  const session=getAdminSession();
  if(!session)throw new Error('admin-otp-required');
  const response=await fetch('/api/admin-push',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...body,sessionId:session.sessionId})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data as T;
}

export async function previewAdminPush(input:{
  audience:AdminPushAudience;title:string;message:string;link:string;scheduledAt:string;
}):Promise<AdminPushPreview>{
  const data=await post<{preview:AdminPushPreview}>({operation:'preview',...input});
  return data.preview;
}

export async function sendAdminPush(previewId:string):Promise<AdminPushCampaign>{
  const data=await post<{campaign:AdminPushCampaign}>({
    operation:'send',previewId,requestId:crypto.randomUUID?.()||String(Date.now())
  });
  return data.campaign;
}

export async function loadAdminPushCampaigns():Promise<AdminPushCampaign[]>{
  const data=await post<{campaigns:AdminPushCampaign[]}>({operation:'list'});
  return Array.isArray(data.campaigns)?data.campaigns:[];
}

export async function cancelAdminPushCampaign(campaignId:string):Promise<void>{
  await post({operation:'cancel',campaignId,requestId:crypto.randomUUID?.()||String(Date.now())});
}
