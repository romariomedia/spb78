import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

if(!getApps().length){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(raw?{credential:cert(JSON.parse(raw))}:undefined);
}

export const USER_LEGAL_VERSION='2026-10-26';
const ALLOWED=Object.freeze(['terms','personal_data']);

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется авторизация'});
    const decoded=await getAuth().verifyIdToken(token,true);
    const uid=decoded.uid;
    const acceptances=Array.isArray(req.body?.acceptances)?req.body.acceptances:[];
    const kinds=[...new Set(acceptances.map(String).filter(value=>ALLOWED.includes(value)))];
    if(kinds.length===0)return res.status(400).json({error:'Не указано согласие'});
    if(String(req.body?.version||'')!==USER_LEGAL_VERSION)
      return res.status(409).json({error:'Документы обновились. Ознакомьтесь с актуальной редакцией.'});

    const db=getFirestore(),now=new Date().toISOString();
    await db.runTransaction(async tx=>{
      for(const kind of kinds){
        const id=`${uid}:${kind}:${USER_LEGAL_VERSION}`;
        const ref=db.collection('legalAcceptances').doc(id);
        const snap=await tx.get(ref);
        if(!snap.exists)tx.create(ref,{
          ownerUserId:uid,kind,version:USER_LEGAL_VERSION,
          acceptedAt:now,source:String(req.body?.source||'registration').slice(0,40),
          authProvider:String(req.body?.authProvider||'').slice(0,40),
          email:String(decoded.email||'').toLowerCase().slice(0,180)
        });
      }
    });
    return res.json({ok:true,version:USER_LEGAL_VERSION,accepted:kinds});
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[legal-acceptance]',error);
    return res.status(status).json({error:status===500?'Не удалось зафиксировать согласие.':error.message});
  }
}
