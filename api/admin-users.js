import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { requireAdminSession, writeAdminAudit } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

const ADMIN_EMAIL = 'support@sportbuddy78.ru';
const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const iso = value => value?.toDate ? value.toDate().toISOString() : String(value || '');
const list = (value, max = 12) => Array.isArray(value) ? value.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean).slice(0, max) : [];

function userRow(doc, privateData = {}, adminData = {}) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    name: text(data.name, 120) || 'Спортсмен',
    email: text(privateData.email || data.email, 180),
    districtId: text(data.districtId, 80),
    sports: list(data.sports, 8),
    avatar: text(data.avatar, 2000),
    isVerified: data.isVerified === true,
    verifiedAt: iso(data.verifiedAt),
    registeredAt: iso(data.registeredAt),
    lastSeenAt: Number(data.lastSeenAt || 0),
    premiumUntil: iso(data.premiumUntil),
    hasRealPhoto: data.hasRealPhoto === true,
    subscriptionPlan: data.subscriptionPlan === 'premium' ? 'premium' : 'free',
    isSuspended: data.isSuspended === true,
    analyticsExcluded: data.analyticsExcluded === true,
    suspensionReason: data.isSuspended === true ? text(adminData.suspensionReason, 300) : ''
  };
}

async function listUsers(db, query = '') {
  const snap = await db.collection('users').limit(250).get();
  const [privateSnaps, adminSnaps] = await Promise.all([
    Promise.all(snap.docs.map(doc => db.collection('usersPrivate').doc(doc.id).get().catch(() => null))),
    Promise.all(snap.docs.map(doc => db.collection('userAdmin').doc(doc.id).get().catch(() => null)))
  ]);
  const rows = snap.docs.map((doc,index) => userRow(
    doc,
    privateSnaps[index]?.exists ? privateSnaps[index].data() || {} : {},
    adminSnaps[index]?.exists ? adminSnaps[index].data() || {} : {}
  ));
  const needle = text(query, 120).toLowerCase();
  const filtered = needle ? rows.filter(row =>
    row.id.toLowerCase().includes(needle) ||
    row.name.toLowerCase().includes(needle) ||
    row.email.toLowerCase().includes(needle) ||
    row.districtId.toLowerCase().includes(needle) ||
    row.sports.some(sport => sport.toLowerCase().includes(needle))
  ) : rows;
  return filtered.sort((a,b) => String(b.registeredAt).localeCompare(String(a.registeredAt))).slice(0, 150);
}

