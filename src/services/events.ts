import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  OfficialEvent, EventCategory, EventStatus, UserProfile,
  ADMIN_EMAIL, EVENT_MIN_PARTICIPANTS, EVENT_MAX_PARTICIPANTS
} from '../lib/types';
import { getSessionAccount } from './auth';
import { triggerHapticImpact, triggerHapticNotification } from './native';
import { hasAdminSession, getAdminSession, adminMutateEvent } from './adminAuth';

const EVENTS_KEY = 'sportbuddy_official_events_v1';
const WRITE_TIMEOUT_MS = 3500;

function backgroundWrite(action: () => Promise<unknown>): void {
  try {
    void Promise.race([
      action(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), WRITE_TIMEOUT_MS))
    ]).catch(() => {});
  } catch {
    /* ignore */
  }
}

/* --------------------------------- access ---------------------------------- */

/** E-mail identifies the only person allowed to request an admin OTP. */
export function isAdminEmail(user?: UserProfile | null): boolean {
  const session = getSessionAccount();
  const email = (session?.email || user?.email || '').trim().toLowerCase();
  return email === ADMIN_EMAIL.toLowerCase();
}

/**
 * Admin identity no longer relies on the Firebase Auth e-mail claim: the
 * admin signs in with VK ID like everyone else and proves ownership via
 * e-mail + password + OTP, which yields a server-verified OTP session.
 */
export function isAdmin(_user?: UserProfile | null): boolean {
  return hasAdminSession();
}

export function getAdminEmail(): string {
  return ADMIN_EMAIL;
}

function requireAdminSession(): void {
  if (!hasAdminSession()) {
    throw new Error('admin-otp-required');
  }
}

/* --------------------------------- storage --------------------------------- */

function readAll(): OfficialEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw) return JSON.parse(raw) as OfficialEvent[];
  } catch {
    /* fallthrough to seed */
  }
  const seeded = SEED_EVENTS;
  writeAll(seeded);
  return seeded;
}

