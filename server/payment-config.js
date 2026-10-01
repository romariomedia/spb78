import { BETA_END } from '../shared/access-policy.js';
export const PLANS = Object.freeze({
  monthly: { amount: '490.00', days: 30, label: 'Premium на 1 месяц' },
  yearly: { amount: '4900.00', days: 365, label: 'Premium на 1 год' }
});
export const getPlan = name => {
  if (typeof name !== 'string' || !Object.hasOwn(PLANS,name)) return null;
  const plan = PLANS[name];
  return Date.now() >= BETA_END ? {...plan,amount:name === 'monthly' ? '990.00' : '9900.00'} : plan;
};
export const validPaymentId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
export function paymentMatches(remote, expected, paymentId) {
  return remote.id === paymentId && remote.status === 'succeeded' && remote.paid === true
    && (remote.test !== true || process.env.YOOKASSA_ALLOW_TEST_PAYMENTS === 'true')
    && remote.metadata?.userId === expected.userId && remote.metadata?.plan === expected.plan
    && remote.metadata?.product === 'sportbuddy78_premium'
    && String(remote.metadata?.days) === String(expected.days)
    && Number.isInteger(expected.days) && expected.days > 0
    && String(remote.amount?.value) === String(expected.amount)
    && remote.amount?.currency === 'RUB' && expected.currency === 'RUB';
}
