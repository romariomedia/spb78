// api/create-payment.js
// Vercel/Node serverless adapter. The Capacitor app calls the equivalent
// Firebase callable function `createYooKassaPayment`; this route is useful
// when sportbuddy78.pro is deployed to a Node serverless host.

import { randomUUID } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PLANS = {
  monthly: { amount: '490.00', days: 30, label: 'Premium на 1 месяц' },
  yearly: { amount: '4900.00', days: 365, label: 'Premium на 1 год' }
};

function adminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  return initializeApp(raw ? { credential: cert(JSON.parse(raw)) } : undefined);
}

function error(res, status, message) {
  return res.status(status).json({ error: message });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res, 405, 'Метод не поддерживается');

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) return error(res, 500, 'Не настроены ключи ЮKassa');

  const plan = req.body?.plan;
  if (!PLANS[plan]) return error(res, 400, 'Некорректный тариф');

  // Never trust userId from req.body: require Firebase ID token instead.
  const idToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!idToken) return error(res, 401, 'Требуется авторизация');

  let userId;
  try {
    adminApp();
    userId = (await getAuth().verifyIdToken(idToken)).uid;
  } catch {
    return error(res, 401, 'Недействительная сессия пользователя');
  }

  const config = PLANS[plan];
  const idempotenceKey = randomUUID();
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

  try {
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        'Idempotence-Key': idempotenceKey
      },
      body: JSON.stringify({
        amount: { value: config.amount, currency: 'RUB' },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: 'https://sportbuddy78.pro/success'
        },
        description: `${config.label} SportBuddy78`,
        metadata: {
          userId,
          plan,
          days: String(config.days),
          product: 'sportbuddy78_premium'
        }
      })
    });

    const payment = await response.json();
    if (!response.ok || !payment?.confirmation?.confirmation_url) {
      console.error('YooKassa payment creation failed', payment);
      return error(res, 400, 'Не удалось создать платёж');
    }

    await getFirestore().collection('payments').doc(payment.id).set({
      userId,
      plan,
      days: config.days,
      amount: config.amount,
      currency: 'RUB',
      status: payment.status || 'pending',
      processed: false,
      idempotenceKey,
      createdAt: new Date().toISOString()
    });

    return res.status(200).json({
      confirmationUrl: payment.confirmation.confirmation_url,
      paymentId: payment.id,
      amount: config.amount
    });
  } catch (err) {
    console.error('Payment server error', err);
    return error(res, 500, 'Внутренняя ошибка сервера');
  }
}