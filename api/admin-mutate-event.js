import { enqueueNotification } from '../server/notification-policy.js';
import { randomUUID } from 'node:crypto';
// api/admin-mutate-event.js
// Vercel Serverless Function: admin event create/update/delete with Admin SDK,
// gated by the OTP session issued by admin-verify-otp. Replaces the Cloud
// Function `adminMutateEvent`.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId, operation, eventId, event, patch } = req.body || {};
  if (!sessionId) return res.status(401).json({ error: 'Session required.' });

  const db = getFirestore();
  const session = await db.doc(`adminSessions/${sessionId}`).get();
  if (!session.exists) return res.status(401).json({ error: 'Session not found.' });
  const expiresAt = session.data()?.expiresAt?.toMillis?.() ?? 0;
  if (expiresAt <= Date.now()) return res.status(401).json({ error: 'Session expired.' });

  if (!eventId) return res.status(400).json({ error: 'Event id required.' });
  const ref = db.doc(`events/${eventId}`);

  if (!['create','update','delete'].includes(operation)) return res.status(400).json({error:'Unknown operation.'});
  if(operation==='create'&&(!event||typeof event!=='object'))return res.status(400).json({error:'Event payload required.'});
  if(operation==='update'&&(!patch||typeof patch!=='object'))return res.status(400).json({error:'Patch required.'});
  await db.runTransaction(async tx=>{
    const before=await tx.get(ref),old=before.data()||{};
    const next=operation==='create'?{...event,id:eventId}:operation==='update'?{...old,...patch}:null;
    if(operation==='create')tx.create(ref,next);
    else if(operation==='update')tx.update(ref,patch);
    else tx.delete(ref);
    const newlyPublished=next?.status==='published'&&old.status!=='published';
    const participants=Array.isArray(old.participantIds)?old.participantIds:[];
    if(newlyPublished || (old.status==='published'&&participants.length)) {
      enqueueNotification(tx,db,{id:`event:${eventId}:${randomUUID()}`,actorId:'',broadcast:newlyPublished,recipients:participants,category:'events',kind:newlyPublished?'event_new':'event_update',entityId:eventId,title:newlyPublished?'Новое событие SportBuddy':next?.status==='published'?'Событие обновлено':'Событие снято с публикации',message:String(next?.title||old.title||'Откройте раздел событий.'),link:next?.status==='published'?'#event='+encodeURIComponent(eventId):'#events'});
    }
  });

  return res.status(200).json({ ok: true });
}
