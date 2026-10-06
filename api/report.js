import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { complaintDailyId,sanitizeComplaintInput } from '../server/report-policy.js';
import { requireActiveUser } from '../server/user-status.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется вход'});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();await requireActiveUser(db,uid);
    const input=sanitizeComplaintInput(req.body||{});
    if(input.targetUserId===uid)return res.status(400).json({error:'Нельзя пожаловаться на свой аккаунт.'});
    const chat=await db.collection('chats').doc(input.chatId).get();
    if(!chat.exists)return res.status(404).json({error:'Диалог не найден.'});
    const thread=chat.data()||{},participants=Array.isArray(thread.participantIds)?thread.participantIds:[];
    if(!participants.includes(uid)||!participants.includes(input.targetUserId))return res.status(403).json({error:'Жалоба доступна только для вашего реального диалога.'});
    const messages=Array.isArray(thread.messages)?thread.messages:[];
    if(messages.length<1)return res.status(409).json({error:'В диалоге нет сообщений.'});
    const now=Date.now(),id=complaintDailyId(uid,input.targetUserId,input.chatId,now);
    const ref=db.collection('reports').doc(id);
    const existing=await ref.get();
    if(existing.exists)return res.status(409).json({error:'Жалоба на этот диалог уже отправлена сегодня.'});
    const excerpt=messages.slice(-5).map(m=>({senderId:String(m.senderId||''),text:String(m.text||'').slice(0,1000),timestamp:Number(m.timestamp||0)}));
    const [reporterSnap,targetSnap]=await Promise.all([db.collection('users').doc(uid).get(),db.collection('users').doc(input.targetUserId).get()]);
    const report={
      id,type:'chat_user',reporterId:uid,reporterName:String(reporterSnap.data()?.name||'Спортсмен').slice(0,120),
      targetUserId:input.targetUserId,targetName:String(targetSnap.data()?.name||'Спортсмен').slice(0,120),
      chatId:input.chatId,reason:input.reason,details:input.details,excerpt,status:'new',
      createdAt:new Date(now).toISOString(),createdAtMs:now,updatedAt:new Date(now).toISOString(),updatedAtMs:now
    };
    await ref.create(report);
    return res.json({ok:true,reportId:id});
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[report]',error);
    return res.status(status).json({error:status===500?'Не удалось отправить жалобу.':error.message});
  }
}
