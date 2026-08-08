export type MedalTier = 'bronze' | 'silver' | 'gold';

export interface MedalTierConfig {
  id: MedalTier;
  name: string;
  emoji: string;
  /** Consecutive login days required to complete a cycle */
  daysRequired: number;
  /** Credited workouts required inside the same cycle */
  workoutsRequired: number;
  /** Premium days granted by the reward promo code */
  rewardDays: number;
  accent: string;   // HEX for progress bars / glows
  gradient: string; // tailwind gradient classes
  border: string;
  text: string;
  description: string;
  nextHint: string;
}

export const MEDAL_TIERS: Record<MedalTier, MedalTierConfig> = {
  bronze: {
    id: 'bronze',
    name: 'Бронза',
    emoji: '🥉',
    daysRequired: 7,
    workoutsRequired: 0,
    rewardDays: 5,
    accent: '#d97706',
    gradient: 'from-amber-700 to-orange-600',
    border: 'border-amber-600/60',
    text: 'text-amber-500',
    description: 'Заходите в приложение 7 дней подряд',
    nextHint: 'Выполните тренировку, чтобы перейти на Серебро'
  },
  silver: {
    id: 'silver',
    name: 'Серебро',
    emoji: '🥈',
    daysRequired: 7,
    workoutsRequired: 3,
    rewardDays: 7,
    accent: '#94a3b8',
    gradient: 'from-slate-400 to-slate-500',
    border: 'border-slate-400/60',
    text: 'text-slate-300',
    description: '7 дней подряд + 3 тренировки',
    nextHint: 'Завершите цикл, чтобы открыть Золото'
  },
  gold: {
    id: 'gold',
    name: 'Золото',
    emoji: '🥇',
    daysRequired: 7,
    workoutsRequired: 5,
    rewardDays: 30,
    accent: '#fbbf24',
    gradient: 'from-amber-400 to-yellow-500',
    border: 'border-amber-400/70',
    text: 'text-amber-400',
    description: '7 дней подряд + 5 тренировок',
    nextHint: 'Высший уровень — держите серию!'
  }
};

export const TIER_ORDER: MedalTier[] = ['bronze', 'silver', 'gold'];

export function nextTier(tier: MedalTier): MedalTier | null {
  const i = TIER_ORDER.indexOf(tier);
  return i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1]! : null;
}

export function previousTier(tier: MedalTier): MedalTier | null {
  const i = TIER_ORDER.indexOf(tier);
  return i > 0 ? TIER_ORDER[i - 1]! : null;
}

/** Persistent medal progress stored per account */
export interface MedalProgress {
  tier: MedalTier;
  /** Consecutive login days inside the current cycle (0..7) */
  cycleDays: number;
  /** Credited workouts inside the current cycle */
  cycleWorkouts: number;
  /** Total medals earned per tier (lifetime) */
  totals: Record<MedalTier, number>;
  /** Completed cycles per tier */
  cyclesCompleted: Record<MedalTier, number>;
  lastClaimDayKey: string | null;
  lastClaimTimestamp: number | null;
  /** True once the user did at least one workout — unlocks silver track */
  hasWorkoutEver: boolean;
}

export const DEFAULT_MEDAL_PROGRESS: MedalProgress = {
  tier: 'bronze',
  cycleDays: 0,
  cycleWorkouts: 0,
  totals: { bronze: 0, silver: 0, gold: 0 },
  cyclesCompleted: { bronze: 0, silver: 0, gold: 0 },
  lastClaimDayKey: null,
  lastClaimTimestamp: null,
  hasWorkoutEver: false
};
