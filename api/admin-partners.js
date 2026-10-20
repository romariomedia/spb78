import {adminCreateReceipt} from '../server/admin-create-receipt.js';
import {readAdminPage} from '../server/admin-page.js';
import { randomUUID } from 'node:crypto';
import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession,writeAdminAudit } from '../server/admin-control.js';
import { sanitizePartner } from '../server/partners.js';

if(!getApps().length){
  initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
}

const view=doc=>({id:doc.id,...doc.data()});

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const op=String(body.operation||'list');
    const configRef=db.collection('partnerConfig').doc('main');

    if(op==='list'){
      const [configSnap,itemsSnap]=await Promise.all([
        configRef.get(),
        readAdminPage(db.collection('partners'),body.cursor)
      ]);
      return res.json({
        visible:configSnap.exists?configSnap.data()?.visible===true:false,
        partners:itemsSnap.items,nextCursor:itemsSnap.nextCursor
      });
    }

    const result = await db.runTransaction(async tx => {
    if(op==='setVisibility'){
      const beforeSnap=await tx.get(configRef);
      const before=beforeSnap.exists?beforeSnap.data()||{}:{};
      const after={visible:body.visible===true,updatedAt:new Date().toISOString(),updatedBy:String(session.email||'admin')};
      tx.set(configRef,after,{merge:false});
      await writeAdminAudit(db,session,{action:'partners.visibility.update',entityType:'partnerConfig',entityId:'main',before,after,requestId:String(body.requestId||'')},tx);
      return ({visible:after.visible});
    }

    if(op==='create'){
      const receipt=await adminCreateReceipt(tx,db,session,'partner',body.requestId,body.partner);
      if(receipt.result)return receipt.result;
      const id=randomUUID(),ref=db.collection('partners').doc(id);
      const value=sanitizePartner(body.partner||{});
      const now=new Date().toISOString();
      const doc={...value,id,createdAt:now,updatedAt:now,updatedAtMs:Date.now(),createdBy:String(session.email||'admin'),updatedBy:String(session.email||'admin')};
      tx.create(ref,doc);
      await writeAdminAudit(db,session,{action:'partner.create',entityType:'partner',entityId:id,after:doc,requestId:String(body.requestId||'')},tx);
      receipt.save({partner:doc});
      return ({partner:doc});
    }

    const id=String(body.id||'').trim();
    if(!id||id.includes('/'))throw Object.assign(new Error('Partner id required.'),{status:400});
    const ref=db.collection('partners').doc(id),snap=await tx.get(ref);
    if(!snap.exists)throw Object.assign(new Error('Партнёр не найден.'),{status:404});
    const before=snap.data()||{};

    if(op==='update'){
      const next=sanitizePartner(body.partner||{},before);
      const doc={...before,...next,updatedAt:new Date().toISOString(),updatedAtMs:Date.now(),updatedBy:String(session.email||'admin')};
      tx.set(ref,doc,{merge:false});
      await writeAdminAudit(db,session,{action:'partner.update',entityType:'partner',entityId:id,before,after:doc,requestId:String(body.requestId||'')},tx);
      return ({partner:doc});
    }

    if(op==='delete'){
      tx.delete(ref);
      await writeAdminAudit(db,session,{action:'partner.delete',entityType:'partner',entityId:id,before,after:null,requestId:String(body.requestId||'')},tx);
      return ({ok:true});
    }

    throw Object.assign(new Error('Unknown operation.'),{status:400});
    });
    return res.json(result);
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-partners]',error);
    return res.status(status).json({error:status===500?'Partner administration failed.':error.message});
  }
}
