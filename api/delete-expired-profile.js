// api/delete-expired-profile.js
// Vercel Serverless Function: removes an unverified account whose 24-hour
// verification window has passed. Replaces the Cloud Function
// `deleteMyExpiredUnverifiedAccount` (Blaze-free backend).
//
// Deletes the profile document, personally linked documents and the Firebase
// Auth user. Safe to call repeatedly.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'))
  });
}

const GRACE_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;
    const db = getFirestore();
    const ref = db.collection('users').doc(userId);
    const privateRef = db.collection('usersPrivate').doc(userId);
    const snap = await ref.get();

    if (!snap.exists) return res.status(200).json({ deleted: true });

    const profile = snap.data() || {};
    if (profile.isVerified === true) {
      return res.status(412).json({ deleted: false, reason: 'already-verified' });
    }

    const registeredAt = profile.registeredAt
      ? Date.parse(profile.registeredAt.toDate ? profile.registeredAt.toDate().toISOString() : String(profile.registeredAt))
      : NaN;
    const expired = Number.isFinite(registeredAt) && Date.now() - registeredAt >= GRACE_MS;

    if (!expired) {
      return res.status(412).json({ deleted: false, reason: 'window-not-expired' });
    }

    // Remove personally linked documents, then the profile and auth user.
    const writer = db.bulkWriter();
    const queries = await Promise.all([
      db.collection('goals').where('ownerId', '==', userId).get(),
      db.collection('checkins').where('userId', '==', userId).get(),
      db.collection('feed').where('authorId', '==', userId).get(),
      db.collection('chats').where('participantIds', 'array-contains', userId).get(),
      db.collection('trainings').where('createdBy', '==', userId).get(),
      db.collection('friendRequests').where('fromId', '==', userId).get(),
      db.collection('friendRequests').where('toId', '==', userId).get(),
      db.collection('friendships').where('participantIds', 'array-contains', userId).get()
    ]);
    queries.flatMap((q) => q.docs).forEach((doc) => writer.delete(doc.ref));
    writer.delete(ref);
    writer.delete(privateRef);
    await writer.close();

    await getAuth().deleteUser(userId).catch(() => {});

    return res.status(200).json({ deleted: true });
  } catch (error) {
    console.error('Ошибка удаления просроченного профиля:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
