import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { requireAdminSession, writeAdminAudit } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const iso = value => value?.toDate ? value.toDate().toISOString() : String(value || '');

async function listUsers(db, query = '') {
  const snap = await db.collection('users').limit(250).get();
  const privateSnaps = await Promise.all(snap.docs.map(doc => db.collection('usersPrivate').doc(doc.id).get().catch(() => null)));
  const rows = snap.docs.map((doc,index) => {
    const data = doc.data() || {};
    const privateSnap = privateSnaps[index];
    const privateData = privateSnap?.exists ? (privateSnap.data() || {}) : {};
    return {
      id: doc.id,
      name: text(data.name, 120) || 'Спортсмен',
      email: text(privateData.email || data.email, 180),
      districtId: text(data.districtId, 80),
      sports: Array.isArray(data.sports) ? data.sports.map(v => text(v, 60)).filter(Boolean).slice(0, 8) : [],
      isVerified: data.isVerified === true,
      verifiedAt: iso(data.verifiedAt),
      registeredAt: iso(data.registeredAt),
      lastSeenAt: Number(data.lastSeenAt || 0),
      premiumUntil: iso(data.premiumUntil),
      hasRealPhoto: data.hasRealPhoto === true,
      subscriptionPlan: data.subscriptionPlan === 'premium' ? 'premium' : 'free'
    };
  });
  const needle = text(query, 120).toLowerCase();
  const filtered = needle ? rows.filter(row =>
    row.id.toLowerCase().includes(needle) ||
    row.name.toLowerCase().includes(needle) ||
    row.email.toLowerCase().includes(needle) ||
    row.districtId.toLowerCase().includes(needle)
  ) : rows;
  return filtered.sort((a,b) => String(b.registeredAt).localeCompare(String(a.registeredAt))).slice(0, 150);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  const db = getFirestore();
  const body = req.body || {};
  try {
    const session = await requireAdminSession(db, body.sessionId);
    const operation = String(body.operation || 'list');
    if (operation === 'list') {
      return res.json({ users: await listUsers(db, body.query) });
    }

    const userId = text(body.userId, 180);
    if (!userId || userId.includes('/')) return res.status(400).json({ error:'User id required.' });
    const ref = db.collection('users').doc(userId);
    const beforeSnap = await ref.get();
    if (!beforeSnap.exists) return res.status(404).json({ error:'User not found.' });
    const before = beforeSnap.data() || {};
    let patch = {};

    if (operation === 'setVerification') {
      const verified = body.verified === true;
      patch = verified
        ? { isVerified:true, verifiedAt:new Date().toISOString() }
        : { isVerified:false, verifiedAt:FieldValue.delete() };
    } else if (operation === 'setPremiumUntil') {
      const raw = text(body.premiumUntil, 40);
      if (!raw) {
        patch = { premiumUntil:FieldValue.delete() };
      } else {
        const parsed = new Date(raw);
        if (!Number.isFinite(parsed.getTime())) return res.status(400).json({ error:'Invalid premium date.' });
        patch = { premiumUntil:Timestamp.fromDate(parsed) };
      }
    } else {
      return res.status(400).json({ error:'Unknown operation.' });
    }

    await ref.update(patch);
    const afterSnap = await ref.get();
    const after = afterSnap.data() || {};
    await writeAdminAudit(db, session, {
      action:`user.${operation}`,
      entityType:'user',
      entityId:userId,
      before:{
        isVerified:before.isVerified === true,
        verifiedAt:iso(before.verifiedAt),
        premiumUntil:iso(before.premiumUntil)
      },
      after:{
        isVerified:after.isVerified === true,
        verifiedAt:iso(after.verifiedAt),
        premiumUntil:iso(after.premiumUntil)
      },
      requestId:String(body.requestId || '')
    });
    return res.json({ ok:true });
  } catch (error) {
    const status = Number(error?.status || 500);
    if (status === 500) console.error('[admin-users]', error);
    return res.status(status).json({ error:status === 500 ? 'User administration failed.' : error.message });
  }
}
