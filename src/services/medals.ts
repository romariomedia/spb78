import {
  MedalTier, MedalProgress, DEFAULT_MEDAL_PROGRESS, MEDAL_TIERS,
  nextTier, previousTier
} from '../lib/medals';
import { UserProfile, PromoCode } from '../lib/types';
import { getDayKey, getCredits } from './workoutLog';
import { generatePromoCode } from './promo';
import { updateProfile } from './repository';
import { triggerHapticNotification, launchMatchConfetti } from './native';

const MEDALS_KEY = 'sportbuddy_medals_v2';
const DAY_MS = 24 * 60 * 60 * 1000;

/* -------------------------------- storage --------------------------------- */

function readProgress(userId: string): MedalProgress {
  try {
    const raw = localStorage.getItem(`${MEDALS_KEY}_${userId}`);
    if (!raw) return { ...DEFAULT_MEDAL_PROGRESS };
    return { ...DEFAULT_MEDAL_PROGRESS, ...(JSON.parse(raw) as Partial<MedalProgress>) };
  } catch {
    return { ...DEFAULT_MEDAL_PROGRESS };
  }
}

function writeProgress(userId: string, progress: MedalProgress): void {
  try {
    localStorage.setItem(`${MEDALS_KEY}_${userId}`, JSON.stringify(progress));
  } catch {
    /* ignore quota */
  }
}

/* ------------------------------- date helpers ------------------------------ */

function dayKeyOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getDayKey(d.getTime());
}

/** Workouts credited within the current cycle window */
function countCycleWorkouts(userId: string, cycleDays: number): number {
  if (cycleDays <= 0) return 0;
  const since = Date.now() - cycleDays * DAY_MS;
  return getCredits(userId).filter((c) => c.timestamp >= since).length;
}

/* ------------------------------ streak checking ---------------------------- */

export interface StreakCheck {
  progress: MedalProgress;
  burned: boolean;
  demotedFrom?: MedalTier;
  demotedTo?: MedalTier;
}

/**
 * Missing a day burns the current cycle.
 * Gold → Silver → Bronze; on Bronze the cycle simply restarts.
 */
export function verifyStreak(userId: string): StreakCheck {
  const progress = readProgress(userId);
  const today = getDayKey();
  const yesterday = dayKeyOffset(1);

  // Never claimed or already claimed today / yesterday → streak alive
  if (!progress.lastClaimDayKey) return { progress, burned: false };
  if (progress.lastClaimDayKey === today || progress.lastClaimDayKey === yesterday) {
    return { progress, burned: false };
  }

  // More than 24h without a login → burn
  const demotedFrom = progress.tier;
  const lower = previousTier(progress.tier);
  const burned: MedalProgress = {
    ...progress,
    tier: lower ?? 'bronze',
    cycleDays: 0,
    cycleWorkouts: 0
  };
  writeProgress(userId, burned);
  triggerHapticNotification('warning');

  return {
    progress: burned,
    burned: true,
    demotedFrom,
    demotedTo: burned.tier
  };
}

/* --------------------------------- queries --------------------------------- */

export function getProgress(userId: string): MedalProgress {
  const checked = verifyStreak(userId);
  const p = checked.progress;
  // Keep the workout counter in sync with the credited log
  const synced = { ...p, cycleWorkouts: countCycleWorkouts(userId, p.cycleDays) };
  return synced;
}

export function canClaimToday(userId: string): boolean {
  return readProgress(userId).lastClaimDayKey !== getDayKey();
}

export function totalMedals(progress: MedalProgress): number {
  return progress.totals.bronze + progress.totals.silver + progress.totals.gold;
}

/** Requirements met for the current cycle? */
export function isCycleComplete(progress: MedalProgress): boolean {
  const cfg = MEDAL_TIERS[progress.tier];
  return progress.cycleDays >= cfg.daysRequired && progress.cycleWorkouts >= cfg.workoutsRequired;
}

export function msUntilBurn(progress: MedalProgress): number {
  if (!progress.lastClaimTimestamp) return DAY_MS;
  const deadline = progress.lastClaimTimestamp + 2 * DAY_MS; // end of the following day
  return Math.max(0, deadline - Date.now());
}

/* --------------------------------- claiming -------------------------------- */