function writeAll(list: OfficialEvent[]): void {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

/* ------------------------------- seed content ------------------------------- */

const SEED_EVENTS: OfficialEvent[] = [
  {
    id: 'evt-spb-001',
    title: 'Кубок SportBuddy СПб по Падел 2х2',
    category: 'competition',
    sport: 'Падел',
    tagline: 'Первый официальный турнир платформы',
    description:
      'Официальный парный турнир по Падел от команды SportBuddy. Сетка на выбывание, ' +
      'призовой фонд и фирменная экипировка победителям. Регистрация парами и соло — ' +
      'напарника подберём автоматически по рейтингу.',
    coverUrl: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&q=80&w=1200',
    locationName: 'Падел-клуб на Крестовском',
    address: 'Футбольная аллея, 8, Санкт-Петербург',
    lat: 59.9715,
    lng: 30.2245,
    dateLabel: 'Суббота, 16 августа',
    time: '11:00',
    participantsMax: 32,
    participantIds: ['user-anna', 'user-ekatery', 'user-veronika'],
    prizePool: '50 000 ₽ + экипировка',
    entryFee: 'Бесплатно для Premium',
    status: 'published',
    createdBy: 'admin',
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    isOfficial: true
  },
  {
    id: 'evt-spb-002',
    title: 'Открытый чемпионат СПб по Воркауту',
    category: 'competition',
    sport: 'Воркаут',
    tagline: 'Уличная гимнастика на турниках и брусьях',
    description:
      'Официальный чемпионат по воркауту от SportBuddy. Три дисциплины: ' +
      'силовой сет на количество (подтягивания, отжимания на брусьях, выход силой), ' +
      'фристайл-программа на турнике 60 секунд и статика (флаг, горизонт, передний вис). ' +
      'Судейство по 10-балльной шкале, две категории — новички и профи. ' +
      'Снаряды: турники, брусья и земля. Форма свободная, магнезия разрешена.',
    coverUrl: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&q=80&w=1200',
    locationName: 'Воркаут-площадка Новая Голландия',
    address: 'наб. Адмиралтейского канала, 2, Санкт-Петербург',
    lat: 59.9295,
    lng: 30.2905,
    dateLabel: 'Суббота, 23 августа',
    time: '13:00',
    participantsMax: 60,
    participantIds: ['user-daria', 'user-elena', 'user-veronika'],
    prizePool: '40 000 ₽ + спортивная экипировка от партнёров',
    entryFee: 'Бесплатно для Premium',
    status: 'published',
    createdBy: 'admin',
    createdAt: new Date(Date.now() - 3600000 * 50).toISOString(),
    isOfficial: true
  },
  {
    id: 'evt-spb-003',
    title: 'Конкурс «Лучшее спортивное фото Петербурга»',
    category: 'contest',
    sport: 'Общее',
    tagline: 'Публикуйте фото в ленте — выигрывайте призы',
    description:
      'Публикуйте снимки с тренировок в ленте SportBuddy с тегом города. ' +
      'Три работы с наибольшим числом лайков получают SportBuddy BOX 3 и год Premium.',
    coverUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&q=80&w=1200',
    locationName: 'Онлайн • вся территория СПб',
    address: 'Санкт-Петербург',
    lat: 59.9386,
    lng: 30.3141,
    dateLabel: 'До 31 августа',
    time: '23:59',
    participantsMax: 100,
    participantIds: ['user-maria'],
    prizePool: 'Год Premium + SportBuddy BOX 3',
    entryFee: 'Бесплатно',
    status: 'published',
    createdBy: 'admin',
    createdAt: new Date(Date.now() - 3600000 * 70).toISOString(),
    isOfficial: true
  }
];

/* --------------------------------- queries --------------------------------- */

export function getEvents(includeeDrafts = false): OfficialEvent[] {
  return readAll()
    .filter((e) => (includeeDrafts ? true : e.status === 'published'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getEventById(id: string): OfficialEvent | undefined {
  return readAll().find((e) => e.id === id);
}

export function isRegistered(event: OfficialEvent, userId: string): boolean {
  return event.participantIds.includes(userId);
}

export function eventFillPercent(event: OfficialEvent): number {
  return Math.min(100, Math.round((event.participantIds.length / event.participantsMax) * 100));
}

export function getCategoryConfig(category: EventCategory) {
  const map: Record<EventCategory, { label: string; icon: string; color: string }> = {
    competition: { label: 'Соревнование', icon: '🏆', color: 'amber' },
    contest:     { label: 'Конкурс',      icon: '🎯', color: 'emerald' },
    festival:    { label: 'Фестиваль',    icon: '🎉', color: 'purple' },
    masterclass: { label: 'Мастер-класс', icon: '🎓', color: 'sky' },
    charity:     { label: 'Благотворительность', icon: '❤️', color: 'rose' }
  };
  return map[category];
}

/* --------------------------------- mutations -------------------------------- */

export interface EventDraft {
  title: string;
  category: EventCategory;
  sport: string;
  tagline: string;
  description: string;
  coverUrl?: string;
  videoUrl?: string;
  locationName: string;
  address: string;
  lat: number;
  lng: number;
  dateLabel: string;
  time: string;
  participantsMax: number;
  prizePool?: string;
  entryFee?: string;
  status: EventStatus;
}

export function validateEventDraft(draft: EventDraft): string | null {
  if (draft.title.trim().length < 5) return 'Название должно содержать минимум 5 символов';
  if (draft.tagline.trim().length < 5) return 'Добавьте короткий слоган мероприятия';
  if (draft.description.trim().length < 20) return 'Описание должно содержать минимум 20 символов';
  if (draft.participantsMax < EVENT_MIN_PARTICIPANTS || draft.participantsMax > EVENT_MAX_PARTICIPANTS) {
    return `Количество участников — от ${EVENT_MIN_PARTICIPANTS} до ${EVENT_MAX_PARTICIPANTS}`;
  }
  return null;
}

export function createEvent(draft: EventDraft, adminId: string): OfficialEvent {
  requireAdminSession();
  triggerHapticNotification('success');
  const id = `evt-${Date.now()}`;
  const event: OfficialEvent = {
    ...draft,
    id,
    participantIds: [],
    createdBy: adminId,
    createdAt: new Date().toISOString(),
    isOfficial: true
  };
  writeAll([event, ...readAll()]);
  syncAdminEvent('create', id, { event: { ...event } as unknown as Record<string, unknown> });
  return event;
}

export function updateEvent(id: string, patch: Partial<OfficialEvent>): OfficialEvent | null {
  requireAdminSession();
  const all = readAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const updated = { ...all[idx]!, ...patch };
  all[idx] = updated;
  writeAll(all);
  syncAdminEvent('update', id, { patch: patch as Record<string, unknown> });
  return updated;
}

export function removeEvent(id: string): void {
  requireAdminSession();
  triggerHapticImpact('medium');
  writeAll(readAll().filter((e) => e.id !== id));
  syncAdminEvent('delete', id, {});
}

/**
 * Firestore rules deny direct client writes to /events, so admin mutations go
 * through the server callable that validates the OTP session first.
 */
function syncAdminEvent(
  operation: 'create' | 'update' | 'delete',
  eventId: string,
  payload: { event?: Record<string, unknown>; patch?: Record<string, unknown> }
): void {
  const session = getAdminSession();
  if (!session) return;
  void adminMutateEvent({ sessionId: session.sessionId, operation, eventId, ...payload });
}

export function toggleEventRegistration(eventId: string, userId: string): OfficialEvent | null {
  triggerHapticImpact('medium');
  const all = readAll();
  const idx = all.findIndex((e) => e.id === eventId);
  if (idx === -1) return null;

  const event = all[idx]!;
  const registered = event.participantIds.includes(userId);

  if (!registered && event.participantIds.length >= event.participantsMax) {
    return event; // full
  }

  const nextIds = registered
    ? event.participantIds.filter((i) => i !== userId)
    : [...event.participantIds, userId];

  const updated: OfficialEvent = { ...event, participantIds: nextIds };
  all[idx] = updated;
  writeAll(all);
  backgroundWrite(() => setDoc(doc(db, 'events', eventId), updated));
  if (!registered) triggerHapticNotification('success');
  return updated;
}

/** Aggregated numbers for the admin dashboard */
export function getAdminStats() {
  const all = readAll();
  return {
    total: all.length,
    published: all.filter((e) => e.status === 'published').length,
    drafts: all.filter((e) => e.status === 'draft').length,
    registrations: all.reduce((s, e) => s + e.participantIds.length, 0)
  };
}
