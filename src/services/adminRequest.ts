import {apiFetch} from './apiEndpoint';
import {getAdminSession} from './adminAuth';
const key='sb78_admin_pending_creates';
const pending=new Map<string,string>();
let loaded=false;
function persist(){try{sessionStorage.setItem(key,JSON.stringify([...pending]));}catch{/* in-memory retry remains available */}}
export async function adminPost<T>(path:string,body:Record<string,unknown>):Promise<T>{
 const session=getAdminSession();if(!session)throw new Error('admin-otp-required');
 if(!loaded){loaded=true;try{const saved=JSON.parse(sessionStorage.getItem(key)||'[]');if(Array.isArray(saved))for(const row of saved.slice(-40))if(Array.isArray(row)&&typeof row[0]==='string'&&typeof row[1]==='string')pending.set(row[0],row[1]);}catch{/* storage optional */}}
 const {requestId:ignored,...payload}=body;
 const retryKey=body.operation==='create'?JSON.stringify([session.sessionId,path,payload]):'';
 let requestId=body.requestId;
 if(retryKey){requestId=pending.get(retryKey)||crypto.randomUUID();pending.set(retryKey,String(requestId));while(pending.size>40)pending.delete(pending.keys().next().value!);persist();}
 const response=await apiFetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,requestId,sessionId:session.sessionId})});
 const data=await response.json();
 if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
 if(retryKey){pending.delete(retryKey);persist();}
 return data as T;
}