async function readUserDetails(db, userId) {
  const [snap, privateSnap, adminSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('usersPrivate').doc(userId).get().catch(() => null),
    db.collection('userAdmin').doc(userId).get().catch(() => null)
  ]);
  if (!snap.exists) throw Object.assign(new Error('User not found.'), { status:404 });
  const data = snap.data() || {};
  const privateData = privateSnap?.exists ? privateSnap.data() || {} : {};
  const adminData = adminSnap?.exists ? adminSnap.data() || {} : {};
  return {
    ...userRow(snap, privateData, adminData),
    age: Number(data.age || 0),
    gender: data.gender === 'female' ? 'female' : 'male',
    bio: text(data.bio, 1000),
    locationName: text(data.locationName, 200),
    provider: text(data.provider, 30),
    totalWorkouts: Number(data.totalWorkouts || 0),
    totalDailyMedals: Number(data.totalDailyMedals || 0),
    dailyMedalStreak: Number(data.dailyMedalStreak || 0),
    rating: Number(data.rating || 0),
    ratingCount: Number(data.ratingCount || 0),
    friendsCount: list(data.friendIds, 500).length,
    matchesCount: list(data.matchIds, 500).length,
    photoPortfolioCount: list(data.photoPortfolio, 20).length,
    suspendedAt: iso(adminData.suspendedAt),
    suspendedBy: text(adminData.suspendedBy, 180)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  const db = getFirestore();
  const body = req.body || {};
  try {
    const session = await requireAdminSession(db, body.sessionId);
    const operation = String(body.operation || 'list');
    if (operation === 'list') return res.json({ users: await listUsers(db, body.query) });

    const userId = text(body.userId, 180);
    if (!userId || userId.includes('/')) return res.status(400).json({ error:'User id required.' });
    if (operation === 'get') return res.json({ user: await readUserDetails(db, userId) });

    const ref = db.collection('users').doc(userId);
    const privateRef = db.collection('usersPrivate').doc(userId);
    const adminRef = db.collection('userAdmin').doc(userId);
    const [beforeSnap, privateSnap, adminSnap] = await Promise.all([ref.get(), privateRef.get(), adminRef.get()]);
    if (!beforeSnap.exists) return res.status(404).json({ error:'User not found.' });
    const before = beforeSnap.data() || {};
    const privateData = privateSnap.exists ? privateSnap.data() || {} : {};
    const adminData = adminSnap.exists ? adminSnap.data() || {} : {};
    let patch = {};

    if (operation === 'setVerification') {
      const verified = body.verified === true;
      patch = verified
        ? { isVerified:true, verifiedAt:new Date().toISOString() }
        : { isVerified:false, verifiedAt:FieldValue.delete() };
      await ref.update(patch);
    } else if (operation === 'setPremiumUntil') {
      const raw = text(body.premiumUntil, 40);
      if (!raw) patch = { premiumUntil:FieldValue.delete() };
      else {
        const parsed = new Date(raw);
        if (!Number.isFinite(parsed.getTime())) return res.status(400).json({ error:'Invalid premium date.' });
        patch = { premiumUntil:Timestamp.fromDate(parsed) };
      }
      await ref.update(patch);
    } else if (operation === 'setAnalyticsExcluded') {
      patch = { analyticsExcluded: body.excluded === true };
      await ref.update(patch);
    } else if (operation === 'setSuspension') {
      if (text(privateData.email, 180).toLowerCase() === ADMIN_EMAIL) {
        return res.status(400).json({ error:'Нельзя ограничить основной аккаунт администратора.' });
      }
      const suspended = body.suspended === true;
      const reason = text(body.reason, 300);
      if (suspended && reason.length < 3) return res.status(400).json({ error:'Укажите причину ограничения.' });
      const previousActiveLooking = adminData.previousActiveLooking ?? (before.activeLooking !== false);
      const userPatch = suspended
        ? { isSuspended:true, activeLooking:false }
        : { isSuspended:false, activeLooking:previousActiveLooking === true };
      const adminPatch = suspended
        ? {
            suspensionReason:reason,
            suspendedAt:new Date().toISOString(),
            suspendedBy:String(session.email || ADMIN_EMAIL),
            previousActiveLooking
          }
        : {
            suspensionReason:'',
            suspendedAt:'',
            suspendedBy:'',
            previousActiveLooking:FieldValue.delete(),
            restoredAt:new Date().toISOString(),
            restoredBy:String(session.email || ADMIN_EMAIL)
          };

      await getAuth().updateUser(userId, { disabled:suspended });
      try {
        const batch = db.batch();
        batch.update(ref, userPatch);
        batch.set(adminRef, adminPatch, { merge:true });
        await batch.commit();
      } catch (error) {
        await getAuth().updateUser(userId, { disabled:!suspended }).catch(() => undefined);
        throw error;
      }
      patch = userPatch;
    } else {
      return res.status(400).json({ error:'Unknown operation.' });
    }

    const [afterSnap, afterAdminSnap] = await Promise.all([ref.get(), adminRef.get()]);
    const after = afterSnap.data() || {};
    const afterAdmin = afterAdminSnap.exists ? afterAdminSnap.data() || {} : {};
    await writeAdminAudit(db, session, {
      action:`user.${operation}`,
      entityType:'user',
      entityId:userId,
      before:{
        isVerified:before.isVerified === true,
        verifiedAt:iso(before.verifiedAt),
        premiumUntil:iso(before.premiumUntil),
        isSuspended:before.isSuspended === true,
        analyticsExcluded:before.analyticsExcluded === true,
        suspensionReason:text(adminData.suspensionReason, 300)
      },
      after:{
        isVerified:after.isVerified === true,
        verifiedAt:iso(after.verifiedAt),
        premiumUntil:iso(after.premiumUntil),
        isSuspended:after.isSuspended === true,
        analyticsExcluded:after.analyticsExcluded === true,
        suspensionReason:text(afterAdmin.suspensionReason, 300)
      },
      requestId:String(body.requestId || '')
    });
    return res.json({ ok:true, user:await readUserDetails(db, userId) });
  } catch (error) {
    const status = Number(error?.status || (error?.code === 'auth/user-not-found' ? 404 : 500));
    if (status === 500) console.error('[admin-users]', error);
    return res.status(status).json({ error:status === 500 ? 'User administration failed.' : error.message });
  }
}
