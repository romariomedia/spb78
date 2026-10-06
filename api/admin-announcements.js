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
      const snap=await db.collection('announcements').orderBy('updatedAtMs','desc').limit(100).get();
      return res.json({announcements:snap.docs.map(view)});
    }

    if(op==='create'){
      const id=randomUUID(),ref=db.collection('announcements').doc(id);
      const value=sanitizeAnnouncement(body.announcement||{});
      const now=new Date().toISOString();
      const doc={...value,id,createdAt:now,updatedAt:now,updatedAtMs:Date.now(),createdBy:String(session.email||'admin'),updatedBy:String(session.email||'admin')};
      await ref.create(doc);
      await writeAdminAudit(db,session,{action:'announcement.create',entityType:'announcement',entityId:id,after:doc,requestId:String(body.requestId||'')});
      return res.json({announcement:doc});
    }

    const id=String(body.id||'').trim();
    if(!id||id.includes('/'))return res.status(400).json({error:'Announcement id required.'});
    const ref=db.collection('announcements').doc(id);
    const snap=await ref.get();
    if(!snap.exists)return res.status(404).json({error:'Объявление не найдено.'});
    const before=snap.data()||{};

    if(op==='update'){
      const next=sanitizeAnnouncement(body.announcement||{},before);
      const doc={...before,...next,updatedAt:new Date().toISOString(),updatedAtMs:Date.now(),updatedBy:String(session.email||'admin')};
      await ref.set(doc,{merge:false});
      await writeAdminAudit(db,session,{action:'announcement.update',entityType:'announcement',entityId:id,before,after:doc,requestId:String(body.requestId||'')});
      return res.json({announcement:doc});
    }

    if(op==='delete'){
      await ref.delete();
      await writeAdminAudit(db,session,{action:'announcement.delete',entityType:'announcement',entityId:id,before,after:null,requestId:String(body.requestId||'')});
      return res.json({ok:true});
    }

    return res.status(400).json({error:'Unknown operation.'});
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-announcements]',error);
    return res.status(status).json({error:status===500?'Announcements administration failed.':error.message});
  }
}
