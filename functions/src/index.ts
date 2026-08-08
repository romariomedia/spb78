/**
 * SportBuddy78 — Firebase Cloud Functions (Admin OTP)
 *
 * Deploy after configuring secrets:
 * firebase functions:secrets:set ADMIN_OTP_PEPPER
 * firebase functions:secrets:set SMTP_HOST
 * firebase functions:secrets:set SMTP_PORT
 * firebase functions:secrets:set SMTP_USER
 * firebase functions:secrets:set SMTP_PASS
 * firebase functions:secrets:set SMTP_FROM
 * firebase deploy --only functions
 */

import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';

admin.initializeApp();

const ADMIN_EMAIL = 'support@sportbuddy78.ru';
const REGION = 'europe-west1';
const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const VERIFICATION_GRACE_MS = 24 * 60 * 60 * 1000;
const YOOKASSA_API = 'https://api.yookassa.ru/v3';
const APP_BASE_URL = 'https://sportbuddy78.pro';

const yooKassaShopId = defineSecret('YOOKASSA_SHOP_ID');
const yooKassaSecretKey = defineSecret('YOOKASSA_SECRET_KEY');

const otpPepper = defineSecret('ADMIN_OTP_PEPPER');
const smtpHost = defineSecret('SMTP_HOST');
const smtpPort = defineSecret('SMTP_PORT');
const smtpUser = defineSecret('SMTP_USER');
const smtpPass = defineSecret('SMTP_PASS');
const smtpFrom = defineSecret('SMTP_FROM');

// VK ID → Firebase custom token exchange (transport identity for Firestore rules)
const vkAppId = defineSecret('VK_APP_ID');
const vkAppSecret = defineSecret('VK_APP_SECRET');

// Admin console access without Firebase Auth
const adminPassword = defineSecret('ADMIN_ACCESS_PASSWORD');

function requireAdminEmail(request: any): string {
  const email = String(request.auth?.token?.email || '').toLowerCase();
  if (!request.auth || email !== ADMIN_EMAIL) {
    throw new HttpsError('permission-denied', 'Admin access is restricted.');
  }
  return request.auth.uid;
}

function hashOtp(uid: string, code: string): string {
  return createHash('sha256')
    .update(`${uid}:${code}:${otpPepper.value()}`)
    .digest('hex');
}

function safeHashEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function mailer() {
  return nodemailer.createTransport({
    host: smtpHost.value(),
    port: Number(smtpPort.value()),
    secure: Number(smtpPort.value()) === 465,
    auth: { user: smtpUser.value(), pass: smtpPass.value() }
  });
}

type PremiumPlan = 'monthly' | 'yearly';
const PREMIUM_PLANS: Record<PremiumPlan, { amount: string; days: number; label: string }> = {
  monthly: { amount: '490.00', days: 30, label: 'Premium на 1 месяц' },
  yearly: { amount: '4900.00', days: 365, label: 'Premium на 1 год' }
};

function yooKassaAuthHeader(): string {
  return `Basic ${Buffer.from(`${yooKassaShopId.value()}:${yooKassaSecretKey.value()}`).toString('base64')}`;
}

