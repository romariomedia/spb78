import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {requireAdminSession,writeAdminAudit} from '../server/admin-control.js';
import {
  LEGAL_COMPLIANCE_CHECKS,legalChecklistComplete,legalEnvironmentReadiness,sanitizeLegalCompliance
} from '../server/legal-compliance.js';

if(!getApps().length){
  initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const ref=db.collection('legalCompliance').doc('main');
    const operation=String(body.operation||'get');

    if(operation==='get'){
      const snap=await ref.get();
      const saved=sanitizeLegalCompliance(snap.exists?snap.data()||{}:{});
      return res.json({
        state:{
          ...saved,
          updatedAt:snap.exists?String(snap.data()?.updatedAt||''):'',
          updatedBy:snap.exists?String(snap.data()?.updatedBy||''):'',
          checklistComplete:legalChecklistComplete(saved)
        },
        environment:legalEnvironmentReadiness(),
        checkKeys:LEGAL_COMPLIANCE_CHECKS
      });
    }

    if(operation==='save'){
      const beforeSnap=await ref.get();
      const before=beforeSnap.exists?beforeSnap.data()||{}:{};
      const sanitized=sanitizeLegalCompliance(body.state||{},before);
      const now=new Date().toISOString();
      const after={
        ...sanitized,
        updatedAt:now,
        updatedBy:String(session.email||'admin')
      };
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref);
        const current=fresh.exists?fresh.data()||{}:{};
        tx.set(ref,after,{merge:false});
        await writeAdminAudit(db,session,{
          action:'legal.compliance.update',
          entityType:'legalCompliance',
          entityId:'main',
          before:current,
          after,
          requestId:String(body.requestId||'')
        },tx);
      });
      return res.json({
        ok:true,
        state:{...after,checklistComplete:legalChecklistComplete(after)},
        environment:legalEnvironmentReadiness(),
        checkKeys:LEGAL_COMPLIANCE_CHECKS
      });
    }

    return res.status(400).json({error:'Unknown operation'});
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-legal-compliance]',error);
    return res.status(status).json({error:status===500?'Не удалось загрузить юридический чек-лист.':error.message});
  }
}
