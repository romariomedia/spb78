import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { announcementMatchesUser } from '../server/announcements.js';

if(!getApps().length){
  initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется вход'});
    const {uid}=await getAuth().verifyIdToken(token);
    const db=getFirestore();
    const [userSnap,annSnap]=await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('announcements').where('isActive','==',true).limit(50).get()
    ]);
    if(!userSnap.exists)return res.status(404).json({error:'Профиль не найден'});
    const user={...userSnap.data(),id:uid};
    const placement=String(req.query?.placement||'global');
    const now=Date.now();
    const announcements=annSnap.docs
      .map(doc=>({id:doc.id,...doc.data()}))
      .filter(item=>announcementMatchesUser(item,user,placement,now))
      .sort((a,b)=>Number(b.priority||0)-Number(a.priority||0)||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))
      .slice(0,5)
      .map(item=>({
        id:item.id,title:item.title,text:item.text,imageUrl:item.imageUrl||'',buttonLabel:item.buttonLabel||'',
        buttonLink:item.buttonLink||'',placement:item.placement||'global',priority:Number(item.priority||0),
        dismissible:item.dismissible!==false,updatedAt:item.updatedAt||''
      }));
    res.setHeader('Cache-Control','private, max-age=30');
    return res.json({announcements});
  }catch(error){
    const status=error?.code?.startsWith?.('auth/')?401:500;
    if(status===500)console.error('[announcements]',error);
    return res.status(status).json({error:status===401?'Требуется повторный вход':'Не удалось загрузить объявления'});
  }
}
