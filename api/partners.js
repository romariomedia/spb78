import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readUserStatus } from '../server/user-status.js';
import { partnerIsPublished } from '../server/partners.js';

if(!getApps().length){
  initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется вход'});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();
    await readUserStatus(db,uid);
    res.setHeader('Cache-Control','private, no-store');
    const configSnap=await db.collection('partnerConfig').doc('main').get();
    const visible=configSnap.exists&&configSnap.data()?.visible===true;
    if(!visible)return res.json({visible:false,partners:[]});
    // Apply publication dates and global priority before the display limit.
    const itemsSnap=await db.collection('partners').where('isActive','==',true).get();
    const now=Date.now();
    const partners=itemsSnap.docs
      .map(doc=>({id:doc.id,...doc.data()}))
      .filter(item=>partnerIsPublished(item,now))
      .sort((a,b)=>Number(b.priority||0)-Number(a.priority||0)||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))
      .slice(0,20)
      .map(item=>({
        id:item.id,name:item.name,partnerLabel:item.partnerLabel||'Партнёр SportBuddy78',offerTitle:item.offerTitle,
        description:item.description,promoCode:item.promoCode||'',ctaLabel:item.ctaLabel||'Подробнее',ctaUrl:item.ctaUrl||'',
        logoUrl:item.logoUrl||'',coverUrl:item.coverUrl||'',mediaUrl:item.mediaUrl||'',mediaType:item.mediaType||'none',
        startAt:item.startAt||'',endAt:item.endAt||'',priority:Number(item.priority||0)
      }));
    return res.json({visible:true,partners});
  }catch(error){
    const status=error?.code?.startsWith?.('auth/')?401:error.status||500;
    if(status===500)console.error('[partners]',error);
    return res.status(status).json({error:status===401?'Требуется повторный вход':status===403?'Аккаунт ограничен':'Не удалось загрузить партнёров'});
  }
}
