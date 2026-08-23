import { UserProfile } from '../lib/types';

/**
 * Every SportBuddy78 account starts from zero.
 *
 * The app keeps progress in localStorage (medals, workout log, goals, chats,
 * ratings…). Without an explicit wipe a new user on a shared or previously
 * used device would inherit someone else's stats and pollute the leaderboard.
 */

/** All keys that hold user progress or cached content */
const PROGRESS_KEYS = [
  'sportbuddy_offline_cache_v1',
  'sportbuddy_offline_cache_v2',
  'sportbuddy_offline_cache_v3',
  'sportbuddy_offline_queue_v1',
  'sportbuddy_offline_queue_v2',
  'sportbuddy_offline_queue_v3',
  'sportbuddy_medals_v2',          // prefix — cleared by scan below
  'sportbuddy_workout_log_v1',
  'sportbuddy_workout_log_v2',
  'sportbuddy_goals_spb_v1',
  'sportbuddy_chats_spb_v1',
  'sportbuddy_ratings_spb_v1',
  'sportbuddy_checkins_spb_v1',
  'sportbuddy_friends_spb_v1',
  'sportbuddy_presence_v1',
  'sportbuddy_promo_codes_v1',
  'sportbuddy_reminders_v1',
  'sportbuddy_device_id_v1'
];

/** UI preferences that may safely survive a reset */
const KEEP_KEYS = [
  'sportbuddy_theme_v1',
  'sportbuddy_calendar_view_v1'
];

/**
 * Clears every trace of progress. Called when a brand-new account is created
 * so the athlete truly starts with a clean rating.
 */
export function resetLocalProgress(): void {
  try {
    const toRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sportbuddy_')) continue;
      if (KEEP_KEYS.includes(key)) continue;

      // Exact match or prefixed variants (e.g. medals are stored per user id)
      if (PROGRESS_KEYS.some((p) => key === p || key.startsWith(p))) {
        toRemove.push(key);
      }

      // Membership records are stored per account id.
      if (key.startsWith('sportbuddy_training_memberships_v1_')) {
        toRemove.push(key);
      }
      if (key.startsWith('sportbuddy_training_memberships_v2_')) {
        toRemove.push(key);
      }
    }

    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/**
 * Builds a profile with all counters at zero.
 * `overrides` carry the identity data from registration or VK ID.
 */
export function createFreshProfile(
  id: string,
  overrides: Partial<UserProfile> = {}
): UserProfile {
  return {
    id,
    name: 'Новый спортсмен',
    age: 25,
    gender: 'male',
    // Gender must be confirmed in the onboarding gate before the user enters.
    genderSet: false,
    avatar: '',
    bio: '',
    sports: [],
    locationName: 'Санкт-Петербург',
    lat: 59.9386,
    lng: 30.3141,

    // --- clean rating & progress ---
    rating: 0,
    ratingSum: 0,
    ratingCount: 0,
    totalWorkouts: 0,
    totalDailyMedals: 0,
    dailyMedalStreak: 0,
    medalTier: 'bronze',
    claimedBoxTiers: [],
    rewardItems: [],

    // --- social ---
    activeLooking: true,
    likedUserIds: [],
    matchIds: [],
    matchHistory: [],
    friendIds: [],
    friendRequestsSent: [],
    friendRequestsReceived: [],

    // --- account ---
    subscriptionPlan: 'free',
    registeredAt: new Date().toISOString(),
    isVerified: false,
    hasRealPhoto: false,
    photoPortfolio: [],
    redeemedPromoCodes: [],

    ...overrides
  };
}

/** True when the profile has never recorded any activity */
export function isFreshProfile(user: UserProfile): boolean {
  return (
    (user.totalWorkouts || 0) === 0 &&
    (user.totalDailyMedals || 0) === 0 &&
    (user.ratingCount || 0) === 0
  );
}
