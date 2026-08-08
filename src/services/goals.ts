import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PersonalGoal, GoalType, GoalPeriod, GoalProgressEntry, UserProfile } from '../lib/types';
import { triggerHapticImpact, triggerHapticNotification } from './native';
import { launchMatchConfetti } from './native';

const GOALS_KEY = 'sportbuddy_goals_spb_v1';
const DAY_MS = 24 * 60 * 60 * 1000;

function backgroundWrite(action: () => Promise<unknown>): void {
  try {
    void Promise.race([
      action(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500))
    ]).catch(() => {});
  } catch {
    /* ignore */
  }
}

function readAll(): PersonalGoal[] {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    return raw ? (JSON.parse(raw) as PersonalGoal[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: PersonalGoal[]): void {
  try {
    localStorage.setItem(GOALS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/* -------------------------------- templates -------------------------------- */

export interface GoalTemplate {
  type: GoalType;
  title: string;
  icon: string;
  unit: string;
  defaultTarget: number;
  hint: string;
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  { type: 'workouts', title: 'Количество тренировок', icon: '🏋️', unit: 'трен.', defaultTarget: 12, hint: 'Регулярность — основа прогресса' },
  { type: 'distance', title: 'Пробежать дистанцию', icon: '🏃', unit: 'км', defaultTarget: 100, hint: 'Набережные Невы ждут вас' },
  { type: 'streak',   title: 'Серия входов подряд', icon: '🔥', unit: 'дн.', defaultTarget: 30, hint: 'Заходите каждый день за медалью' },
  { type: 'weight',   title: 'Изменить вес', icon: '⚖️', unit: 'кг', defaultTarget: 5, hint: 'Спорт + питание = результат' },
  { type: 'custom',   title: 'Своя цель', icon: '🎯', unit: 'ед.', defaultTarget: 10, hint: 'Опишите собственный вызов' }
];

export const GOAL_PERIODS: { id: GoalPeriod; label: string; days: number }[] = [
  { id: 'week',    label: 'Неделя',  days: 7 },
  { id: 'month',   label: 'Месяц',   days: 30 },
  { id: 'quarter', label: '3 месяца', days: 90 },
  { id: 'year',    label: 'Год',     days: 365 }
];

/* --------------------------------- queries --------------------------------- */

export function getGoals(ownerId: string): PersonalGoal[] {
  return readAll()
    .filter((g) => g.ownerId === ownerId)
    .sort((a, b) => (a.completedAt ? 1 : 0) - (b.completedAt ? 1 : 0));
}

export function getActiveGoals(ownerId: string): PersonalGoal[] {
  return getGoals(ownerId).filter((g) => !g.completedAt);
}

export function goalProgress(goal: PersonalGoal): number {
  if (goal.targetValue <= 0) return 0;
  return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
}

export function daysLeft(goal: PersonalGoal): number {
  const diff = new Date(goal.deadline).getTime() - Date.now();
  return diff <= 0 ? 0 : Math.ceil(diff / DAY_MS);
}

/** Pace needed per day to still hit the target in time */
export function requiredPace(goal: PersonalGoal): number {
  const left = daysLeft(goal);
  const remaining = Math.max(0, goal.targetValue - goal.currentValue);
  if (left <= 0) return remaining;
  return Number((remaining / left).toFixed(2));
}

export function isOnTrack(goal: PersonalGoal): boolean {
  const total = GOAL_PERIODS.find((p) => p.id === goal.period)?.days ?? 30;
  const elapsed = total - daysLeft(goal);
  if (elapsed <= 0) return true;
  const expected = (goal.targetValue / total) * elapsed;
  return goal.currentValue >= expected;
}

export function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

/* --------------------------------- actions --------------------------------- */

export function createGoal(
  owner: UserProfile,
  type: GoalType,
  title: string,
  targetValue: number,
  unit: string,
  period: GoalPeriod,
  sport?: string
): PersonalGoal {
  triggerHapticNotification('success');
  const days = GOAL_PERIODS.find((p) => p.id === period)?.days ?? 30;
  const now = Date.now();

  const goal: PersonalGoal = {
    id: `goal_${now}`,
    ownerId: owner.id,
    type,
    title,
    targetValue,
    currentValue: 0,
    unit,
    period,
    sport,
    createdAt: new Date(now).toISOString(),
    deadline: new Date(now + days * DAY_MS).toISOString(),
    history: []
  };

  writeAll([goal, ...readAll()]);
  backgroundWrite(() => setDoc(doc(db, 'goals', goal.id), goal));
  return goal;
}

export interface AddProgressResult {
  goal: PersonalGoal;
  justCompleted: boolean;
}

export function addProgress(goalId: string, value: number, note?: string): AddProgressResult | null {
  triggerHapticImpact('medium');
  const all = readAll();
  const goal = all.find((g) => g.id === goalId);
  if (!goal) return null;

  const timestamp = Date.now();
  const entry: GoalProgressEntry = {
    id: `gp_${timestamp}`,
    value,
    note: note?.trim() || undefined,
    date: new Date(timestamp).toLocaleDateString('ru-RU'),
    timestamp
  };

  const wasCompleted = !!goal.completedAt;
  goal.currentValue = Math.max(0, Number((goal.currentValue + value).toFixed(2)));
  goal.history = [entry, ...goal.history];

  const justCompleted = !wasCompleted && goal.currentValue >= goal.targetValue;
  if (justCompleted) {
    goal.completedAt = new Date(timestamp).toISOString();
    launchMatchConfetti();
  }

  writeAll(all);
  backgroundWrite(() => setDoc(doc(db, 'goals', goal.id), goal));
  return { goal, justCompleted };
}

export function deleteGoal(goalId: string): void {
  triggerHapticImpact('light');
  writeAll(readAll().filter((g) => g.id !== goalId));
}

/** Aggregated stats shown at the top of "Моя цель" */
export function getGoalStats(ownerId: string) {
  const goals = getGoals(ownerId);
  const completed = goals.filter((g) => g.completedAt);
  const active = goals.filter((g) => !g.completedAt);
  const avgProgress = active.length
    ? Math.round(active.reduce((s, g) => s + goalProgress(g), 0) / active.length)
    : 0;
  const totalEntries = goals.reduce((s, g) => s + g.history.length, 0);
  return {
    total: goals.length,
    completed: completed.length,
    active: active.length,
    avgProgress,
    totalEntries
  };
}
