import { UserProfile, LeaderboardEntry, LeaderboardMetric } from '../lib/types';
import { CURRENT_USER_ID } from './repository';

export interface MetricConfig {
  id: LeaderboardMetric;
  label: string;
  shortLabel: string;
  icon: string;
  unit: string;
  description: string;
}

export const LEADERBOARD_METRICS: MetricConfig[] = [
  {
    id: 'workouts',
    label: 'Тренировки',
    shortLabel: 'Трен.',
    icon: '🏋️',
    unit: 'трен.',
    description: 'Общее количество засчитанных тренировок'
  },
  {
    id: 'streak',
    label: 'Серия входов',
    shortLabel: 'Серия',
    icon: '🔥',
    unit: 'дн.',
    description: 'Засчитанные дни текущего цикла входов'
  },
  {
    id: 'boxes',
    label: 'SportBuddy BOX',
    shortLabel: 'BOX',
    icon: '🎁',
    unit: 'бокс.',
    description: 'Открытые призовые боксы за тренировки'
  },
  {
    id: 'medals',
    label: 'Всего медалей',
    shortLabel: 'Медали',
    icon: '🥇',
    unit: 'мед.',
    description: 'Все накопленные медали за ежедневный вход'
  }
];

export function getMetricValue(user: UserProfile, metric: LeaderboardMetric): number {
  switch (metric) {
    case 'workouts':
      return user.totalWorkouts || 0;
    case 'streak':
      return user.dailyMedalStreak || 0;
    case 'boxes':
      return (user.claimedBoxTiers || []).length;
    case 'medals':
      return user.totalDailyMedals || 0;
    default:
      return 0;
  }
}

/** Ranks every registered athlete by the chosen metric */
export function buildLeaderboard(
  allUsers: UserProfile[],
  metric: LeaderboardMetric
): LeaderboardEntry[] {
  return allUsers
    // Sample profiles never distort the real community rating
    .filter((u) => !u.isDemo && !(u.personalTrainer?.enabled && u.personalTrainer.status==='verified'))
    .sort((a, b) => {
      const diff = getMetricValue(b, metric) - getMetricValue(a, metric);
      if (diff !== 0) return diff;
      return (b.rating || 0) - (a.rating || 0);
    })
    .map((user, index) => ({
      rank: index + 1,
      user,
      value: getMetricValue(user, metric),
      isCurrentUser: user.id === CURRENT_USER_ID
    }));
}

export function getRankBadge(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

/** Total community stats shown above the table */
export function getCommunityStats(allUsers: UserProfile[]) {
  const real = allUsers.filter((u) => !u.isDemo && !(u.personalTrainer?.enabled && u.personalTrainer.status==='verified'));
  return {
    athletes: real.length,
    workouts: real.reduce((s, u) => s + (u.totalWorkouts || 0), 0),
    medals: real.reduce((s, u) => s + (u.totalDailyMedals || 0), 0),
    boxes: real.reduce((s, u) => s + (u.claimedBoxTiers || []).length, 0)
  };
}

export interface RankingEntry {
  rank: number;
  value: number;
  user: Pick<UserProfile, 'id' | 'name' | 'avatar' | 'locationName' | 'medalTier'>;
}
export interface RankingPage {
  needsPublicConsent?: boolean;
  metric: LeaderboardMetric;
  version: string;
  updatedAt: string;
  stats: {athletes: number; workouts: number; medals: number; boxes: number};
  entries: RankingEntry[];
  myEntry: RankingEntry | null;
  maxValue: number;
  top3Value: number | null;
  nextOffset: number | null;
}
export async function loadLeaderboard(metric: LeaderboardMetric, offset = 0, version?: string): Promise<RankingPage> {
  const uid = CURRENT_USER_ID;
  const { callServer } = await import('./serverApi');
  const page = await callServer<RankingPage>('/api/public-profiles', {action:'leaderboard', metric, offset, ...(version ? {version} : {})});
  if (CURRENT_USER_ID !== uid) throw new Error('Аккаунт изменился во время загрузки.');
  if (!page || page.metric !== metric || typeof page.version !== 'string' || !Array.isArray(page.entries)
    || !page.stats || !Number.isFinite(page.stats.athletes)
    || (page.nextOffset !== null && (!Number.isSafeInteger(page.nextOffset) || page.nextOffset <= offset)))
    throw new Error('Не удалось получить рейтинг. Повторите загрузку.');
  return page;
}
