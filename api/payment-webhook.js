import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { paymentMatches, validPaymentId } from '../server/payment-config.js';
import {addCalendarMonths,businessPaymentMatches,businessPromotionPaymentMatches,businessSubscriptionId} from '../server/business-billing.js';
import {buildBusinessContractSnapshot} from '../server/business-legal.js';
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
    const initial = local.data();
    const matches = initial.product === 'business_subscription'
      ? businessPaymentMatches(remote, initial, id)
      : initial.product === 'business_promotion'
      ? businessPromotionPaymentMatches(remote, initial, id)
      : paymentMatches(remote, initial, id);
    if (!matches) return res.status(400).json({ error: 'Платёж не прошёл серверную проверку' });
    await db.runTransaction(async tx => {
      const fresh = await tx.get(ref);
      if (!fresh.exists) throw new Error('Payment disappeared');
      const expected = fresh.data();
      if (expected.processed) return;
      const valid = expected.product === 'business_subscription'
        ? businessPaymentMatches(remote, expected, id)
        : expected.product === 'business_promotion'
        ? businessPromotionPaymentMatches(remote, expected, id)
        : paymentMatches(remote, expected, id);
      if (!valid) throw new Error('Payment changed');
      const now = Date.now();

      if (expected.product === 'business_subscription') {
        const subscriptionId = businessSubscriptionId(expected.subjectType, expected.subjectId);
        const subscriptionRef = db.collection('businessSubscriptions').doc(subscriptionId);
        const adminRef = expected.subjectType === 'trainer' ? db.collection('userAdmin').doc(expected.subjectId) : null;
        const subscriptionSnap = await tx.get(subscriptionRef);
        const adminSnap = adminRef ? await tx.get(adminRef) : null;
        const subscription = subscriptionSnap.exists ? subscriptionSnap.data() || {} : {};
        const currentRaw = subscription.activeUntil;
        const currentExpiry = currentRaw?.toDate ? currentRaw.toDate().getTime() : Date.parse(String(currentRaw || ''));
        const freeRaw = adminSnap?.exists && adminSnap.data()?.foundingCoach === true ? adminSnap.data()?.foundingCoachFreeUntil : '';
        const freeExpiry = freeRaw?.toDate ? freeRaw.toDate().getTime() : Date.parse(String(freeRaw || ''));
        const base = Math.max(now, Number.isFinite(currentExpiry) ? currentExpiry : 0, Number.isFinite(freeExpiry) ? freeExpiry : 0);
        const serviceStart=new Date(base).toISOString();
        const activeUntil = addCalendarMonths(new Date(base), expected.months).toISOString();
        const contract=buildBusinessContractSnapshot({
          payment:{...expected,paymentId:id},
          serviceStart,serviceUntil:activeUntil,createdAt:new Date(now)
        });
        const next = {
          ...subscription,
          subjectType:expected.subjectType,subjectId:expected.subjectId,subjectLabel:expected.subjectLabel,
          ownerUserId:expected.ownerUserId,activeUntil,paidUntil:activeUntil,
          createdAt:subscription.createdAt || expected.createdAt || new Date(now).toISOString(),
          updatedAt:new Date(now).toISOString(),lastPaymentAt:new Date(now).toISOString(),lastPaymentId:id,
          lastContractId:id,lastContractNumber:contract.contractNumber
        };
        tx.set(subscriptionRef,next,{merge:false});
        tx.create(db.collection('businessContracts').doc(id),contract);
        tx.create(db.collection('billingLedger').doc(`yookassa:${id}`),{
          eventType:'payment',provider:'yookassa',paymentId:id,contractId:id,contractNumber:contract.contractNumber,
          subjectType:expected.subjectType,subjectId:expected.subjectId,subjectLabel:expected.subjectLabel,
          ownerUserId:expected.ownerUserId,interval:expected.interval,months:expected.months,
          amountRub:Number(expected.amount),currency:'RUB',createdAt:new Date(now).toISOString(),activeUntil
        });
      } else if (expected.product === 'business_promotion') {
        const subscriptionId = businessSubscriptionId(expected.subjectType, expected.subjectId);
        const subscriptionRef = db.collection('businessSubscriptions').doc(subscriptionId);
        const subscriptionSnap = await tx.get(subscriptionRef);
        if (!subscriptionSnap.exists) throw new Error('Business subscription missing');
        const subscription = subscriptionSnap.data() || {};
        if (subscription.ownerUserId !== expected.ownerUserId) throw new Error('Business owner changed');
        const currentRaw = subscription.promotedUntil;
        const currentExpiry = currentRaw?.toDate ? currentRaw.toDate().getTime() : Date.parse(String(currentRaw || ''));
        const base = Number.isFinite(currentExpiry) && currentExpiry > now ? currentExpiry : now;
        const serviceStart=new Date(base).toISOString();
        const promotedUntil = new Date(base + expected.days * 86400000).toISOString();
        const contract=buildBusinessContractSnapshot({
          payment:{...expected,paymentId:id},
          serviceStart,serviceUntil:promotedUntil,createdAt:new Date(now)
        });
        tx.update(subscriptionRef,{
          promotedUntil,updatedAt:new Date(now).toISOString(),
          lastPromotionPaymentAt:new Date(now).toISOString(),lastPromotionPaymentId:id,
          lastContractId:id,lastContractNumber:contract.contractNumber
        });
        tx.create(db.collection('businessContracts').doc(id),contract);
        tx.create(db.collection('billingLedger').doc(`yookassa:${id}`),{
          eventType:'promotion_payment',provider:'yookassa',paymentId:id,contractId:id,contractNumber:contract.contractNumber,
          subjectType:expected.subjectType,subjectId:expected.subjectId,subjectLabel:expected.subjectLabel,
          ownerUserId:expected.ownerUserId,days:expected.days,
          amountRub:Number(expected.amount),currency:'RUB',createdAt:new Date(now).toISOString(),promotedUntil
        });
      } else {
        const userRef = db.collection('users').doc(expected.userId), user = await tx.get(userRef);
        if (!user.exists) throw new Error('User missing');
        const raw = user.data().premiumUntil;
        const expiry = raw?.toDate ? raw.toDate().getTime() : Date.parse(String(raw || ''));
        const base = Number.isFinite(expiry) && expiry > now ? expiry : now;
        const premiumUntil = new Date(base + expected.days * 86400000).toISOString();
        tx.update(userRef, { subscriptionPlan: 'premium', premiumUntil });
      }
      tx.update(ref, {
        status:'succeeded',processed:true,processedAt:new Date(now).toISOString(),
        ...(['business_subscription','business_promotion'].includes(expected.product)?{contractId:id}:{})
      });
    });
    return res.status(200).json({ received: true });
  } catch {
    return res.status(503).json({ error: 'Не удалось обработать платёж. Требуется повторная доставка.' });
  }
}
