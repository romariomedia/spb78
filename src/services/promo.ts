import { PromoCode, PromoSource, UserProfile } from '../lib/types';
import { triggerHapticNotification } from './native';
import { callServer } from './serverApi';

const PROMO_STORE_KEY = 'sportbuddy_promo_codes_v1';
export const TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------- promo storage ------------------------------- */

function readPromos(): PromoCode[] {
  try {
    const raw = localStorage.getItem(PROMO_STORE_KEY);
    return raw ? (JSON.parse(raw) as PromoCode[]) : [];
  } catch {
    return [];
  }
}

function writePromos(codes: PromoCode[]): void {
  try {
    localStorage.setItem(PROMO_STORE_KEY, JSON.stringify(codes));
  } catch {
    /* ignore */
  }
}

function randomBlock(len: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) {
    out += alphabet[(arr[i] ?? 0) % alphabet.length];
  }
  return out;
}

const SOURCE_PREFIX: Record<PromoSource, string> = {
  box: 'BOX',
  streak: 'GOLD',
  partner: 'SPB'
};

/** Creates a gift promo code (from a SportBuddy BOX or a 7-medal streak). */
export function generatePromoCode(
  source: PromoSource,
  days: number,
  ownerId: string,
  title: string
): PromoCode {
  const code = `${SOURCE_PREFIX[source]}-${randomBlock(4)}-${randomBlock(4)}`;
  const promo: PromoCode = {
    code,
    days,
    source,
    title,
    createdAt: new Date().toISOString(),
    ownerId
  };
  writePromos([promo, ...readPromos()]);
  return promo;
}

export function getMyPromoCodes(ownerId: string): PromoCode[] {
  return readPromos().filter((p) => p.ownerId === ownerId);
}

/* ----------------------------- premium calculation ---------------------------- */

export function getPremiumUntil(user: UserProfile): Date | null {
  if (!user.premiumUntil) return null;
  const date = new Date(user.premiumUntil);
  return isNaN(date.getTime()) ? null : date;
}

export function isPremiumActive(user: UserProfile): boolean {
  const until = getPremiumUntil(user);
  return until !== null && until.getTime() > Date.now();
}

export function premiumDaysLeft(user: UserProfile): number {
  const until = getPremiumUntil(user);
  if (!until) return 0;
  const diff = until.getTime() - Date.now();
  return diff <= 0 ? 0 : Math.ceil(diff / DAY_MS);
}

export function isTrialActive(user: UserProfile): boolean {
  if (!user.trialPremiumEndsAt) return false;
  const trialEnd = new Date(user.trialPremiumEndsAt).getTime();
  const until = getPremiumUntil(user);
  // trial is "active" while premium expiry still equals the trial window
  return trialEnd > Date.now() && until !== null && Math.abs(until.getTime() - trialEnd) < 60000;
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

/** Adds N premium days on top of the current expiry (or from now if expired). */
/** Recomputes the plan field from the expiry date (call on every app start). */
export function syncSubscriptionPlan(user: UserProfile): UserProfile {
  const active = isPremiumActive(user);
  if (active && user.subscriptionPlan !== 'premium') {
    return { ...user, subscriptionPlan: 'premium' };
  }
  if (!active && user.subscriptionPlan === 'premium' && user.premiumUntil) {
    return { ...user, subscriptionPlan: 'free' };
  }
  return user;
}

/* -------------------------------- redemption --------------------------------- */

export interface RedeemResult {
  ok: boolean;
  error?: string;
  days?: number;
  user?: UserProfile;
  title?: string;
}

export async function redeemPromoCode(user: UserProfile, rawCode: string): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok:false, error:'Введите промокод' };
  try {
    const result = await callServer<{days:number; title:string; premiumUntil:string}>('/api/sportbuddy-mutation', { action:'redeemPromo', code });
    const updated = { ...user, subscriptionPlan:'premium' as const, premiumUntil:result.premiumUntil, rewardPremiumEndsAt:result.premiumUntil, redeemedPromoCodes:[...(user.redeemedPromoCodes || []), code] };
    triggerHapticNotification('success');
    return { ok:true, days:result.days, user:updated, title:result.title };
  } catch(error) { return { ok:false, error:error instanceof Error ? error.message : 'Не удалось активировать промокод' }; }
}
