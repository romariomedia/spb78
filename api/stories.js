import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {createStory,listStories,readStory,deleteStory} from '../server/stories.js';
import {requireActiveUser} from '../server/user-status.js';
const rates=new Map();
function rateLimit(uid){
 const now=Date.now();for(const [key,value] of rates)if(value.until<=now)rates.delete(key);
 const value=rates.get(uid)||{until:now+60000,count:0};value.count++;rates.set(uid,value);
 if(value.count>90)throw Object.assign(new Error('Слишком много запросов. Подождите минуту.'),{status:429});
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const {uid}=await getAuth().verifyIdToken(token,true),db=getFirestore();
  await requireActiveUser(db,uid);
  rateLimit(uid);
  if(req.body?.action==='list')return res.json(await listStories(db,req.body.cursor));
  if(req.body?.action==='read')return res.json(await readStory(db,req.body.id));
  if(req.body?.action==='create'&&req.body.ownerId!==uid)return res.status(409).json({error:'Аккаунт изменился. Откройте публикацию заново.'});
  if(req.body?.action==='create')return res.json({story:await createStory(db,uid,req.body)});
  if(req.body?.action==='delete'){await deleteStory(db,uid,req.body.id);return res.json({ok:true});}
  return res.status(400).json({error:'Неизвестное действие'});
 }catch(e){const status=e.code?.startsWith?.('auth/')?401:e.status||500;if(status===500)console.error('[stories] operation failed',e.code||e.name);return res.status(status).json({error:status===500?'Истории временно недоступны. Повторите попытку.':status===401?'Войдите в аккаунт заново.':e.message});}
}