async function yooKassaFetch(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${YOOKASSA_API}${path}`, {
    ...options,
    headers: {
      Authorization: yooKassaAuthHeader(),
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error('YooKassa API error', { status: response.status, body });
    throw new HttpsError('unavailable', 'Payment provider rejected the request.');
  }
  return body;
}

/**
 * Creates a YooKassa redirect payment. Amount and duration are selected on the
 * server, never taken from the client. `request.auth.uid` is the only user id
 * accepted into payment metadata.
 */
export const createYooKassaPayment = onCall<{ plan?: PremiumPlan }>(
  {
    region: REGION,
    secrets: [yooKassaShopId, yooKassaSecretKey]
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const plan = request.data?.plan;
    if (plan !== 'monthly' && plan !== 'yearly') {
      throw new HttpsError('invalid-argument', 'Invalid subscription plan.');
    }

    const uid = request.auth.uid;
    const profile = await admin.firestore().doc(`users/${uid}`).get();
    if (!profile.exists) throw new HttpsError('failed-precondition', 'Profile not found.');

    const config = PREMIUM_PLANS[plan];
    const idempotenceKey = randomUUID();
    const payment = await yooKassaFetch('/payments', {
      method: 'POST',
      headers: { 'Idempotence-Key': idempotenceKey },
      body: JSON.stringify({
        amount: { value: config.amount, currency: 'RUB' },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: `${APP_BASE_URL}/success`
        },
        description: `${config.label} SportBuddy78`,
        metadata: {
          userId: uid,
          plan,
          days: String(config.days),
          product: 'sportbuddy78_premium'
        }
      })
    });

    const confirmationUrl = payment?.confirmation?.confirmation_url;
    if (!confirmationUrl || !payment?.id) {
      logger.error('YooKassa response lacks confirmation URL', { payment });
      throw new HttpsError('internal', 'Payment confirmation URL missing.');
    }

    await admin.firestore().doc(`payments/${payment.id}`).set({
      userId: uid,
      plan,
      days: config.days,
      amount: config.amount,
      currency: 'RUB',
      status: payment.status || 'pending',
      idempotenceKey,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      processed: false
    });

    return { confirmationUrl, paymentId: payment.id, amount: config.amount };
  }
);

/**
 * Public YooKassa webhook endpoint. It does not trust the received body:
 * after a `payment.succeeded` event it fetches the payment from YooKassa API,
 * verifies amount/metadata against the server-created payment record, then
 * applies Premium in an idempotent transaction.
 */
export const yooKassaWebhook = onRequest(
  {
    region: REGION,
    secrets: [yooKassaShopId, yooKassaSecretKey],
    timeoutSeconds: 60
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const event = request.body?.event;
    const paymentId = request.body?.object?.id;
    if (event !== 'payment.succeeded' || !paymentId) {
      response.status(200).json({ received: true });
      return;
    }

    try {
      const db = admin.firestore();
      const paymentRef = db.doc(`payments/${paymentId}`);
      const localPayment = await paymentRef.get();
      if (!localPayment.exists) {
        logger.warn('YooKassa webhook for unknown payment', { paymentId });
        response.status(200).json({ received: true });
        return;
      }

      const expected = localPayment.data()!;
      if (expected.processed === true) {
        response.status(200).json({ received: true, duplicate: true });
        return;
      }

      const remote = await yooKassaFetch(`/payments/${paymentId}`);
      const metadata = remote?.metadata || {};
      const isValid =
        remote?.status === 'succeeded' &&
        remote?.paid === true &&
        metadata.userId === expected.userId &&
        metadata.plan === expected.plan &&
        String(remote?.amount?.value) === String(expected.amount) &&
        remote?.amount?.currency === 'RUB';

      if (!isValid) {
        logger.error('YooKassa payment verification mismatch', { paymentId, remote, expected });
        response.status(400).json({ error: 'Payment verification failed' });
        return;
      }

      await db.runTransaction(async (transaction) => {
        const freshPayment = await transaction.get(paymentRef);
        if (freshPayment.data()?.processed === true) return;

        const userRef = db.doc(`users/${expected.userId}`);
        const user = await transaction.get(userRef);
        if (!user.exists) throw new Error('user-not-found');

        const currentExpiry = Date.parse(String(user.data()?.premiumUntil || ''));
        const base = Number.isFinite(currentExpiry) && currentExpiry > Date.now()
          ? currentExpiry
          : Date.now();
        const nextExpiry = new Date(base + Number(expected.days) * 24 * 60 * 60 * 1000).toISOString();

        transaction.update(userRef, {
          subscriptionPlan: 'premium',
          premiumUntil: nextExpiry,
          rewardPremiumEndsAt: nextExpiry,
          lastPaymentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        transaction.update(paymentRef, {
          status: 'succeeded',
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          yooKassaPaymentId: paymentId
        });
      });

      logger.info('Premium activated from YooKassa', { paymentId, userId: expected.userId });
      response.status(200).json({ received: true });
    } catch (error) {
      logger.error('YooKassa webhook processing failed', error);
      // YooKassa retries non-2xx responses; return 500 for transient DB/API failures.
      response.status(500).json({ error: 'Internal error' });
    }
  }
);

/**
 * Admin OTP without Firebase Auth: the server validates e-mail + password
 * against secrets, then e-mails a one-time 4-digit code.
 */
function requireAdminCredentials(request: any): string {
  const email = String(request.data?.email || '').trim().toLowerCase();
  const password = String(request.data?.password || '');
  if (email !== ADMIN_EMAIL || password !== adminPassword.value()) {
    throw new HttpsError('permission-denied', 'Invalid admin credentials.');
  }
  // Stable, non-secret identifier for challenge/session documents.
  return createHash('sha256').update(`${email}:${otpPepper.value()}`).digest('hex').slice(0, 32);
}

export const requestAdminOtp = onCall(
  {
    region: REGION,
    secrets: [otpPepper, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, adminPassword],
    enforceAppCheck: false
  },
  async (request) => {
    const adminKey = requireAdminCredentials(request);
    const db = admin.firestore();
    const ref = db.doc(`adminOtpChallenges/${adminKey}`);
    const existing = await ref.get();
    const now = Date.now();

    if (existing.exists) {
      const sentAt = existing.data()?.sentAt?.toMillis?.() ?? 0;
      if (now - sentAt < RESEND_COOLDOWN_MS) {
        throw new HttpsError('resource-exhausted', 'Wait before requesting a new code.');
      }
    }

    const code = String(randomInt(0, 10_000)).padStart(4, '0');
    const expiresAt = new Date(now + OTP_TTL_MS);
    await ref.set({
      codeHash: hashOtp(adminKey, code),
      attempts: 0,
      sentAt: admin.firestore.Timestamp.fromMillis(now),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
    });

    try {
      await mailer().sendMail({
        from: smtpFrom.value(),
        to: ADMIN_EMAIL,
        subject: `SportBuddy78 — код входа в админку: ${code}`,
        text: `Ваш одноразовый код администратора SportBuddy78: ${code}\n\nКод действует 10 минут. Никому не сообщайте его.`,
        html: `<div style="font-family:Arial,sans-serif;background:#020617;color:#f8fafc;padding:32px;border-radius:18px">
          <p style="color:#34d399;font-weight:bold;letter-spacing:1px">SPORTBUDDY78 · ADMIN</p>
          <h2 style="margin:8px 0 20px">Код входа: <span style="color:#fbbf24;font-size:32px;letter-spacing:8px">${code}</span></h2>
          <p style="color:#94a3b8">Код действует 10 минут. Никому не сообщайте его.</p>
        </div>`
      });
    } catch (error) {
      await ref.delete();
      logger.error('Admin OTP mail failed', error);
      throw new HttpsError('unavailable', 'Mail delivery failed.');
    }

    return { expiresAt: expiresAt.toISOString(), retryAfterSeconds: 60 };
  }
);

export const verifyAdminOtp = onCall(
  {
    region: REGION,
    secrets: [otpPepper, adminPassword],
    enforceAppCheck: false
  },
  async (request) => {
    const adminKey = requireAdminCredentials(request);
    const code = String(request.data?.code || '');
    if (!/^\d{4}$/.test(code)) {
      throw new HttpsError('invalid-argument', 'Four digit code required.');
    }

    const db = admin.firestore();
    const challengeRef = db.doc(`adminOtpChallenges/${adminKey}`);
    const now = Date.now();

    const result = await db.runTransaction(async (transaction) => {
      const challenge = await transaction.get(challengeRef);
      if (!challenge.exists) throw new HttpsError('not-found', 'Challenge not found.');

      const data = challenge.data()!;
      const expiresAt = data.expiresAt?.toMillis?.() ?? 0;
      const attempts = Number(data.attempts || 0);
      if (expiresAt <= now) {
        transaction.delete(challengeRef);
        throw new HttpsError('failed-precondition', 'Challenge expired.');
      }
      if (attempts >= MAX_ATTEMPTS) {
        transaction.delete(challengeRef);
        throw new HttpsError('resource-exhausted', 'Too many attempts.');
      }
      if (!safeHashEqual(String(data.codeHash || ''), hashOtp(adminKey, code))) {
        transaction.update(challengeRef, { attempts: attempts + 1 });
        throw new HttpsError('permission-denied', 'Invalid code.');
      }

      transaction.delete(challengeRef);
      return new Date(now + SESSION_TTL_MS).toISOString();
    });

    // Session id is random and short-lived; only the client that verified the
    // code receives it. Firestore stores it for server-side validation.
    const sessionId = randomUUID();
    await db.doc(`adminSessions/${sessionId}`).set({
      adminKey,
      email: ADMIN_EMAIL,
      issuedAt: admin.firestore.Timestamp.fromMillis(now),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(result))
    });

    logger.info('Admin OTP verified', { adminKey });
    return { sessionId, expiresAt: result };
  }
);

/**
 * Verifies the VK access token server-side and mints a Firebase custom token
 * with a stable uid (`vk_<vkId>`). This is the only place VK secrets live.
 */
export const vkLogin = onCall(
  { region: REGION, secrets: [vkAppId, vkAppSecret] },
  async (request) => {
    const accessToken = String(request.data?.accessToken || '');
    const vkUserId = String(request.data?.vkUserId || '');
    if (!accessToken || !vkUserId) {
      throw new HttpsError('invalid-argument', 'VK credentials required.');
    }

    try {
      const url = `https://api.vk.com/method/users.get?access_token=${encodeURIComponent(accessToken)}&v=5.131`;
      const response = await fetch(url);
      const body = (await response.json()) as { response?: Array<{ id?: number }> };
      const remoteId = String(body?.response?.[0]?.id ?? '');
      if (remoteId !== vkUserId) {
        throw new HttpsError('permission-denied', 'VK token does not match the user.');
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('unavailable', 'VK verification failed.');
    }

    const customToken = await admin.auth().createCustomToken(`vk_${vkUserId}`, { provider: 'vk' });
    return { customToken };
  }
);

