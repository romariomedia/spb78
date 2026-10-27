import {privacyRequestPage} from '../server/privacy-request-page.js';
import {randomUUID} from 'node:crypto';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {requireActiveUser} from '../server/user-status.js';

if(!getApps().length){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(raw?{credential:cert(JSON.parse(raw))}:undefined);
}

const TYPES=new Set(['access','correction','restriction','stop_processing','deletion','other']);
const clean=(v,max=1200)=>typeof v==='string'?v.trim().slice(0,max):'';

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется авторизация'});
    const decoded=await getAuth().verifyIdToken(token,true);
    const uid=decoded.uid,db=getFirestore();
    await requireActiveUser(db,uid);
    const operation=String(req.body?.operation||'list');

    if(operation==='list'){
      const page=await privacyRequestPage(db,{ownerUserId:uid,cursor:req.body?.cursor});
      const requests=page.docs.map(doc=>({id:doc.id,...doc.data()}))
        .map(row=>({
          id:String(row.id),type:String(row.type||''),status:String(row.status||'received'),
          details:String(row.details||''),createdAt:String(row.createdAt||''),updatedAt:String(row.updatedAt||''),
          responseNote:String(row.responseNote||'')
        }));
      return res.json({requests,nextCursor:page.nextCursor});
    }

    if(operation==='create'){
      const type=String(req.body?.type||'');
      if(!TYPES.has(type))return res.status(400).json({error:'Некорректный тип запроса'});
      const details=clean(req.body?.details,1200);
      if(type==='other'&&details.length<10)return res.status(400).json({error:'Опишите запрос подробнее.'});
      const now=new Date().toISOString(),id=randomUUID();
      await db.collection('privacyRequests').doc(id).create({
        id,ownerUserId:uid,type,details,status:'received',createdAt:now,updatedAt:now,
        contactEmail:String(decoded.email||'').toLowerCase().slice(0,180),
        source:'profile_privacy_center'
      });
      return res.json({ok:true,request:{id,type,details,status:'received',createdAt:now,updatedAt:now,responseNote:''}});
    }

    return res.status(400).json({error:'Unknown operation'});
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[privacy-request]',error);
    return res.status(status).json({error:status===500?'Не удалось зарегистрировать запрос по персональным данным.':error.message});
  }
}
