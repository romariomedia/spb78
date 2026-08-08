import { PromoCode, PromoSource, UserProfile } from '../lib/types';
import { triggerHapticNotification } from './native';

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
export function addPremiumDays(user: UserProfile, days: number): UserProfile {
  const current = getPremiumUntil(user);
  const base = current && current.getTime() > Date.now() ? current.getTime() : Date.now();
  const next = new Date(base + days * DAY_MS);
  return {
    ...user,
    subscriptionPlan: 'premium',
    premiumUntil: next.toISOString(),
    rewardPremiumEndsAt: next.toLocaleDateString('ru-RU')
  };
}

/** Grants the 30-day welcome trial to a freshly registered account. */
export function grantWelcomeTrial(user: UserProfile): UserProfile {
  const endsAt = new Date(Date.now() + TRIAL_DAYS * DAY_MS);
  return {
    ...user,
    subscriptionPlan: 'premium',
    registeredAt: new Date().toISOString(),
    trialPremiumEndsAt: endsAt.toISOString(),
    premiumUntil: endsAt.toISOString(),
    rewardPremiumEndsAt: endsAt.toLocaleDateString('ru-RU'),
    redeemedPromoCodes: user.redeemedPromoCodes || []
  };
}

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

// Always-available partner codes for Saint Petersburg athletes
const PARTNER_CODES: Record<string, { days: number; title: string }> = {
  'SPB-ZENIT-2026': { days: 14, title: 'Промо от ФК «Зенит»' },
  'SPB-BELIENOCHI': { days: 7, title: 'Марафон «Белые Ночи СПб»' },
  'SPB-PADEL-CLUB': { days: 10, title: 'Падел-клуб на Крестовском' },
  'SPORTBUDDY30': { days: 30, title: 'Приветственный бонус SportBuddy' }
};

export function redeemPromoCode(user: UserProfile, rawCode: string): RedeemResult {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: 'Введите промокод' };

  const alreadyUsed = user.redeemedPromoCodes || [];
  if (alreadyUsed.includes(code)) {
    return { ok: false, error: 'Этот промокод уже был активирован' };
  }

  // 1. Partner / marketing codes
  const partner = PARTNER_CODES[code];
  if (partner) {
    triggerHapticNotification('success');
    const updated = addPremiumDays(
      { ...user, redeemedPromoCodes: [...alreadyUsed, code] },
      partner.days
    );
    return { ok: true, days: partner.days, user: updated, title: partner.title };
  }

  // 2. Personal gift codes from boxes / medal streaks
  const promos = readPromos();
  const found = promos.find((p) => p.code === code);
  if (!found) {
    return { ok: false, error: 'Промокод не найден или введён с ошибкой' };
  }
  if (found.usedAt) {
    return { ok: false, error: 'Этот промокод уже использован' };
  }

  found.usedAt = new Date().toISOString();
  writePromos(promos);
  triggerHapticNotification('success');

  const updated = addPremiumDays(
    { ...user, redeemedPromoCodes: [...alreadyUsed, code] },
    found.days
  );
  return { ok: true, days: found.days, user: updated, title: found.title };
}
