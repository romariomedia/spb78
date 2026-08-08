import { UserProfile, Training } from '../lib/types';
import { updateProfile } from './repository';
import { triggerHapticNotification, triggerHapticImpact } from './native';
import { getMyCheckIn } from './checkin';
import { getTrainingDayKey, getTrainingStart, hasValidTrainingDate } from './schedule';

// v2 invalidates the legacy manual-credit journal. Only completed, verified
// trainings can appear in the new log.
const LOG_KEY = 'sportbuddy_workout_log_v2';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Credits can only come from a completed, verified training. */
export type CreditSource = 'participant-completion' | 'organizer-completion';

export interface WorkoutCredit {
  id: string;
  userId: string;
  /** Calendar day key YYYY-MM-DD — guarantees one credit per day */
  dayKey: string;
  timestamp: number;
  source: CreditSource;
  trainingId?: string;
  trainingTitle?: string;
  sport?: string;
}

/* -------------------------------- storage --------------------------------- */

function readLog(): WorkoutCredit[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as WorkoutCredit[]) : [];
  } catch {
    return [];
  }
}

function writeLog(list: WorkoutCredit[]): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

export function getDayKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* -------------------------------- queries --------------------------------- */

export function getCredits(userId: string): WorkoutCredit[] {
  return readLog()
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getTodayCredit(userId: string): WorkoutCredit | undefined {
  const today = getDayKey();
  return readLog().find((c) => c.userId === userId && c.dayKey === today);
}

export function isCreditedToday(userId: string): boolean {
  return !!getTodayCredit(userId);
}

/** Milliseconds until the next credit becomes available (next local midnight) */
export function msUntilNextCredit(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function formatCooldown(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

/** Consecutive days with a credited workout (ending today or yesterday) */
export function getWorkoutStreak(userId: string): number {
  const keys = new Set(getCredits(userId).map((c) => c.dayKey));
  if (keys.size === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  // Allow the streak to be "alive" if yesterday was credited but today not yet
  if (!keys.has(getDayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!keys.has(getDayKey(cursor.getTime()))) return 0;
  }
  while (keys.has(getDayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Credits for the last 7 days — used by the weekly strip in the profile */
export function getWeekMap(userId: string): { dayKey: string; label: string; done: boolean }[] {
  const keys = new Set(getCredits(userId).map((c) => c.dayKey));
  const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const out: { dayKey: string; label: string; done: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = getDayKey(d.getTime());
    out.push({ dayKey: key, label: labels[d.getDay()] ?? '', done: keys.has(key) });
  }
  return out;
}

export function getMonthCount(userId: string): number {
  const since = Date.now() - 30 * DAY_MS;
  return getCredits(userId).filter((c) => c.timestamp >= since).length;
}

/* -------------------------------- mutation --------------------------------- */

export interface CreditResult {
  ok: boolean;
  reason?:
    | 'already-credited'
    | 'duplicate-training'
    | 'training-not-completed'
    | 'missing-training-date'
    | 'not-training-day'
    | 'not-registered'
    | 'not-checked-in'
    | 'not-organizer'
    | 'training-not-started';
  user: UserProfile;
  total: number;
  cooldownMs?: number;
  credit?: WorkoutCredit;
}

/**
 * Anti-fraud rule:
 * - exactly ONE workout per calendar day counts toward progress;
 * - a participant must have registered, GPS-checked in and completed the
 *   post-training organizer survey;
 * - a creator earns credit only after completing their own training;
 * - the credit can only be issued on the training's scheduled calendar day.
 */
export async function creditWorkout(
  user: UserProfile,
  source: CreditSource,
  training: Training
): Promise<CreditResult> {
  const log = readLog();
  const today = getDayKey();

  if (!hasValidTrainingDate(training)) {
    return { ok: false, reason: 'missing-training-date', user, total: user.totalWorkouts };
  }

  // A training cannot be used to backfill arbitrary days or farm credits.
  if (getTrainingDayKey(training) !== today) {
    return { ok: false, reason: 'not-training-day', user, total: user.totalWorkouts };
  }

  if (!training.isCompleted) {
    return { ok: false, reason: 'training-not-completed', user, total: user.totalWorkouts };
  }

  if (source === 'organizer-completion') {
    if (training.createdBy !== user.id) {
      return { ok: false, reason: 'not-organizer', user, total: user.totalWorkouts };
    }
    if (getTrainingStart(training).getTime() > Date.now()) {
      return { ok: false, reason: 'training-not-started', user, total: user.totalWorkouts };
    }
  } else {
    if (!training.participantIds.includes(user.id) || training.createdBy === user.id) {
      return { ok: false, reason: 'not-registered', user, total: user.totalWorkouts };
    }
    const checkIn = getMyCheckIn(training.id, user.id);
    if (!checkIn?.verified) {
      return { ok: false, reason: 'not-checked-in', user, total: user.totalWorkouts };
    }
  }

  // Already credited today → reject
  const existing = log.find((c) => c.userId === user.id && c.dayKey === today);
  if (existing) {
    triggerHapticNotification('warning');
    return {
      ok: false,
      reason: 'already-credited',
      user,
      total: user.totalWorkouts,
      cooldownMs: msUntilNextCredit(),
      credit: existing
    };
  }

  // The same training can never be credited twice.
  if (log.some((c) => c.userId === user.id && c.trainingId === training.id)) {
    triggerHapticNotification('warning');
    return { ok: false, reason: 'duplicate-training', user, total: user.totalWorkouts };
  }

  const timestamp = Date.now();
  const credit: WorkoutCredit = {
    id: `wc_${user.id}_${today}`,
    userId: user.id,
    dayKey: today,
    timestamp,
    source,
    trainingId: training.id,
    trainingTitle: training.title,
    sport: training.sport
  };

  writeLog([credit, ...log]);

  const total = user.totalWorkouts + 1;
  const updated: UserProfile = { ...user, totalWorkouts: total };
  await updateProfile({ totalWorkouts: total });

  triggerHapticImpact('medium');
  triggerHapticNotification('success');
  return { ok: true, user: updated, total, credit };
}

/** Human-readable explanation shown in the UI */
export const DAILY_LIMIT_NOTE =
  'В прогресс засчитывается одна тренировка в сутки и только после завершения: ' +
  'участник должен быть записан, отметиться на месте по GPS и оценить организатора. ' +
  'Создателю засчитывается проведённая им тренировка в день события.';