/**
 * Admin event mutations run with Admin SDK privileges after OTP validation,
 * because the admin holds no Firebase Auth identity.
 */
export const adminMutateEvent = onCall(
  { region: REGION, secrets: [otpPepper] },
  async (request) => {
    const sessionId = String(request.data?.sessionId || '');
    if (!sessionId) throw new HttpsError('unauthenticated', 'Session required.');

    const db = admin.firestore();
    const session = await db.doc(`adminSessions/${sessionId}`).get();
    if (!session.exists) throw new HttpsError('unauthenticated', 'Session not found.');
    const expiresAt = session.data()?.expiresAt?.toMillis?.() ?? 0;
    if (expiresAt <= Date.now()) throw new HttpsError('unauthenticated', 'Session expired.');

    const operation = String(request.data?.operation || '');
    const eventId = String(request.data?.eventId || '');
    if (!eventId) throw new HttpsError('invalid-argument', 'Event id required.');

    const ref = db.doc(`events/${eventId}`);
    if (operation === 'create') {
      const event = request.data?.event;
      if (!event || typeof event !== 'object') throw new HttpsError('invalid-argument', 'Event payload required.');
      await ref.set({ ...(event as Record<string, unknown>), id: eventId });
    } else if (operation === 'update') {
      const patch = request.data?.patch;
      if (!patch || typeof patch !== 'object') throw new HttpsError('invalid-argument', 'Patch required.');
      await ref.update(patch as Record<string, unknown>);
    } else if (operation === 'delete') {
      await ref.delete();
    } else {
      throw new HttpsError('invalid-argument', 'Unknown operation.');
    }

    return { ok: true };
  }
);

