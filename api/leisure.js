import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {createLeisure,changeLeisure,listLeisure,readLeisure,listLeisureDestinations} from '../server/leisure.js';
import {requireActiveUser} from '../server/user-status.js';
const rates=new Map();
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token)return res.status(401).json({error:'Войдите в аккаунт'});
  const {uid}=await getAuth().verifyIdToken(token,true),db=getFirestore();
  const now=Date.now();for(const [key,value] of rates)if(value.until<=now)rates.delete(key);
  const rate=rates.get(uid)||{until:now+60000,count:0};rate.count++;rates.set(uid,rate);
  if(rate.count>90)return res.status(429).json({error:'Слишком много запросов. Подождите минуту.'});
  const b=req.body||{};
  if(b.action==='catalog')return res.json({destinations:await listLeisureDestinations(db)});
  if(b.action==='list')return res.json(await listLeisure(db,b.cursor));
  if(b.action==='read')return res.json({event:await readLeisure(db,b.id)});
  if(b.action==='create'){await requireActiveUser(db,uid);return res.json({event:await createLeisure(db,uid,b)});}
  if(['join','leave','cancel'].includes(b.action)){await requireActiveUser(db,uid);return res.json({event:await changeLeisure(db,uid,b.id,b.action)});}
  return res.status(400).json({error:'Неизвестное действие'});
 }catch(e){const status=e.code?.startsWith?.('auth/')?401:e.status||500;if(status===500)console.error('[leisure]',e.code||e.name);return res.status(status).json({error:status===500?'Не удалось обновить встречи. Повторите попытку.':status===401?'Войдите в аккаунт заново.':e.message});}
}
