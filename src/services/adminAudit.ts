import { getAdminSession } from './adminAuth';

export interface AdminAuditEntry{
  id:string;adminEmail:string;action:string;entityType:string;entityId:string;
  before:unknown;after:unknown;requestId:string;createdAt:string;
}
export async function loadAdminAudit(limit=50):Promise<AdminAuditEntry[]>{
  const session=getAdminSession();if(!session)throw new Error('admin-otp-required');
  const response=await fetch('/api/admin-audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:session.sessionId,limit})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return Array.isArray(data.entries)?data.entries:[];
}
