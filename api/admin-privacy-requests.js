import {privacyRequestPage} from '../server/privacy-request-page.js';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {requireAdminSession,writeAdminAudit} from '../server/admin-control.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

const STATUSES=new Set(['received','in_review','waiting_user','completed','rejected']);
const clean=(v,max=1600)=>typeof v==='string'?v.trim().slice(0,max):'';

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const operation=String(body.operation||'list');
    if(operation==='list'){
      const page=await privacyRequestPage(db,{cursor:body.cursor});
      const requests=page.docs.map(doc=>({id:doc.id,...doc.data()}))
        .map(row=>({
          id:String(row.id),ownerUserId:String(row.ownerUserId||''),contactEmail:String(row.contactEmail||''),
          type:String(row.type||''),details:String(row.details||''),status:String(row.status||'received'),
          createdAt:String(row.createdAt||''),updatedAt:String(row.updatedAt||''),responseNote:String(row.responseNote||''),
          reviewedBy:String(row.reviewedBy||'')
        }));
      return res.json({requests,nextCursor:page.nextCursor});
    }
    if(operation==='update'){
      const id=clean(body.id,120),status=String(body.status||''),responseNote=clean(body.responseNote,1600);
      if(!id||id.includes('/'))return res.status(400).json({error:'Некорректный запрос'});
      if(!STATUSES.has(status))return res.status(400).json({error:'Некорректный статус'});
      const ref=db.collection('privacyRequests').doc(id),now=new Date().toISOString();
      let after;
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists)throw Object.assign(new Error('Запрос не найден.'),{status:404});
        const before=snap.data()||{};
        after={...before,status,responseNote,updatedAt:now,reviewedBy:String(session.email||'admin')};
        tx.set(ref,after,{merge:false});
        await writeAdminAudit(db,session,{
          action:'privacy.request.update',entityType:'privacyRequest',entityId:id,before,after,
          requestId:String(body.requestId||'')
        },tx);
      });
      return res.json({ok:true,request:{
        id,ownerUserId:String(after.ownerUserId||''),contactEmail:String(after.contactEmail||''),
        type:String(after.type||''),details:String(after.details||''),status:String(after.status||''),
        createdAt:String(after.createdAt||''),updatedAt:String(after.updatedAt||''),responseNote:String(after.responseNote||''),reviewedBy:String(after.reviewedBy||'')
      }});
    }
    return res.status(400).json({error:'Unknown operation'});
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-privacy-requests]',error);
    return res.status(status).json({error:status===500?'Не удалось обработать запросы субъектов ПД.':error.message});
  }
}
