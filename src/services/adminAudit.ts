import {apiFetch} from './apiEndpoint';
import { getAdminSession } from './adminAuth';

export interface AdminAuditEntry{
  id:string;adminEmail:string;action:string;entityType:string;entityId:string;
  before:unknown;after:unknown;requestId:string;createdAt:string;
}
export async function loadAdminAudit(limit=50,cursor:string|null=null):Promise<{entries:AdminAuditEntry[];nextCursor:string|null}>{
  const session=getAdminSession();if(!session)throw new Error('admin-otp-required');
  const response=await apiFetch('/api/admin-audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:session.sessionId,limit,cursor})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return {entries:Array.isArray(data.entries)?data.entries:[],nextCursor:data.nextCursor||null};
}
