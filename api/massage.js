import {getApps,initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {readUserStatus} from '../server/user-status.js';
import {publicMassage} from '../server/massage.js';
import {COMMERCIAL_LAUNCH_AT,businessListingStates,getBillingConfig} from '../server/business-billing.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{
  if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token)return res.status(401).json({error:'Войдите в аккаунт'});
  const {uid}=await getAuth().verifyIdToken(token,true),db=getFirestore();await readUserStatus(db,uid);
  const snapshot=await db.collection('massageServices').where('isPublished','==',true).limit(200).get();
  const afterLaunch=Date.now()>=Date.parse(COMMERCIAL_LAUNCH_AT);
  const billingConfig=afterLaunch?await getBillingConfig(db):null;
  const states=afterLaunch?await businessListingStates(db,'massage',snapshot.docs.map(doc=>doc.id),billingConfig):new Map();
  const items=snapshot.docs.map(doc=>{
    let item;try{item=publicMassage(doc.id,doc.data());}catch{return null;}
    if(!item)return null;
    const state=states.get(doc.id);
    if(afterLaunch&&state?.allowed!==true)return null;
    return state?.isPromoted?{...item,isPromoted:true}:item;
  }).filter(Boolean).sort((a,b)=>Number(b.isPromoted===true)-Number(a.isPromoted===true)||a.name.localeCompare(b.name,'ru'));
  return res.json({items});
 }catch(error){const status=error.code?.startsWith?.('auth/')?401:error.status||500;return res.status(status).json({error:status===401?'Войдите в аккаунт заново':'Не удалось загрузить услуги массажа'});}
}
