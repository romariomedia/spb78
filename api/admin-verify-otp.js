// api/admin-verify-otp.js
// Vercel Serverless Function: verifies the one-time admin code and issues a
// short-lived session id. Replaces the Cloud Function `verifyAdminOtp`.

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

const ADMIN_EMAIL = 'support@sportbuddy78.ru';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function adminKey(email, pepper) {
  return createHash('sha256').update(`${email}:${pepper}`).digest('hex').slice(0, 32);
}

function safeEqual(a, b) {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, code } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail !== ADMIN_EMAIL || String(process.env.ADMIN_ACCESS_PASSWORD || '') === '') {
    return res.status(403).json({ error: 'Invalid admin credentials.' });
  }
  if (!/^\d{4}$/.test(String(code || ''))) {
    return res.status(400).json({ error: 'Four digit code required.' });
  }

  const pepper = process.env.ADMIN_OTP_PEPPER || 'dev-pepper';
  const key = adminKey(cleanEmail, pepper);
  const db = getFirestore();
  const challengeRef = db.doc(`adminOtpChallenges/${key}`);
  const now = Date.now();

  const challenge = await challengeRef.get();
  if (!challenge.exists) return res.status(404).json({ error: 'Challenge not found.' });

  const data = challenge.data();
  const expiresAt = data?.expiresAt?.toMillis?.() ?? 0;
  const attempts = Number(data?.attempts || 0);

  if (expiresAt <= now) {
    await challengeRef.delete();
    return res.status(410).json({ error: 'Challenge expired.' });
  }
  if (attempts >= MAX_ATTEMPTS) {
    await challengeRef.delete();
    return res.status(429).json({ error: 'Too many attempts.' });
  }

  const expected = createHash('sha256').update(`${key}:${code}:${pepper}`).digest('hex');
  if (!safeEqual(String(data.codeHash || ''), expected)) {
    await challengeRef.update({ attempts: attempts + 1 });
    return res.status(403).json({ error: 'Invalid code.' });
  }

  await challengeRef.delete();
  const sessionId = randomUUID();
  const sessionExpires = new Date(now + SESSION_TTL_MS);

  await db.doc(`adminSessions/${sessionId}`).set({
    adminKey: key,
    email: ADMIN_EMAIL,
    issuedAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromDate(sessionExpires)
  });

  return res.status(200).json({ sessionId, expiresAt: sessionExpires.toISOString() });
}
