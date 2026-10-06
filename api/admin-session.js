import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession, writeAdminAudit } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { sessionId, action } = req.body || {};
  const db = getFirestore();
  try {
    if (action !== 'revoke') return res.status(400).json({ error: 'Unknown operation.' });
    const session = await requireAdminSession(db, sessionId);
    await writeAdminAudit(db, session, {
      action: 'session.revoke',
      entityType: 'adminSession',
      entityId: String(sessionId || '')
    });
    await session.ref.delete();
    return res.status(200).json({ ok: true });
  } catch (error) {
    const status = Number(error?.status || 500);
    return res.status(status).json({ error: status === 500 ? 'Admin session operation failed.' : error.message });
  }
}
