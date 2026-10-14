import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore();
  try{
    await requireAdminSession(db,req.body?.sessionId);
    const limit=Math.min(100,Math.max(10,Number(req.body?.limit)||50));
    let query=db.collection('adminAuditLogs').orderBy('createdAtMs','desc').limit(limit);
    if(req.body?.cursor){
      const id=String(req.body.cursor);
      if(id.includes('/')||id.length>180)return res.status(400).json({error:'Invalid cursor'});
      const cursor=await db.collection('adminAuditLogs').doc(id).get();
      if(!cursor.exists)return res.status(409).json({error:'Обновите журнал: курсор больше недоступен.'});
      query=query.startAfter(cursor);
    }
    const snap=await query.get();
    return res.json({nextCursor:snap.docs.length===limit?snap.docs.at(-1).id:null,entries:snap.docs.map(doc=>{
      const data=doc.data()||{};
      return {
        id:doc.id,
        adminEmail:String(data.adminEmail||''),
        action:String(data.action||''),
        entityType:String(data.entityType||''),
        entityId:String(data.entityId||''),
        before:data.before??null,
        after:data.after??null,
        requestId:String(data.requestId||''),
        createdAt:String(data.createdAt||'')
      };
    })});
  }catch(error){
    const status=Number(error?.status||500);
    return res.status(status).json({error:status===500?'Audit log unavailable.':error.message});
  }
}
