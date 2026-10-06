import { getAdminSession } from './adminAuth';

export type AdminLeisureDestination={
  id:string;name:string;region:'spb'|'lo'|'karelia';category:'destination'|'rink';season:string;
  format:string;pace:string;description:string;plan:string;access:string;source:string;photo:string;photoCredit:string;
  rinkType?:'outdoor'|'indoor'|'';rental?:boolean;address?:string;phone?:string;website?:string;hours?:string;
  priceText?:string;priceStatus?:string;priceCheckedAt?:string;seasonStatus?:'upcoming'|'open'|'closed'|'unknown'|'';
  isPublished:boolean;createdAt?:string;updatedAt?:string;
};
async function call<T>(body:Record<string,unknown>):Promise<T>{
  const session=getAdminSession();if(!session)throw new Error('admin-otp-required');
  const response=await fetch('/api/admin-mutate-leisure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:session.sessionId,...body})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data as T;
}
export const listAdminLeisure=()=>call<{destinations:AdminLeisureDestination[]}>({operation:'list'});
export const seedAdminLeisure=()=>call<{ok:true;count:number}>({operation:'seed'});
export const mutateAdminLeisure=(operation:'create'|'update'|'delete',destinationId:string,payload?:Partial<AdminLeisureDestination>)=>call<{ok:true;destination:AdminLeisureDestination|null}>({operation,destinationId,...(operation==='create'?{destination:payload}:operation==='update'?{patch:payload}:{})});
