import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

async function count(db, name) {
  try {
    const snap = await db.collection(name).count().get();
    return Number(snap.data().count || 0);
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const db = getFirestore();
  try {
    await requireAdminSession(db, req.body?.sessionId);
    const [
      users, trainings, events, venues, leisureEvents, reports, notificationOutbox
    ] = await Promise.all([
      count(db, 'users'),
      count(db, 'trainings'),
      count(db, 'events'),
      count(db, 'venues'),
      count(db, 'leisureEvents'),
      count(db, 'reports'),
      count(db, 'notificationOutbox')
    ]);

    const recentUsersSnap = await db.collection('users').orderBy('registeredAt', 'desc').limit(5).get().catch(() => null);
    const recentUsers = recentUsersSnap ? recentUsersSnap.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        name: String(data.name || 'Спортсмен').slice(0, 120),
        isVerified: data.isVerified === true,
        registeredAt: data.registeredAt?.toDate?.()?.toISOString?.() || String(data.registeredAt || '')
      };
    }) : [];

    return res.status(200).json({
      counts: { users, trainings, events, venues, leisureEvents, reports, notificationOutbox },
      recentUsers,
      release: process.env.SB_RELEASE_ID || 'development',
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const status = Number(error?.status || 500);
    return res.status(status).json({ error: status === 500 ? 'Dashboard unavailable.' : error.message });
  }
}
