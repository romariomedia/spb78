import { Training } from '../lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_KEY = 'sportbuddy_reminders_v1';

/* ------------------------------- date helpers ------------------------------ */

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
}

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
export const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

/** Monday-first weekday index (0 = Monday) */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDayKey(a) === toDayKey(b);
}

export function isToday(key: string): boolean {
  return key === toDayKey(new Date());
}

export function isPastDay(key: string): boolean {
  return fromDayKey(key).getTime() < new Date(toDayKey(new Date())).getTime();
}

export function formatDayLabel(key: string): string {
  const d = fromDayKey(key);
  const today = toDayKey(new Date());
  const tomorrow = toDayKey(new Date(Date.now() + DAY_MS));
  if (key === today) return 'Сегодня';
  if (key === tomorrow) return 'Завтра';
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

export function formatFullDate(key: string): string {
  const d = fromDayKey(key);
  return `${WEEKDAYS_SHORT[mondayIndex(d)]}, ${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

/** Builds a 6x7 grid for the month containing `anchor` */
export function buildMonthGrid(anchor: Date): { key: string; inMonth: boolean }[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - mondayIndex(first));

  const cells: { key: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ key: toDayKey(d), inMonth: d.getMonth() === anchor.getMonth() });
  }
  return cells;
}

/* ------------------------- training scheduling ---------------------------- */

/**
 * Trainings store `dateKey` (yyyy-mm-dd) + `time` (HH:mm).
 * Legacy records only have a human `dateLabel`, so we fall back gracefully.
 */
export function getTrainingDayKey(t: Training): string {
  if (t.dateKey) return t.dateKey;
  // Legacy fallback: treat as today so nothing disappears from the list
  return toDayKey(new Date());
}

/** Credits and check-ins require a real yyyy-mm-dd date, never a display label. */
export function hasValidTrainingDate(t: Training): boolean {
  return Boolean(t.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(t.dateKey));
}

export function getTrainingStart(t: Training): Date {
  const key = getTrainingDayKey(t);
  const [h, m] = (t.time || '00:00').split(':').map(Number);
  const d = fromDayKey(key);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

export function msUntilStart(t: Training): number {
  return getTrainingStart(t).getTime() - Date.now();
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  started: boolean;
  soon: boolean; // less than 2 hours
}

export function getCountdown(t: Training): Countdown {
  const total = msUntilStart(t);
  const abs = Math.max(0, total);
  return {
    days: Math.floor(abs / DAY_MS),
    hours: Math.floor((abs % DAY_MS) / 3_600_000),
    minutes: Math.floor((abs % 3_600_000) / 60_000),
    seconds: Math.floor((abs % 60_000) / 1000),
    total,
    started: total <= 0,
    soon: total > 0 && total <= 2 * 3_600_000
  };
}

export function formatCountdown(c: Countdown): string {
  if (c.started) return 'Уже началась';
  if (c.days > 0) return `${c.days} д ${c.hours} ч`;
  if (c.hours > 0) return `${c.hours} ч ${c.minutes} мин`;
  return `${c.minutes} мин ${c.seconds} с`;
}

/** Upcoming trainings the user signed up for, nearest first */
export function getMyUpcoming(trainings: Training[], userId: string): Training[] {
  return trainings
    .filter((t) => t.participantIds.includes(userId) && !t.isCompleted)
    .filter((t) => msUntilStart(t) > -3 * 3_600_000) // keep 3h after start
    .sort((a, b) => msUntilStart(a) - msUntilStart(b));
}

/** Count of trainings per day — used for calendar dots */
export function countByDay(trainings: Training[]): Record<string, number> {
  const map: Record<string, number> = {};
  trainings.forEach((t) => {
    const key = getTrainingDayKey(t);
    map[key] = (map[key] || 0) + 1;
  });
  return map;
}

/* ---------------------------- 2h reminders -------------------------------- */

function readSent(): string[] {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeSent(ids: string[]): void {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(ids.slice(-100)));
  } catch {
    /* ignore */
  }
}

export function wasReminderSent(trainingId: string): boolean {
  return readSent().includes(trainingId);
}

export function markReminderSent(trainingId: string): void {
  const sent = readSent();
  if (!sent.includes(trainingId)) writeSent([...sent, trainingId]);
}

/** Trainings entering the 2-hour window that still need a reminder */
export function getDueReminders(trainings: Training[], userId: string): Training[] {
  return getMyUpcoming(trainings, userId).filter((t) => {
    const ms = msUntilStart(t);
    return ms > 0 && ms <= 2 * 3_600_000 && !wasReminderSent(t.id);
  });
}
