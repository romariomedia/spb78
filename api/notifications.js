import { getApps,initializeApp,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { cleanSettings,notificationId,enqueueNotification } from '../server/notification-policy.js';
import { readUserStatus } from '../server/user-status.js';
const streams=new Set();
export const stopNotificationStreams=()=>{for(const close of streams)close();};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export default async function handler(req,res) {
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try {
    if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!token)throw fail('Требуется вход',401);
    const {uid}=await getAuth().verifyIdToken(token),db=getFirestore(),body=req.body||{};
    await readUserStatus(db,uid);
    const inbox=db.collection('notificationInboxes').doc(uid),settings=db.collection('notificationSettings').doc(uid);
    if(body.action==='stream') {
      res.set({'Content-Type':'application/x-ndjson','Cache-Control':'no-cache, no-store','X-Accel-Buffering':'no'});res.flushHeaders();
      let ended=false,unsubscribe=()=>{},heartbeat,expiry;
      const stop=()=>{if(ended)return;ended=true;streams.delete(stop);unsubscribe();clearInterval(heartbeat);clearTimeout(expiry);res.end();};
      streams.add(stop);
      unsubscribe=inbox.onSnapshot(s=>{
        const entries=(s.data()?.entries||[]).filter(n=>n.createdAt>Date.now()-30*86400000);
        res.write(JSON.stringify({entries})+'\n');
      },()=>stop());
      heartbeat=setInterval(()=>res.write('{}\n'),20000);
      expiry=setTimeout(stop,45*60000);res.on('close',stop);return;
    }
    if(body.action==='test') {
      await db.runTransaction(async tx=>{
        const s=await tx.get(settings),now=Date.now();
        if(now-Number(s.data()?.lastTestAt||0)<60000)throw fail('Повторите проверку через минуту',429);
        tx.set(settings,{lastTestAt:now},{merge:true});
        enqueueNotification(tx,db,{id:`push-test:${uid}:${now}`,actorId:'',recipients:[uid],category:'events',kind:'push_test',title:'SportBuddy на связи',message:'Проверочное уведомление. Можно возвращаться к спорту!',link:'#notifications'});
      });
      return res.json({ok:true});
    }
    if(body.action==='settings') {
      if(body.settings)await settings.set(cleanSettings(body.settings),{merge:true});
      return res.json({settings:cleanSettings((await settings.get()).data())});
    }
    if(body.action==='read') {
      const ids=Array.isArray(body.ids)?body.ids.filter(x=>typeof x==='string').slice(0,100):[];
      await db.runTransaction(async tx=>{const s=await tx.get(inbox);if(s.exists)tx.update(inbox,{entries:(s.data().entries||[]).map(n=>ids.includes(n.id)?{...n,read:true}:n)});});
      return res.json({ok:true});
    }
    if(body.action==='register'||body.action==='unregister') {
      const pushToken=String(body.token||'');
      if(pushToken.length<20||pushToken.length>4096)throw fail('Некорректная регистрация устройства');
      const ref=db.collection('pushDevices').doc(notificationId(pushToken));
      if(body.action==='register') {
        if(!(await db.collection('users').doc(uid).get()).exists)throw fail('Профиль не найден',404);
        await ref.set({uid,token:pushToken,updatedAt:Date.now()});
      }else await db.runTransaction(async tx=>{const s=await tx.get(ref);if(s.data()?.uid===uid)tx.delete(ref);});
      return res.json({ok:true});
    }
    throw fail('Неизвестное действие');
  }catch(e){if(res.headersSent)return res.end();return res.status(e.code?.startsWith('auth/')?401:e.status||500).json({error:e.status?e.message:'Не удалось обработать уведомления'});}
}
