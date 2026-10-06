import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { hasVerificationPhotos, verificationExpired, photoVerificationPatch } from '../server/profile-verification.js';
import { requireActiveUser } from '../server/user-status.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}
const iso = value => value?.toDate ? value.toDate().toISOString() : String(value || '');
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const decoded = await getAuth().verifyIdToken(token);
    const db = getFirestore();
    await requireActiveUser(db,decoded.uid);
    const ref = db.collection('users').doc(decoded.uid);
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Object.assign(new Error('Профиль не найден'), { status: 404 });
      const user = snap.data();
      if (user.isVerified === true) return { ok: true, isVerified: true, verifiedAt: user.verifiedAt || null, premiumGranted: false, premiumUntil: iso(user.premiumUntil) };
      if (!hasVerificationPhotos(user)) throw Object.assign(new Error('Для верификации нужны личная фотография и минимум одно фото в портфолио.'), { status: 412 });
      const checkedAt = Date.now();
      if (verificationExpired(user, checkedAt)) throw Object.assign(new Error('Срок верификации 24 часа истёк. Обратитесь в поддержку.'), { status: 410 });
      const update = photoVerificationPatch(user, checkedAt);
      if (update.premiumUntil) update.premiumUntil = Timestamp.fromDate(new Date(update.premiumUntil));
      tx.update(ref, update);
      return { ok: true, isVerified: true, verifiedAt: update.verifiedAt,
        premiumGranted: Boolean(update.welcomeTrialGrantedAt), premiumUntil: iso(update.premiumUntil || user.premiumUntil) };
    });
    return res.status(200).json(result);
  } catch (error) {
    const status = error.code?.startsWith?.('auth/') ? 401 : error.status || 500;
    return res.status(status).json({ error: status === 500 ? 'Не удалось подтвердить профиль' : status === 401 ? 'Требуется повторный вход' : error.message });
  }
}
