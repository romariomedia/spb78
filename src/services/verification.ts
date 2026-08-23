import {
  UserProfile, VerificationState, VerificationStep,
  AVATAR_GRACE_PERIOD_HOURS
} from '../lib/types';
import { hasPersonalPhoto } from './profile';
import { triggerHapticNotification, launchMatchConfetti } from './native';
import { callServer } from './serverApi';

const HOUR_MS = 60 * 60 * 1000;

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
  if (user.isVerified || state.requiredCompletedCount !== state.requiredCount) return user;
  const result = await callServer<{ verifiedAt?:string; premiumUntil?:string }>('/api/verify-profile', {});
  const premiumUntil = result.premiumUntil ? String(result.premiumUntil) : user.premiumUntil;
  const verified: UserProfile = { ...user, isVerified:true, verifiedAt:String(result.verifiedAt || new Date().toISOString()), hasRealPhoto:true, ...(premiumUntil ? { subscriptionPlan:'premium', premiumUntil, trialPremiumEndsAt:premiumUntil, rewardPremiumEndsAt:premiumUntil } : {}) };
  triggerHapticNotification('success'); launchMatchConfetti(); return verified;
}

export async function deleteExpiredUnverifiedProfile(user: UserProfile): Promise<boolean> {
  const state = getVerificationState(user); if (state.isVerified || !state.expired) return false;
  const result = await callServer<{ deleted?:boolean }>('/api/delete-expired-profile', {}); return result.deleted === true;
}

export function isVerified(user: UserProfile): boolean { return user.isVerified === true; }