/**
 * Server-side profile verification. This deliberately checks only the two
 * public-beta requirements: a personal avatar and at least one profile photo.
 * The client can request verification but cannot write `isVerified` itself.
 */
export const verifyMyProfile = onCall<{ avatar?: unknown; photoPortfolio?: unknown }>(
  { region: REGION },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const uid = request.auth.uid;
    const ref = admin.firestore().doc(`users/${uid}`);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'Profile not found.');

    const profile = snapshot.data() || {};
    const registeredAt = Date.parse(String(profile.registeredAt || ''));
    if (Number.isFinite(registeredAt) && Date.now() - registeredAt > VERIFICATION_GRACE_MS) {
      throw new HttpsError('failed-precondition', 'Verification deadline expired.');
    }

    // Persist supplied profile media atomically with verification so a slow
    // offline-first client write cannot race this callable on mobile.
    const avatar = String(request.data?.avatar || profile.avatar || '').trim();
    const rawPortfolio = Array.isArray(request.data?.photoPortfolio)
      ? request.data.photoPortfolio
      : profile.photoPortfolio;
    const portfolio = Array.isArray(rawPortfolio)
      ? rawPortfolio.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const looksLikePlaceholder = /ui-avatars|placeholder|dicebear|gravatar\.com\/avatar\/00000/i.test(avatar);
    const validAvatar = Boolean(avatar) && !looksLikePlaceholder && avatar.length <= 250_000;
    const validPortfolio = portfolio.length > 0
      && portfolio.length <= 5
      && portfolio.every((item) => item.length <= 250_000)
      && portfolio.join('').length <= 500_000;

    if (!validAvatar || !validPortfolio) {
      throw new HttpsError(
        'failed-precondition',
        'Personal avatar and at least one profile photo are required.'
      );
    }

    const verifiedAt = new Date().toISOString();

    // The 30-day welcome Premium unlocks only after verification. Paid or
    // existing premium is never overwritten: we grant only when absent.
    const existing = (await ref.get()).data() || {};
    const hasPremium = Boolean(existing.premiumUntil) || existing.subscriptionPlan === 'premium';
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const update: Record<string, unknown> = {
      avatar,
      photoPortfolio: portfolio,
      hasRealPhoto: true,
      isVerified: true,
      verifiedAt,
      verificationMethod: 'photo-and-portfolio'
    };
    if (!hasPremium) {
      update.subscriptionPlan = 'premium';
      update.premiumUntil = trialEnd;
      update.trialPremiumEndsAt = trialEnd;
      update.rewardPremiumEndsAt = trialEnd;
    }

    await ref.set(update, { merge: true });

    return { verifiedAt, premiumGranted: !hasPremium, premiumUntil: hasPremium ? String(existing.premiumUntil) : trialEnd };
  }
);

