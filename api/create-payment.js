import { isBetaActive } from '../shared/access-policy.js';
import { randomUUID, createHash } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getPlan, validPaymentId } from '../server/payment-config.js';
function init() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(raw ? { credential: cert(JSON.parse(raw)) } : undefined);
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
  if (isBetaActive()) return res.status(409).json({code:'BETA_FREE_ACCESS',error:'До 31 декабря 2026 года Premium бесплатен для всех. Оплата откроется 1 января 2027 года.'});
  const plan = req.body?.plan, config = getPlan(plan);
  if (!config) return res.status(400).json({ error: 'Некорректный тариф' });
  const requestId = req.body?.requestId ?? randomUUID();
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(requestId)) return res.status(400).json({ error: 'Некорректный идентификатор запроса' });
  const shopId = process.env.YOOKASSA_SHOP_ID, secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) return res.status(503).json({ error: 'Оплата временно недоступна' });
  try {
    init();
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
    const { uid } = await getAuth().verifyIdToken(token);
    const db = getFirestore();
    const key = createHash('sha256').update(`${uid}:${requestId}`).digest('hex');
    const requestRef = db.collection('paymentRequests').doc(key);
    const intent = await db.runTransaction(async tx => {
      const previous = await tx.get(requestRef);
      const user = await tx.get(db.collection('users').doc(uid));
      if (!user.exists) throw Object.assign(new Error('Сначала завершите создание профиля'), { status: 404 });
      if (previous.exists) {
        const value = previous.data();
        if (value.plan !== plan || Date.now() - Date.parse(value.createdAt) >= 23 * 3600000) throw Object.assign(new Error('Начните оплату заново'), { status: 409 });
        return value;
      }
      const value = { userId: uid, plan, amount: config.amount, days: config.days, currency: 'RUB', label: config.label, createdAt: new Date().toISOString() };
      tx.create(requestRef, value);
      return value;
    });
    if (intent.paymentId && intent.confirmationUrl) return res.status(200).json({ paymentId: intent.paymentId, confirmationUrl: intent.confirmationUrl, amount: intent.amount });
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${shopId}:${secret}`).toString('base64')}`, 'Idempotence-Key': key },
      body: JSON.stringify({
        amount: { value: intent.amount, currency: 'RUB' }, capture: true,
        confirmation: { type: 'redirect', return_url: 'https://sportbuddy78.pro/success' },
        description: `${intent.label} SportBuddy78`,
        metadata: { userId: uid, plan: intent.plan, days: String(intent.days), product: 'sportbuddy78_premium' }
      })
    });
    const payment = await response.json();
    if (!response.ok || !validPaymentId(payment.id) || !payment.confirmation?.confirmation_url) return res.status(503).json({ error: 'Не удалось создать платёж. Повторите попытку.' });
    const confirmationUrl = payment.confirmation.confirmation_url;
    if (typeof confirmationUrl !== 'string' || !confirmationUrl.startsWith('https://')) throw new Error('Invalid confirmation URL');
    await db.runTransaction(async tx => {
      const paymentRef = db.collection('payments').doc(payment.id);
      const saved = await tx.get(paymentRef);
      if (!saved.exists) tx.create(paymentRef, {
        userId: uid, plan: intent.plan, days: intent.days, amount: intent.amount, currency: 'RUB',
        status: payment.status || 'pending', processed: false, idempotenceKey: key, createdAt: intent.createdAt
      });
      tx.update(requestRef, { paymentId: payment.id, confirmationUrl });
    });
    return res.status(200).json({ paymentId: payment.id, confirmationUrl, amount: intent.amount });
  } catch (error) {
    const status = error.code?.startsWith?.('auth/') ? 401 : error.status || 503;
    return res.status(status).json({ error: status === 401 ? 'Требуется повторный вход' : error.status ? error.message : 'Платёжный сервис временно недоступен. Повторите попытку.' });
  }
}
