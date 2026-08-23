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
    description: 'Медалей подряд без пропусков (24 ч)'
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
    description: 'Золотые медали за ежедневный вход'
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
    .filter((u) => !u.isDemo)
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
  const real = allUsers.filter((u) => !u.isDemo);
  return {
    athletes: real.length,
    workouts: real.reduce((s, u) => s + (u.totalWorkouts || 0), 0),
    medals: real.reduce((s, u) => s + (u.totalDailyMedals || 0), 0),
    boxes: real.reduce((s, u) => s + (u.claimedBoxTiers || []).length, 0)
  };
}
