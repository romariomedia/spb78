import {adminCreateReceipt} from '../server/admin-create-receipt.js';
import {readAdminPage} from '../server/admin-page.js';
import { randomUUID } from 'node:crypto';
import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession,writeAdminAudit } from '../server/admin-control.js';
import { sanitizeAnnouncement } from '../server/announcements.js';

if(!getApps().length){
  initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
}

const view=(doc)=>({id:doc.id,...doc.data()});

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const op=String(body.operation||'list');

    if(op==='list'){
      const page=await readAdminPage(db.collection('announcements'),body.cursor);
      return res.json({announcements:page.items,nextCursor:page.nextCursor});
    }

    const result = await db.runTransaction(async tx => {
    if(op==='create'){
      const receipt=await adminCreateReceipt(tx,db,session,'announcement',body.requestId,body.announcement);
      if(receipt.result)return receipt.result;
      const id=randomUUID(),ref=db.collection('announcements').doc(id);
      const value=sanitizeAnnouncement(body.announcement||{});
      const now=new Date().toISOString();
      const doc={...value,id,createdAt:now,updatedAt:now,updatedAtMs:Date.now(),createdBy:String(session.email||'admin'),updatedBy:String(session.email||'admin')};
      tx.create(ref,doc);
      await writeAdminAudit(db,session,{action:'announcement.create',entityType:'announcement',entityId:id,after:doc,requestId:String(body.requestId||'')},tx);
      receipt.save({announcement:doc});
      return ({announcement:doc});
    }

    const id=String(body.id||'').trim();
    if(!id||id.includes('/'))throw Object.assign(new Error('Announcement id required.'),{status:400});
    const ref=db.collection('announcements').doc(id);
    const snap=await tx.get(ref);
    if(!snap.exists)throw Object.assign(new Error('Объявление не найдено.'),{status:404});
    const before=snap.data()||{};

    if(op==='update'){
      const next=sanitizeAnnouncement(body.announcement||{},before);
      const doc={...before,...next,updatedAt:new Date().toISOString(),updatedAtMs:Date.now(),updatedBy:String(session.email||'admin')};
      tx.set(ref,doc,{merge:false});
      await writeAdminAudit(db,session,{action:'announcement.update',entityType:'announcement',entityId:id,before,after:doc,requestId:String(body.requestId||'')},tx);
      return ({announcement:doc});
    }

    if(op==='delete'){
      tx.delete(ref);
      await writeAdminAudit(db,session,{action:'announcement.delete',entityType:'announcement',entityId:id,before,after:null,requestId:String(body.requestId||'')},tx);
      return ({ok:true});
    }

    throw Object.assign(new Error('Unknown operation.'),{status:400});
    });
    return res.json(result);
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-announcements]',error);
    return res.status(status).json({error:status===500?'Announcements administration failed.':error.message});
  }
}