/**
 * Immediate self-cleanup invoked by an expired unverified client on launch.
 * Scheduler remains the fallback for accounts that never return to the app.
 */
export const deleteMyExpiredUnverifiedAccount = onCall(
  { region: REGION },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const uid = request.auth.uid;
    const db = admin.firestore();
    const ref = db.doc(`users/${uid}`);
    const snapshot = await ref.get();
    if (!snapshot.exists) return { deleted: true };

    const profile = snapshot.data() || {};
    const registeredAt = Date.parse(String(profile.registeredAt || ''));
    const expired = Number.isFinite(registeredAt) && Date.now() - registeredAt >= VERIFICATION_GRACE_MS;
    if (profile.isVerified === true || !expired) {
      throw new HttpsError('failed-precondition', 'Account is not eligible for deletion.');
    }

    const writer = db.bulkWriter();
    const queries = await Promise.all([
      db.collection('goals').where('ownerId', '==', uid).get(),
      db.collection('checkins').where('userId', '==', uid).get(),
      db.collection('feed').where('authorId', '==', uid).get(),
      db.collection('chats').where('participantIds', 'array-contains', uid).get(),
      db.collection('trainings').where('createdBy', '==', uid).get(),
      db.collection('friendRequests').where('fromId', '==', uid).get(),
      db.collection('friendRequests').where('toId', '==', uid).get(),
      db.collection('friendships').where('participantIds', 'array-contains', uid).get()
    ]);
    queries.flatMap((q) => q.docs).forEach((doc) => writer.delete(doc.ref));
    writer.delete(ref);
    await writer.close();
    await admin.auth().deleteUser(uid).catch(() => {});
    logger.info('Expired unverified account deleted on app launch', { uid });
    return { deleted: true };
  }
);

async function deleteQuery(query: any, writer: any): Promise<void> {
  const snapshot = await query.get();
  snapshot.docs.forEach((doc) => writer.delete(doc.ref));
}

/**
 * Cleans up expired unverified accounts hourly.
 * It also removes personally linked user content to comply with the stated
 * 24-hour anti-fraud policy and minimise storage of abandoned data.
 */
