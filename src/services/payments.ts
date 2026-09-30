import { auth } from './firebaseAuth';
export type PremiumPlan = 'monthly' | 'yearly';

export interface PremiumPaymentResult {
  confirmationUrl: string;
  paymentId: string;
  amount: string;
}

/* API base resolution mirrors storage.ts / verification.ts. */
const configuredApi = import.meta.env.VITE_API_BASE_URL || '';
const PRODUCTION_API = 'https://sportbuddy78.pro';

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

function apiBase(): string {
  if (configuredApi) return configuredApi.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    return PRODUCTION_API;
  }
  return '';
}

const REQUEST_TIMEOUT_MS = 20_000;
const pendingRequests = new Map<string, { id: string; at: number }>();

function paymentError(status: number): string {
  switch (status) {
    case 400: return 'Выбран некорректный тариф.';
    case 401: return 'Сначала войдите в аккаунт.';
    case 503: return 'Платёжный сервис временно недоступен. Попробуйте позже.';
    default: return 'Не удалось создать платёж ЮKassa.';
  }
}

/**
 * Creates a server-side YooKassa payment via the Vercel function
 * `api/create-payment.js` and returns only the redirect URL.
 */
export async function createPremiumPayment(plan: PremiumPlan): Promise<PremiumPaymentResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Сначала войдите в аккаунт.');
  const storageKey = `sportbuddy_payment_request_${uid}_${plan}`;
  let pending = pendingRequests.get(storageKey);
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as { id: string; at: number } | null;
    if (stored && typeof stored.id === 'string' && /^[a-zA-Z0-9_-]{16,128}$/.test(stored.id) && Number.isFinite(stored.at)) pending = stored;
  } catch { /* Keep the in-memory key if browser storage is unavailable. */ }
  if (!pending || Date.now() - pending.at >= 23 * 3600000 || pending.at > Date.now()) pending = { id: crypto.randomUUID(), at: Date.now() };
  pendingRequests.set(storageKey, pending);
  try { sessionStorage.setItem(storageKey, JSON.stringify(pending)); } catch { /* optional persistence */ }
  const requestId = pending.id;
  const clearRequest = () => {
    pendingRequests.delete(storageKey);
    try { sessionStorage.removeItem(storageKey); } catch { /* optional persistence */ }
  };
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // Получаем Firebase ID Token для авторизации запроса в YooKassa Serverless Function
    let idToken = '';
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken(true);
      if (auth.currentUser?.uid !== uid) throw new Error('Аккаунт изменился. Начните оплату заново.');
    }

    const res = await fetch(`${apiBase()}/api/create-payment`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': idToken ? `Bearer ${idToken}` : ''
      },
      body: JSON.stringify({ plan, requestId }),
      signal: controller.signal
    });
    const payload = (await res.json().catch(() => null)) as Partial<PremiumPaymentResult> & { error?: string } | null;
    if (!res.ok || !payload?.confirmationUrl) {
      if ([400, 401, 404, 409].includes(res.status)) clearRequest();
      throw Object.assign(new Error(payload?.error || paymentError(res.status)), { status: res.status });
    }
    clearRequest();
    return {
      confirmationUrl: payload.confirmationUrl,
      paymentId: String(payload.paymentId || ''),
      amount: String(payload.amount || '')
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Сервер оплаты не ответил. Проверьте интернет.');
    }
    throw error instanceof Error ? error : new Error('Не удалось создать платёж ЮKassa.');
  } finally {
    window.clearTimeout(timer);
  }
}

/** Opens YooKassa checkout. The provider returns to /success after payment. */
export function redirectToPayment(url: string): void {
  window.location.assign(url);
}
