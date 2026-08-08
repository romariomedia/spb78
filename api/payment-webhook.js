// api/payment-webhook.js
// Vercel/Node serverless webhook adapter. Production Firebase deployment uses
// the equivalent `yooKassaWebhook` Cloud Function for Capacitor clients.

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function adminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  return initializeApp(raw ? { credential: cert(JSON.parse(raw)) } : undefined);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

  const paymentId = req.body?.event === 'payment.succeeded' ? req.body?.object?.id : null;
  if (!paymentId) return res.status(200).json({ received: true });

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) return res.status(500).json({ error: 'Не настроены ключи ЮKassa' });

  try {
    adminApp();
    const db = getFirestore();
    const paymentRef = db.collection('payments').doc(paymentId);
    const local = await paymentRef.get();
    if (!local.exists || local.data()?.processed) return res.status(200).json({ received: true });

    // Re-fetch from YooKassa API: never activate Premium from webhook body alone.
    const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
    const remoteResponse = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    const remote = await remoteResponse.json();
    const expected = local.data();

    const valid = remoteResponse.ok && remote.status === 'succeeded' && remote.paid === true
      && remote.metadata?.userId === expected.userId
      && remote.metadata?.plan === expected.plan
      && String(remote.amount?.value) === String(expected.amount)
      && remote.amount?.currency === 'RUB';
    if (!valid) return res.status(400).json({ error: 'Платёж не прошёл серверную проверку' });

    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(paymentRef);
      if (fresh.data()?.processed) return;

      const userRef = db.collection('users').doc(expected.userId);
      const user = await tx.get(userRef);
      if (!user.exists) throw new Error('Пользователь не найден');

      const expiry = Date.parse(user.data().premiumUntil || '');
      const base = Number.isFinite(expiry) && expiry > Date.now() ? expiry : Date.now();
      const premiumUntil = new Date(base + Number(expected.days) * 86400000).toISOString();

      tx.update(userRef, { subscriptionPlan: 'premium', premiumUntil, rewardPremiumEndsAt: premiumUntil });
      tx.update(paymentRef, { status: 'succeeded', processed: true, processedAt: new Date().toISOString() });
    });

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook payment processing error', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}