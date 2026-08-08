import {
  UserProfile, VerificationState, VerificationStep,
  AVATAR_GRACE_PERIOD_HOURS
} from '../lib/types';
import { hasPersonalPhoto } from './profile';
import { triggerHapticNotification, launchMatchConfetti } from './native';
import { grantWelcomeTrial } from './promo';
import { updateProfile } from './repository';

const HOUR_MS = 60 * 60 * 1000;

/* ---------------------------------------------------------------------------
 * API base resolution (mirrors src/services/storage.ts).
 * Same-origin `/api` on the web (Vercel), production domain in Capacitor.
 * ------------------------------------------------------------------------- */

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

async function postJson(path: string, body: unknown): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      const err = new Error(String(payload?.error || res.status));
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }
    return payload || {};
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Verification must be completed within 24 hours after registration:
 *  1. personal avatar photo
 *  2. at least one photo published in the profile portfolio
 *  3. geolocation shared at least once (optional: unlocks the nearby radar)
 */
export function getVerificationState(user: UserProfile): VerificationState {
  const hasAvatar = hasPersonalPhoto(user);
  const hasPortfolio = (user.photoPortfolio?.length || 0) > 0;
  const hasGeo = !!user.hasUsedGeolocation;

  const steps: VerificationStep[] = [
    {
      id: 'avatar',
      label: 'Личная фотография',
      description: 'Загрузите реальное фото лица в профиль',
      icon: '📸',
      done: hasAvatar,
      required: true
    },
    {
      id: 'portfolio',
      label: 'Фото в портфолио',
      description: 'Опубликуйте минимум одно спортивное фото',
      icon: '🖼',
      done: hasPortfolio,
      required: true
    },
    {
      id: 'geo',
      label: 'Геолокация устройства',
      description: 'Разрешите доступ к GPS для поиска рядом',
      icon: '📍',
      done: hasGeo,
      required: false
    }
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const requiredSteps = steps.filter((s) => s.required !== false);
  const requiredCompletedCount = requiredSteps.filter((s) => s.done).length;
  // Only the Vercel server function can set isVerified authoritatively.
  const isVerified = user.isVerified === true;

  // Countdown from registration
  let hoursLeft = AVATAR_GRACE_PERIOD_HOURS;
  if (user.registeredAt) {
    const registered = new Date(user.registeredAt).getTime();
    if (!isNaN(registered)) {
      const remaining = registered + AVATAR_GRACE_PERIOD_HOURS * HOUR_MS - Date.now();
      hoursLeft = remaining <= 0 ? 0 : Math.max(1, Math.ceil(remaining / HOUR_MS));
    }
  }

  return {
    steps,
    isVerified,
    completedCount,
    requiredCount: requiredSteps.length,
    requiredCompletedCount,
    hoursLeft,
    expired: hoursLeft === 0 && !isVerified
  };
}

/**
 * Server-side verification via the Vercel function `api/verify-profile.js`.
 * The server validates avatar + portfolio, sets the trusted `isVerified`
 * flag and grants the 30-day welcome trial (only when no premium exists).
 * On any network failure the client grants the trial locally so the user is
 * never blocked (offline-first).
 */
export async function syncVerification(user: UserProfile): Promise<UserProfile> {
  const state = getVerificationState(user);
  const readyForReview = state.requiredCompletedCount === state.requiredCount;
  if (user.isVerified || !readyForReview) return user;

  try {
    const result = await postJson('/api/verify-profile', { userId: user.id });

    triggerHapticNotification('success');
    launchMatchConfetti();

    let verified: UserProfile = {
      ...user,
      isVerified: true,
      verifiedAt: String(result.verifiedAt || new Date().toISOString()),
      hasRealPhoto: true
    };

    // Apply the server-authoritative premium grant; fall back to local grant.
    const premiumUntil = result.premiumUntil ? String(result.premiumUntil) : undefined;
    if (premiumUntil) {
      verified = {
        ...verified,
        subscriptionPlan: 'premium',
        premiumUntil,
        trialPremiumEndsAt: premiumUntil,
        rewardPremiumEndsAt: premiumUntil
      };
    } else if (!user.premiumUntil) {
      verified = grantWelcomeTrial(verified);
    }

    await updateProfile({
      isVerified: true,
      verifiedAt: verified.verifiedAt,
      hasRealPhoto: true,
      ...(verified.premiumUntil
        ? {
            subscriptionPlan: verified.subscriptionPlan,
            premiumUntil: verified.premiumUntil,
            trialPremiumEndsAt: verified.trialPremiumEndsAt,
            rewardPremiumEndsAt: verified.rewardPremiumEndsAt
          }
        : {})
    }).catch(() => {
      /* offline-first: local state already updated */
    });

    return verified;
  } catch {
    // Offline or server unavailable: grant the trial locally so the user is
    // never blocked; the server will reconcile on the next successful sync.
    triggerHapticNotification('success');
    launchMatchConfetti();
    const fallback: UserProfile = user.premiumUntil
      ? { ...user, isVerified: true, verifiedAt: new Date().toISOString(), hasRealPhoto: true }
      : grantWelcomeTrial({ ...user, isVerified: true, verifiedAt: new Date().toISOString(), hasRealPhoto: true });
    return fallback;
  }
}

/**
 * Removes the current profile when its 24-hour verification window has
 * expired, via the Vercel function `api/delete-expired-profile.js`.
 * The Cloud Scheduler equivalent is no longer required.
 */
export async function deleteExpiredUnverifiedProfile(user: UserProfile): Promise<boolean> {
  const state = getVerificationState(user);
  if (state.isVerified || !state.expired) return false;
  try {
    const result = await postJson('/api/delete-expired-profile', { userId: user.id });
    return result.deleted === true;
  } catch {
    // Treat as deleted so the client never keeps an expired user around;
    // the server will clean up on a later call.
    return true;
  }
}

export function isVerified(user: UserProfile): boolean {
  return user.isVerified === true;
}
