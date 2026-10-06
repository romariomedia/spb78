// api/admin-request-otp.js
// Vercel Serverless Function: validates admin credentials and e-mails a
// one-time 4-digit code. Replaces the Cloud Function `requestAdminOtp`.

import { createHash, randomInt } from 'node:crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { requireProductionAdminSecrets } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

const ADMIN_EMAIL = 'support@sportbuddy78.ru';
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const FAILED_WINDOW_MS = 15 * 60 * 1000;
const FAILED_LIMIT = 5;

function adminKey(email, pepper) {
  return createHash('sha256').update(`${email}:${pepper}`).digest('hex').slice(0, 32);
}
function rateKey(req, pepper) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const remote = forwarded || String(req.socket?.remoteAddress || 'unknown');
  return createHash('sha256').update(`${remote}:${pepper}`).digest('hex').slice(0, 32);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try { requireProductionAdminSecrets(); } catch (error) { return res.status(error.status || 503).json({ error: error.message }); }

  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const pepper = process.env.ADMIN_OTP_PEPPER;
  const db = getFirestore();
  const now = Date.now();
  const limiterRef = db.doc(`adminOtpRateLimits/${rateKey(req, pepper)}`);
  const limiterSnap = await limiterRef.get();
  const limiter = limiterSnap.exists ? limiterSnap.data() || {} : {};
  const windowStartedAt = limiter.windowStartedAt?.toMillis?.() ?? 0;
  const attempts = now - windowStartedAt < FAILED_WINDOW_MS ? Number(limiter.attempts || 0) : 0;
  const lockedUntil = limiter.lockedUntil?.toMillis?.() ?? 0;
  if (lockedUntil > now) return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });

  if (cleanEmail !== ADMIN_EMAIL || password !== process.env.ADMIN_ACCESS_PASSWORD) {
    const nextAttempts = attempts + 1;
    await limiterRef.set({
      attempts: nextAttempts,
      windowStartedAt: Timestamp.fromMillis(attempts ? windowStartedAt : now),
      lockedUntil: nextAttempts >= FAILED_LIMIT ? Timestamp.fromMillis(now + FAILED_WINDOW_MS) : Timestamp.fromMillis(0),
      updatedAt: Timestamp.fromMillis(now)
    }, { merge: true });
    return res.status(403).json({ error: 'Invalid admin credentials.' });
  }

  if (limiterSnap.exists) await limiterRef.delete().catch(() => undefined);
  const key = adminKey(cleanEmail, pepper);
  const ref = db.doc(`adminOtpChallenges/${key}`);

  const existing = await ref.get();
  if (existing.exists) {
    const sentAt = existing.data()?.sentAt?.toMillis?.() ?? 0;
    if (now - sentAt < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Wait before requesting a new code.' });
    }
  }

  const code = String(randomInt(0, 10_000)).padStart(4, '0');
  const expiresAt = new Date(now + OTP_TTL_MS);
  const codeHash = createHash('sha256').update(`${key}:${code}:${pepper}`).digest('hex');

  await ref.set({
    codeHash,
    attempts: 0,
    sentAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromDate(expiresAt)
  });

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || ADMIN_EMAIL,
      to: ADMIN_EMAIL,
      subject: `SportBuddy78 — код входа в админку: ${code}`,
      text: `Ваш одноразовый код администратора SportBuddy78: ${code}\n\nКод действует 10 минут. Никому не сообщайте его.`
    });
  } catch (error) {
    await ref.delete();
    console.error('Admin OTP mail failed', error);
    return res.status(503).json({ error: 'Mail delivery failed.' });
  }

  return res.status(200).json({ expiresAt: expiresAt.toISOString(), retryAfterSeconds: 60 });
}
