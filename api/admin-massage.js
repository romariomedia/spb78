import {adminCreateReceipt} from '../server/admin-create-receipt.js';
import {readAdminPage} from '../server/admin-page.js';
import {randomUUID} from 'node:crypto';
import {getApps,initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {requireAdminSession,writeAdminAudit} from '../server/admin-control.js';
import {sanitizeMassage} from '../server/massage.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
  const db=getFirestore(),body=req.body||{},session=await requireAdminSession(db,body.sessionId);
  const collection=db.collection('massageServices'),operation=body.operation;
  if(operation==='list'){const page=await readAdminPage(collection,body.cursor);return res.json({items:page.items,nextCursor:page.nextCursor});}
  if(!['create','update','delete'].includes(operation))return res.status(400).json({error:'Неизвестная операция'});
  const id=operation==='create'?randomUUID():String(body.id||'');
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return res.status(400).json({error:'Некорректный ID'});
  const ref=collection.doc(id);
  const result=await db.runTransaction(async transaction=>{
   const receipt=operation==='create'?await adminCreateReceipt(transaction,db,session,'massage',body.requestId,body.item):null;
   if(receipt?.result)return receipt.result;
   const snap=await transaction.get(ref);
   if(operation!=='create'&&!snap.exists)throw Object.assign(new Error('Объявление не найдено'),{status:404});
   const before=snap.exists?snap.data():null;
   const after=operation==='delete'?null:{...sanitizeMassage(body.item,before||{}),updatedAtMs:Date.now()};
   if(operation==='delete')transaction.delete(ref);else if(operation==='create')transaction.create(ref,after);else transaction.set(ref,after);
   await writeAdminAudit(db,session,{action:`massage.${operation}`,entityType:'massageService',entityId:id,before,after,requestId:String(body.requestId||'')},transaction);
   const result={ok:true,id};receipt?.save(result);return result;
  });
  return res.json(result);
 }catch(error){const status=error.status||500;if(status===500)console.error('[admin-massage]',error);return res.status(status).json({error:status===500?'Не удалось сохранить объявление':error.message});}
}