export interface ClaimResult {
  ok: boolean;
  progress: MedalProgress;
  tierEarned?: MedalTier;
  cycleCompleted: boolean;
  promoted: boolean;
  newTier?: MedalTier;
  promo?: PromoCode;
  message: string;
  blockedReason?: string;
}

/**
 * Claims the daily medal of the current tier.
 * On completing a cycle the user gets a promo code and (if requirements are met)
 * is promoted to the next tier.
 */
export async function claimDailyMedal(user: UserProfile): Promise<ClaimResult> {
  const checked = verifyStreak(user.id);
  let progress = { ...checked.progress };
  const today = getDayKey();

  if (progress.lastClaimDayKey === today) {
    return {
      ok: false,
      progress,
      cycleCompleted: false,
      promoted: false,
      message: 'Медаль за сегодня уже получена. Возвращайтесь завтра!',
      blockedReason: 'already-claimed'
    };
  }

  const tier = progress.tier;
  const cfg = MEDAL_TIERS[tier];

  // 1. Award the medal for today
  progress.cycleDays += 1;
  progress.totals = { ...progress.totals, [tier]: progress.totals[tier] + 1 };
  progress.lastClaimDayKey = today;
  progress.lastClaimTimestamp = Date.now();
  progress.cycleWorkouts = countCycleWorkouts(user.id, progress.cycleDays);
  if (progress.cycleWorkouts > 0) progress.hasWorkoutEver = true;

  let promo: PromoCode | undefined;
  let promoted = false;
  let newTier: MedalTier | undefined;
  let cycleCompleted = false;
  let message = `${cfg.emoji} Медаль «${cfg.name}» получена! День ${progress.cycleDays} из ${cfg.daysRequired}.`;

  // 2. Cycle complete?
  const daysDone = progress.cycleDays >= cfg.daysRequired;
  const workoutsDone = progress.cycleWorkouts >= cfg.workoutsRequired;

  if (daysDone && workoutsDone) {
    cycleCompleted = true;
    progress.cyclesCompleted = {
      ...progress.cyclesCompleted,
      [tier]: progress.cyclesCompleted[tier] + 1
    };
    promo = generatePromoCode(
      'streak',
      cfg.rewardDays,
      user.id,
      `Цикл «${cfg.name}» — ${cfg.daysRequired} дней подряд`
    );

    // 3. Promotion rules
    const up = nextTier(tier);
    if (up === 'silver' && progress.hasWorkoutEver) {
      promoted = true;
      newTier = 'silver';
    } else if (up === 'gold') {
      promoted = true;
      newTier = 'gold';
    }

    progress.tier = newTier ?? tier;
    progress.cycleDays = 0;
    progress.cycleWorkouts = 0;

    launchMatchConfetti();
    message = promoted && newTier
      ? `🎉 Цикл «${cfg.name}» завершён! Промокод на ${cfg.rewardDays} дней Premium и переход на уровень «${MEDAL_TIERS[newTier].name}» ${MEDAL_TIERS[newTier].emoji}`
      : `🎉 Цикл «${cfg.name}» завершён! Вы получили промокод на ${cfg.rewardDays} дней Premium.`;
  } else if (daysDone && !workoutsDone) {
    const missing = cfg.workoutsRequired - progress.cycleWorkouts;
    message = `${cfg.emoji} Медаль получена! Для награды нужно ещё ${missing} трен. в этом цикле.`;
  }

  writeProgress(user.id, progress);
  triggerHapticNotification('success');

  // Mirror aggregates onto the profile (leaderboard + legacy fields)
  const total = totalMedals(progress);
  await updateProfile({
    totalDailyMedals: total,
    dailyMedalStreak: progress.cycleDays,
    medalTier: progress.tier,
    lastClaimedDate: today,
    lastLoginTimestamp: Date.now()
  });

  return { ok: true, progress, tierEarned: tier, cycleCompleted, promoted, newTier, promo, message };
}

/** Syncs profile fields so the leaderboard stays accurate without claiming */
export function syncProfileMedals(user: UserProfile): UserProfile {
  const progress = getProgress(user.id);
  return {
    ...user,
    totalDailyMedals: totalMedals(progress),
    dailyMedalStreak: progress.cycleDays,
    medalTier: progress.tier
  };
}

