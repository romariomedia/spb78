import {adminPost} from './adminRequest';
export type AdminPrivacyRequestStatus='received'|'in_review'|'waiting_user'|'completed'|'rejected';
export interface AdminPrivacyRequest{
  id:string;ownerUserId:string;contactEmail:string;type:string;details:string;status:AdminPrivacyRequestStatus;
  createdAt:string;updatedAt:string;responseNote:string;reviewedBy:string;
}
export const loadAdminPrivacyRequests=()=>adminPost<{requests:AdminPrivacyRequest[]}>('/api/admin-privacy-requests',{operation:'list'});
export const updateAdminPrivacyRequest=(id:string,status:AdminPrivacyRequestStatus,responseNote:string)=>
  adminPost<{request:AdminPrivacyRequest}>('/api/admin-privacy-requests',{operation:'update',id,status,responseNote,requestId:crypto.randomUUID?.()||String(Date.now())});