export const cleanupExpiredUnverifiedUsers = onSchedule(
  { region: REGION, schedule: 'every 15 minutes', timeZone: 'Europe/Moscow', timeoutSeconds: 540 },
  async () => {
    const db = admin.firestore();
    const cutoffIso = new Date(Date.now() - VERIFICATION_GRACE_MS).toISOString();
    const candidates = await db.collection('users')
      .where('registeredAt', '<=', cutoffIso)
      .limit(100)
      .get();

    const writer = db.bulkWriter();
    let removed = 0;
    const removedUids: string[] = [];

    for (const profileDoc of candidates.docs) {
      // Re-read before destructive work: the athlete may have completed
      // verification between the scheduled query and this iteration.
      const latest = await profileDoc.ref.get();
      if (!latest.exists) continue;
      const profile = latest.data() || {};
      if (profile.isVerified === true) continue;
      const uid = latest.id;

      // Remove owned or personally identifiable documents.
      await Promise.all([
        deleteQuery(db.collection('goals').where('ownerId', '==', uid), writer),
        deleteQuery(db.collection('checkins').where('userId', '==', uid), writer),
        deleteQuery(db.collection('ratings').where('targetUserId', '==', uid), writer),
        deleteQuery(db.collection('ratings').where('participantId', '==', uid), writer),
        deleteQuery(db.collection('ratings').where('organizerId', '==', uid), writer),
        deleteQuery(db.collection('feed').where('authorId', '==', uid), writer),
        deleteQuery(db.collection('chats').where('participantIds', 'array-contains', uid), writer),
        deleteQuery(db.collection('trainings').where('createdBy', '==', uid), writer),
        deleteQuery(db.collection('friendRequests').where('fromId', '==', uid), writer),
        deleteQuery(db.collection('friendRequests').where('toId', '==', uid), writer),
        deleteQuery(db.collection('friendships').where('participantIds', 'array-contains', uid), writer)
      ]);

      // Do not delete shared events/trainings: remove the expired athlete only.
      const [participatingTrainings, participatingEvents, ...relationshipSnapshots] = await Promise.all([
        db.collection('trainings').where('participantIds', 'array-contains', uid).get(),
        db.collection('events').where('participantIds', 'array-contains', uid).get(),
        db.collection('users').where('friendIds', 'array-contains', uid).get(),
        db.collection('users').where('friendRequestsSent', 'array-contains', uid).get(),
        db.collection('users').where('friendRequestsReceived', 'array-contains', uid).get(),
        db.collection('users').where('likedUserIds', 'array-contains', uid).get(),
        db.collection('users').where('matchIds', 'array-contains', uid).get()
      ]);
      participatingTrainings.docs.forEach((doc) => writer.update(doc.ref, {
        participantIds: admin.firestore.FieldValue.arrayRemove(uid),
        checkedInUserIds: admin.firestore.FieldValue.arrayRemove(uid),
        ratedParticipantIds: admin.firestore.FieldValue.arrayRemove(uid),
        organizerRatedByParticipantIds: admin.firestore.FieldValue.arrayRemove(uid)
      }));
      participatingEvents.docs.forEach((doc) => writer.update(doc.ref, {
        participantIds: admin.firestore.FieldValue.arrayRemove(uid)
      }));
      const relatedUsers = new Map<string, any>();
      relationshipSnapshots.flatMap((snapshot) => snapshot.docs).forEach((doc) => {
        relatedUsers.set(doc.id, doc);
      });
      relatedUsers.forEach((doc) => writer.update(doc.ref, {
        friendIds: admin.firestore.FieldValue.arrayRemove(uid),
        friendRequestsSent: admin.firestore.FieldValue.arrayRemove(uid),
        friendRequestsReceived: admin.firestore.FieldValue.arrayRemove(uid),
        likedUserIds: admin.firestore.FieldValue.arrayRemove(uid),
        matchIds: admin.firestore.FieldValue.arrayRemove(uid)
      }));

      writer.delete(latest.ref);
      removed += 1;
      removedUids.push(uid);
    }

    await writer.close();
    // Delete the Firebase Auth identity too: otherwise the expired e-mail
    // account could still sign in even though its profile was purged.
    for (const uid of removedUids) {
      try {
        await admin.auth().deleteUser(uid);
      } catch (error: any) {
        // A missing Auth identity is harmless (e.g. offline/local-only users).
        if (error?.code !== 'auth/user-not-found') {
          logger.warn('Unable to delete expired Auth user', { uid, error });
        }
      }
    }
    logger.info('Expired unverified profile cleanup complete', { removed });
  }
);