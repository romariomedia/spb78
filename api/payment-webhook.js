import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { paymentMatches, validPaymentId } from '../server/payment-config.js';
function init() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(raw ? { credential: cert(JSON.parse(raw)) } : undefined);
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
  if (req.body?.event !== 'payment.succeeded') return res.status(200).json({ received: true });
  const id = req.body?.object?.id;
  if (!validPaymentId(id)) return res.status(400).json({ error: 'Некорректный ID платежа' });
  const shopId = process.env.YOOKASSA_SHOP_ID, secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) return res.status(503).json({ error: 'Оплата временно недоступна' });
  try {
    init();
    const db = getFirestore(), ref = db.collection('payments').doc(id);
    const local = await ref.get();
    // Do not acknowledge an event that raced ahead of the payment creation write.
    if (!local.exists) return res.status(503).json({ error: 'Платёж ещё не зарегистрирован' });
    if (local.data().processed) return res.status(200).json({ received: true });
    const response = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(10000), headers: { Authorization: `Basic ${Buffer.from(`${shopId}:${secret}`).toString('base64')}` }
    });
    if (!response.ok) return res.status(503).json({ error: 'Не удалось проверить платёж' });
    const remote = await response.json();
    if (!paymentMatches(remote, local.data(), id)) return res.status(400).json({ error: 'Платёж не прошёл серверную проверку' });
    await db.runTransaction(async tx => {
      const fresh = await tx.get(ref);
      if (!fresh.exists) throw new Error('Payment disappeared');
      const expected = fresh.data();
      if (expected.processed) return;
      if (!paymentMatches(remote, expected, id)) throw new Error('Payment changed');
      const userRef = db.collection('users').doc(expected.userId), user = await tx.get(userRef);
      if (!user.exists) throw new Error('User missing');
      const raw = user.data().premiumUntil;
      const expiry = raw?.toDate ? raw.toDate().getTime() : Date.parse(String(raw || ''));
      const now = Date.now(), base = Number.isFinite(expiry) && expiry > now ? expiry : now;
      const premiumUntil = new Date(base + expected.days * 86400000).toISOString();
      tx.update(userRef, { subscriptionPlan: 'premium', premiumUntil });
      tx.update(ref, { status: 'succeeded', processed: true, processedAt: new Date(now).toISOString() });
    });
    return res.status(200).json({ received: true });
  } catch {
    return res.status(503).json({ error: 'Не удалось обработать платёж. Требуется повторная доставка.' });
  }
}
