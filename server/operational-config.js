import {getFirestore} from 'firebase-admin/firestore';
import {effectiveOperations,operationDenial} from '../shared/operational-policy.js';
let cached, until=0;
export function invalidateOperationalConfig(){until=0;}
export async function readOperations(){
 if(cached && Date.now()<until)return cached;
 const snap=await getFirestore().doc('appConfig/main').get();
 cached=effectiveOperations(snap.exists?snap.data():{});
 until=Date.now()+5000;
 return cached;
}
export async function enforceOperations(route,req,res){
 if(route.startsWith('admin-')||['app-config','payment-webhook'].includes(route))return false;
 try{
  const denial=operationDenial(await readOperations(),route,route==='guest-catalog'?req.query?.section:req.body?.action);
  if(!denial)return false;
  if(denial.status===503)res.setHeader('Retry-After','30');
  res.status(denial.status).json(denial);return true;
 }catch{
  res.status(503).json({code:'CONFIG_UNAVAILABLE',error:'Не удалось проверить доступность сервиса. Повторите попытку.'});return true;
 }
}
