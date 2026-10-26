import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {requireActiveUser} from '../server/user-status.js';
import {publicBusinessLegalProfile,sanitizeBusinessLegalProfile} from '../server/business-legal.js';

if(!getApps().length){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(raw?{credential:cert(JSON.parse(raw))}:undefined);
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется авторизация'});
    const decoded=await getAuth().verifyIdToken(token,true);
    const uid=decoded.uid;
    const db=getFirestore();
    const {profile:user}=await requireActiveUser(db,uid);
    const ref=db.collection('businessLegalProfiles').doc(uid);
    const operation=String(req.body?.operation||'get');

    if(operation==='get'){
      const snap=await ref.get();
      const value=snap.exists?snap.data()||{}:{
        entityType:'',
        legalName:String(user?.name||decoded.name||'').trim(),
        inn:'',
        ogrn:'',
        address:'',
        email:String(decoded.email||user?.email||'').trim(),
        phone:'',
        representative:'',
        basis:''
      };
      return res.json({profile:publicBusinessLegalProfile(value)});
    }

    if(operation==='save'){
      const value=sanitizeBusinessLegalProfile(req.body?.profile||{});
      const now=new Date().toISOString();
      await ref.set({
        ...value,
        ownerUserId:uid,
        updatedAt:now,
        createdAt:(await ref.get()).data()?.createdAt||now
      },{merge:false});
      return res.json({ok:true,profile:publicBusinessLegalProfile(value)});
    }

    return res.status(400).json({error:'Unknown operation'});
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[business-legal-profile]',error);
    return res.status(status).json({error:status===500?'Не удалось сохранить реквизиты.':error.message});
  }
}
