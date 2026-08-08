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
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // Получаем Firebase ID Token для авторизации запроса в YooKassa Serverless Function
    let idToken = '';
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken(true);
    }

    const res = await fetch(`${apiBase()}/api/create-payment`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': idToken ? `Bearer ${idToken}` : ''
      },
      body: JSON.stringify({ plan }),
      signal: controller.signal
    });
    const payload = (await res.json().catch(() => null)) as Partial<PremiumPaymentResult> & { error?: string } | null;
    if (!res.ok || !payload?.confirmationUrl) {
      throw Object.assign(new Error(payload?.error || paymentError(res.status)), { status: res.status });
    }
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
