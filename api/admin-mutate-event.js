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

  if (operation === 'create') {
    if (!event || typeof event !== 'object') return res.status(400).json({ error: 'Event payload required.' });
    await ref.set({ ...event, id: eventId });
  } else if (operation === 'update') {
    if (!patch || typeof patch !== 'object') return res.status(400).json({ error: 'Patch required.' });
    await ref.update(patch);
  } else if (operation === 'delete') {
    await ref.delete();
  } else {
    return res.status(400).json({ error: 'Unknown operation.' });
  }

  return res.status(200).json({ ok: true });
}
