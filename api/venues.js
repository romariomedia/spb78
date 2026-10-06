import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  try{
    const db=getFirestore();
    const snap=await db.collection('venues').get();
    const venues=snap.docs.map(doc=>{
      const data=doc.data()||{};
      if(data.archived===true || data.isPublished===false){
        return {id:doc.id,isPublished:false,archived:data.archived===true};
      }
      return {id:doc.id,...data};
    });
    return res.status(200).json({venues});
  }catch(error){
    console.error('[venues]',error);
    return res.status(500).json({error:'Venue catalog unavailable.'});
  }
}
