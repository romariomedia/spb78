import {readOperations} from '../server/operational-config.js';
import {getApps,initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {requireActiveUser} from '../server/user-status.js';
import {assistantTopics,assistantTransition} from '../server/onboarding-assistant.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try {
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token)return res.status(401).json({error:'Требуется вход'});
  if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
  const {uid}=await getAuth().verifyIdToken(token),db=getFirestore();
  const {profile}=await requireActiveUser(db,uid);
  if(process.env.SB_ASSISTANT_ENABLED==='false'||!(await readOperations()).featureFlags.assistantEnabled)return res.json({enabled:false});
  const ref=db.collection('assistantConversations').doc(uid),body=req.body||{};
  const state=await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),previous=snap.exists?snap.data():null;
   const next=assistantTransition(previous,body,Date.now(),profile.registeredAt);
   if(!previous||next!==previous)tx.set(ref,next);
   return next;
  });
  return res.json({enabled:true,state,topics:assistantTopics()});
 }catch(error){return res.status(error.code?.startsWith('auth/')?401:error.status||500).json({error:error.status?error.message:'Не удалось загрузить помощника. Повторите попытку.'});}
}
