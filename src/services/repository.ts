import { 
  collection, 
  doc, 
  getDocs,
  getDoc,
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  UserProfile, 
  Training, 
  FeedPost, 
  PostComment, 
  OfflineAction 
} from '../lib/types';
import { triggerHapticImpact } from './native';
import { getActiveTrainings } from './schedule';
import { createFreshProfile } from './reset';
import { callServer } from './serverApi';

/**
 * Runtime identity of the signed-in local account.
 * Kept mutable so legacy service APIs can continue importing it while each
 * newly registered account receives its own Firestore/document identity.
 */
export let CURRENT_USER_ID = 'user-me-1';

export function setCurrentUserId(id: string): void {
  if (id.trim()) CURRENT_USER_ID = id;
}
// v2 deliberately invalidates the pre-release cache that contained
// fabricated statistics for the old demo account.
const OFFLINE_CACHE_KEY = 'sportbuddy_offline_cache_v3';
const OFFLINE_QUEUE_KEY = 'sportbuddy_offline_queue_v3';

/**
 * Production never shows fabricated athletes, trainings or feed posts.
 * Set VITE_ENABLE_SAMPLE_DATA=true only for local visual development.
 */
const ENABLE_SAMPLE_DATA =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_SAMPLE_DATA === 'true';

export interface AppData {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  trainings: Training[];
  feedPosts: FeedPost[];
  comments: Record<string, PostComment[]>;
  isOffline: boolean;
  hasPendingQueue: boolean;
}

/** Thrown when a Free account attempts to create a community training. */
export class PremiumTrainingRequiredError extends Error {
  constructor() {
    super('Создание тренировок доступно только пользователям Premium');
    this.name = 'PremiumTrainingRequiredError';
  }
}

/** Mirrors the UI premium calculation without importing promo.ts (avoids a cycle). */
function hasActivePremium(profile: UserProfile): boolean {
  if (profile.premiumUntil) {
    const until = new Date(profile.premiumUntil).getTime();
    return Number.isFinite(until) && until > Date.now();
  }
  return profile.subscriptionPlan === 'premium';
}

function normalizeUserProfile(raw: Record<string, unknown>): UserProfile {
  const dateFields = ['premiumUntil','trialPremiumEndsAt','rewardPremiumEndsAt','registeredAt','verifiedAt','welcomeTrialGrantedAt'];
  const out: Record<string, unknown> = { ...raw };
  for (const field of dateFields) {
    const value = out[field] as { toDate?: () => Date } | string | undefined;
    if (value && typeof value !== 'string' && typeof value.toDate === 'function') {
      out[field] = value.toDate().toISOString();
    }
  }

  // Firestore documents can be incomplete when migrating older profiles.
  // Start from the canonical profile shape so the function returns a real
  // UserProfile instead of asserting an arbitrary Record<string, unknown>.
  const base = createFreshProfile(String(out.id ?? CURRENT_USER_ID));
  const profileData = out as Partial<UserProfile>;
  return { ...base, ...profileData };
}

// Initial Database Seeding Data for Realistic Discovery & Trainings in Saint Petersburg
const BASE_USERS: UserProfile[] = [
  // Current user — ALWAYS starts from zero. Identity is filled in on
  // registration / VK ID sign-in; no pre-earned stats, rating or rewards.
  {
    id: CURRENT_USER_ID,
    name: 'Новый спортсмен',
    age: 25,
    gender: 'male',
    avatar: '',
    bio: '',
    sports: [],
    locationName: 'Санкт-Петербург',
    lat: 59.9386,
    lng: 30.3141,
    rating: 0,
    ratingSum: 0,
    ratingCount: 0,
    totalWorkouts: 0,
    totalDailyMedals: 0,
    dailyMedalStreak: 0,
    medalTier: 'bronze',
    activeLooking: true,
    likedUserIds: [],
    matchIds: [],
    friendIds: [],
    friendRequestsSent: [],
    friendRequestsReceived: [],
    subscriptionPlan: 'free',
    claimedBoxTiers: [],
    rewardItems: [],
    photoPortfolio: [],
    redeemedPromoCodes: [],
    isVerified: false,
    hasRealPhoto: false
  },
  {
    id: 'user-anna',
    name: 'Анна Соколова',
    age: 25,
    gender: 'female',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
    bio: 'Бегаю полумарафоны по набережным Питера и играю в Падел на Крестовском! Ищу партнера по бегу с темпом 4:50 - 5:15 мин/км в Таврическом саду или на Дворцовой 🌿🏃‍♀️',
    sports: ['Бег', 'Падел', 'Теннис'],
    locationName: 'Таврический сад, СПб',
    lat: 59.9442,
    lng: 30.3755,
    rating: 5.0,
    totalWorkouts: 64,
    totalDailyMedals: 31,
    dailyMedalStreak: 12,
    activeLooking: true,
    // Likes the newcomer, but the match only happens after a mutual like
    likedUserIds: [CURRENT_USER_ID],
    matchIds: [],
    subscriptionPlan: 'premium'
  },
  {
    id: 'user-elena',
    name: 'Елена Воронина',
    age: 24,
    gender: 'female',
    avatar: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=600',
    bio: 'Играю в женский мини-футбол, занимаюсь большим теннисом и обожаю вечерние велопрогулки вдоль Приморского проспекта. Ищу команду! ⚽️🚲',
    sports: ['Футбол', 'Велопрогулка', 'Теннис'],
    locationName: 'Парк 300-летия СПб',
    lat: 59.9833,
    lng: 30.1983,
    rating: 4.8,
    totalWorkouts: 85,
    totalDailyMedals: 40,
    dailyMedalStreak: 9,
    activeLooking: true,
    likedUserIds: [],
    matchIds: [],
    subscriptionPlan: 'premium'
  },
  {
    id: 'user-maria',
    name: 'Мария Власова',
    age: 26,
    gender: 'female',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=600',
    bio: 'Катаю длинные велопрогулки от Васильевского острова до Сестрорецкого разлива! Летом бегаю марафоны, зимой хожу на матчи СКА и играю в любительский хоккей 🏒🚴‍♀️',
    sports: ['Велопрогулка', 'Бег', 'Хоккей'],
    locationName: 'Васильевский остров, СПб',
    lat: 59.9410,
    lng: 30.2740,
    rating: 4.9,
    totalWorkouts: 112,
    totalDailyMedals: 55,
    dailyMedalStreak: 15,
    activeLooking: true,
    likedUserIds: [],
    matchIds: [],
    subscriptionPlan: 'free'
  },
  {
    id: 'user-ekatery',
    name: 'Екатерина Романова',
    age: 28,
    gender: 'female',
    avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&q=80&w=600',
    bio: 'Имею 1 взрослый разряд по большому теннису и увлеклась Паделом! Ищу сильного спаринг-партнера на корты Елагина острова и Петроградской стороны 🎾',
    sports: ['Теннис', 'Падел', 'Бег'],
    locationName: 'Елагин остров, СПб',
    lat: 59.9805,
    lng: 30.2580,
    rating: 5.0,
    totalWorkouts: 78,
    totalDailyMedals: 22,
    dailyMedalStreak: 4,
    activeLooking: true,
    likedUserIds: [CURRENT_USER_ID], // Wants to match when liked back!
    matchIds: [],
    subscriptionPlan: 'free'
  },
  {
    id: 'user-daria',
    name: 'Дарья Нестеренко',
    age: 23,
    gender: 'female',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=600',
    bio: 'Занимаюсь воркаутом на площадке в Новой Голландии — подтягивания, брусья, статика. Также бегаю и играю в стритбол. Ищу компанию для уличных тренировок! 🤸🏀',
    sports: ['Воркаут', 'Баскетбол', 'Бег'],
    locationName: 'Новая Голландия, СПб',
    lat: 59.9295,
    lng: 30.2905,
    rating: 4.7,
    totalWorkouts: 39,
    totalDailyMedals: 14,
    dailyMedalStreak: 3,
    activeLooking: true,
    likedUserIds: [],
    matchIds: [],
    subscriptionPlan: 'free'
  },
  {
    id: 'user-veronika',
    name: 'Вероника Смирнова',
    age: 27,
    gender: 'female',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600',
    bio: 'Капитан любительской баскетбольной команды и ярый игрок в Падел! Собираю четверки на корты на Футбольной аллее и стритбольные турниры 🏀🎾',
    sports: ['Баскетбол', 'Падел', 'Футбол'],
    locationName: 'Петроградская сторона, СПб',
    lat: 59.9650,
    lng: 30.3120,
    rating: 4.9,
    totalWorkouts: 91,
    totalDailyMedals: 48,
    dailyMedalStreak: 8,
    activeLooking: true,
    likedUserIds: [CURRENT_USER_ID], // Wants to match!
    matchIds: [],
    subscriptionPlan: 'premium'
  }
];

/**
 * Index 0 is the real account; the rest are local sample profiles that
 * never reach Firestore and never appear in the community leaderboard.
 */
const INITIAL_USERS: UserProfile[] = ENABLE_SAMPLE_DATA
  ? BASE_USERS.map((u, index) =>
      index === 0 ? u : { ...u, isDemo: true, genderSet: true }
    )
  : [BASE_USERS[0]!];

/** Returns yyyy-mm-dd shifted by N days from today (seed data helper) */
function seedDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEMO_TRAININGS: Training[] = [
  {
    id: 'tr-101',
    title: 'Утренний бег 10 км по Дворцовой набережной',
    sport: 'Бег',
    dateLabel: 'Завтра, 08:30',
    dateKey: seedDay(1),
    time: '08:30',
    locationName: 'Дворцовая набережная',
    address: 'Дворцовая наб., 38, Санкт-Петербург',
    lat: 59.9430,
    lng: 30.3160,
    level: 'amateur',
    participantsMax: 10,
    participantIds: ['user-anna', 'user-maria'],
    description: 'Легкий темп 5:10 - 5:20 мин/км с потрясающим видом на Неву, Эрмитаж и Троицкий мост! Остановка на кофе после пробежки.',
    createdBy: 'user-anna',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'tr-102',
    title: 'Турнир по Паделу в клубном формате 2х2',
    sport: 'Падел',
    dateLabel: 'Суббота, 14:00',
    dateKey: seedDay(2),
    time: '14:00',
    locationName: 'Падел-клуб на Крестовском',
    address: 'Футбольная аллея, 8, Санкт-Петербург',
    lat: 59.9715,
    lng: 30.2245,
    level: 'semi-pro',
    participantsMax: 4,
    participantIds: ['user-ekatery'],
    description: 'Ищем двоих игроков среднего уровня для динамичного парного матча в Падел! Оплата аренды корта делится поровну.',
    createdBy: 'user-ekatery',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'tr-103',
    title: 'Дружеский матч по футболу 5x5 на искусственной траве',
    sport: 'Футбол',
    dateLabel: 'Воскресенье, 11:00',
    dateKey: seedDay(3),
    time: '11:00',
    locationName: 'Поляна у Парка 300-летия СПб',
    address: 'Приморский пр., 74, Санкт-Петербург',
    lat: 59.9833,
    lng: 30.1983,
    level: 'semi-pro',
    participantsMax: 10,
    participantIds: ['user-elena', 'user-veronika'],
    description: 'Играем в любительский мини-футбол 5 на 5 на открытом поле! Берем манишки и мяч, атмосфера дружбы и спорта.',
    createdBy: 'user-elena',
    createdAt: new Date(Date.now() - 3600000 * 20).toISOString()
  },
  {
    id: 'tr-104',
    title: 'Большой теннис: спарринг на грунтовых кортах Елагина острова',
    sport: 'Теннис',
    dateLabel: 'Пятница, 19:00',
    dateKey: seedDay(0),
    time: '19:00',
    locationName: 'Корты Елагина острова',
    address: 'Елагин остров, 4, Санкт-Петербург',
    lat: 59.9805,
    lng: 30.2580,
    level: 'pro',
    participantsMax: 2,
    participantIds: ['user-anna'],
    description: 'Отработка подачи и розыгрыш сета с опытным партнером на свежем воздухе среди деревьев ЦПКиО им. Кирова.',
    createdBy: 'user-anna',
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString()
  },
  {
    id: 'tr-105',
    title: 'Уличный стритбол 3x3 на новой спортивной зоне Новой Голландии',
    sport: 'Баскетбол',
    dateLabel: 'Суббота, 17:00',
    dateKey: seedDay(5),
    time: '17:00',
    locationName: 'Площадка Новая Голландия',
    address: 'набережная Адмиралтейского канала, 2, Санкт-Петербург',
    lat: 59.9295,
    lng: 30.2905,
    level: 'semi-pro',
    participantsMax: 12,
    participantIds: ['user-veronika', 'user-daria'],
    description: 'Динамичный турнир по стритболу на одно кольцо! Присоединяйтесь как сольно, так и готовой тройкой игроков.',
    createdBy: 'user-veronika',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString()
  },
  {
    id: 'tr-106',
    title: 'Велопрогулка 30 км: Васильевский остров — Сестрорецкий разлив',
    sport: 'Велопрогулка',
    dateLabel: 'Воскресенье, 10:00',
    dateKey: seedDay(4),
    time: '10:00',
    locationName: 'Старт от Севкабель Порт',
    address: 'Кожевенная линия, 40, Санкт-Петербург',
    lat: 59.9245,
    lng: 30.2415,
    level: 'amateur',
    participantsMax: 20,
    participantIds: ['user-maria', 'user-elena'],
    description: 'Живописный воскресный велозаезд вдоль Финского залива! Средняя скорость 20 км/ч, делаем фотостопы у моря в Севкабель Порту.',
    createdBy: 'user-maria',
    createdAt: new Date(Date.now() - 3600000 * 60).toISOString()
  },
  {
    id: 'tr-108',
    title: 'Воркаут на турниках: подтягивания, брусья, статика',
    sport: 'Воркаут',
    dateLabel: 'Вторник, 19:00',
    dateKey: seedDay(2),
    time: '19:00',
    locationName: 'Воркаут-площадка Новая Голландия',
    address: 'наб. Адмиралтейского канала, 2, Санкт-Петербург',
    lat: 59.9295,
    lng: 30.2905,
    level: 'amateur',
    participantsMax: 12,
    participantIds: ['user-daria'],
    description: 'Уличная гимнастика с собственным весом: круговая на подтягивания и отжимания на брусьях, затем отработка статических элементов — флаг и передний вис. Берите перчатки и воду, снаряды на площадке есть.',
    createdBy: 'user-daria',
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
  },
  {
    id: 'tr-107',
    title: 'Любительский хоккейный матч на льду СК «Арена»',
    sport: 'Хоккей',
    dateLabel: 'Суббота, 21:00',
    dateKey: seedDay(6),
    time: '21:00',
    locationName: 'КСК «Арена» Ледовое поле',
    address: 'пр. Юрия Гагарина, 8, Санкт-Петербург',
    lat: 59.8685,
    lng: 30.3440,
    level: 'semi-pro',
    participantsMax: 20,
    participantIds: ['user-maria'],
    description: 'Двухсторонний товарищеский матч! Нужны защитники и форварды. Полная защитная экипировка обязательна.',
    createdBy: 'user-maria',
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString()
  }
];

const INITIAL_TRAININGS: Training[] = ENABLE_SAMPLE_DATA ? DEMO_TRAININGS : [];

const DEMO_FEED: FeedPost[] = [
  {
    id: 'post-1',
    authorId: 'user-anna',
    authorName: 'Анна Соколова',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
    authorPlan: 'premium',
    sportTag: 'Бег',
    content: 'Новая беговая цель в Санкт-Петербурге достигнута: 15 км вдоль Невы с отличным пульсом 145 уд/мин! 🏅 Кто готов присоединиться к нашей субботней группе на Дворцовой набережной в 8:30 утра?',
    mediaUrl: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&q=80&w=1200',
    mediaType: 'image',
    likes: ['user-maria', 'user-elena'],
    commentsCount: 2,
    createdAt: '2 часа назад',
    comments: [
      {
        id: 'c-1',
        postId: 'post-1',
        authorId: CURRENT_USER_ID,
        authorName: 'Александр Громов',
        authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600',
        content: 'Впечатляющий темп и вид на Эрмитаж! Обязательно буду в субботу 🙌',
        createdAt: '1 час назад'
      },
      {
        id: 'c-2',
        postId: 'post-1',
        authorId: 'user-maria',
        authorName: 'Мария Власова',
        authorAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=600',
        content: 'Умница Анна! Какие кроссовки взяла на питерский асфальт?',
        createdAt: '45 мин назад'
      }
    ]
  },
  {
    id: 'post-2',
    authorId: 'user-ekatery',
    authorName: 'Екатерина Романова',
    authorAvatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&q=80&w=600',
    authorPlan: 'premium',
    sportTag: 'Падел',
    content: 'Падел — это абсолютный хит этого спортивного сезона в СПб! 🎾 🔥 Вчера провели 2 часа напряженной парной борьбы на Крестовском острове. Напарники из SportBuddy дают +100% к мотивации!',
    mediaUrl: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&q=80&w=1200',
    mediaType: 'image',
    likes: ['user-veronika', 'user-anna'],
    commentsCount: 1,
    createdAt: '5 часов назад',
    comments: [
      {
        id: 'c-3',
        postId: 'post-2',
        authorId: 'user-veronika',
        authorName: 'Вероника Смирнова',
        authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600',
        content: 'Падел топ! На субботу ракетки готовы 🔥',
        createdAt: '3 часа назад'
      }
    ]
  },
  {
    id: 'post-3',
    authorId: 'user-maria',
    authorName: 'Мария Власова',
    authorAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=600',
    authorPlan: 'free',
    sportTag: 'Велопрогулка',
    content: '35 км на велосипедах от Севкабель Порта вдоль Финского залива преодолены! Весна принесла идеальную погоду для заездов. Ищу напарников по велопрогулкам на следующие выходные!',
    mediaUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&q=80&w=1200',
    mediaType: 'image',
    likes: ['user-anna', 'user-daria'],
    commentsCount: 0,
    createdAt: 'Вчера',
    comments: []
  }
];

const INITIAL_FEED: FeedPost[] = ENABLE_SAMPLE_DATA ? DEMO_FEED : [];

// Helper: Get offline cache from localStorage
function getOfflineCache(): AppData | null {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppData;
  } catch {
    return null;
  }
}

// Helper: Save offline cache to localStorage
function saveOfflineCache(data: Omit<AppData, 'isOffline' | 'hasPendingQueue'>): void {
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify({ ...data, isOffline: false, hasPendingQueue: false }));
  } catch {
    // ignore quotas
  }
}

// Helper: Offline Actions Queue (Prompt 3 requirement)
export function getOfflineQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// CRITICAL: Firestore SDK never rejects when the project/API key is unreachable —
// it retries the connection forever. Without this guard the initial loading screen hangs.
export const FIRESTORE_TIMEOUT_MS = 3500;

class TimeoutError extends Error {
  constructor() {
    super('Firestore request timed out');
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number = FIRESTORE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Replaces the active profile in the local mirror with a zero-progress one.
 * Used exactly once after registration, before any UI reads statistics.
 *
 * NOTE: Demo profiles stay local-only. The fresh profile is the only user
 * profile mirrored to Firestore, preventing sample data from reaching the
 * real community database.
 */
export async function persistFreshProfile(profile: UserProfile): Promise<UserProfile> {
  // Critical account creation is server-authoritative. The client sends only
  // onboarding fields; Vercel derives uid from the Firebase ID token and
  // grants the one-time welcome Premium transactionally.
  const result = await callServer<{ created: boolean; profile: UserProfile }>('/api/sportbuddy-mutation', {
    action: 'bootstrapProfile',
    profile: {
      name: profile.name,
      email: profile.email,
      age: profile.age,
      gender: profile.gender,
      genderSet: profile.genderSet,
      avatar: profile.avatar,
      bio: profile.bio,
      sports: profile.sports,
      locationName: profile.locationName,
      lat: profile.lat,
      lng: profile.lng,
      registeredAt: profile.registeredAt,
      isVerified: profile.isVerified,
      hasRealPhoto: profile.hasRealPhoto,
      verifiedAt: profile.verifiedAt
    }
  });

  const authoritative = { ...profile, ...result.profile, id: CURRENT_USER_ID };
  const cached = getOfflineCache();
  const community = (cached?.allUsers ?? INITIAL_USERS)
    .filter((u) => u.id !== CURRENT_USER_ID)
    .filter((u) => u.isDemo);

  const data: AppData = {
    currentUser: authoritative,
    allUsers: [authoritative, ...community],
    trainings: getActiveTrainings(cached?.trainings ?? []),
    feedPosts: cached?.feedPosts ?? INITIAL_FEED,
    comments: cached?.comments ?? {},
    isOffline: false,
    hasPendingQueue: false
  };

  saveOfflineCache(data);
  return authoritative;
}

/**
 * Checks Firestore availability.
 *
 * PRODUCTION RULE: demo profiles are NEVER written to Firestore. They exist
 * only in the local mirror so the Discovery screen is not empty on a fresh
 * install. Seeding bots into the real database would corrupt the leaderboard
 * and show fake athletes to real users.
 */
async function ensureFirestoreSeeded(): Promise<boolean> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!isOnline) return false;

  try {
    // A single lightweight read confirms connectivity and rule access
    await withTimeout(getDocs(collection(db, 'users')));
    return true;
  } catch (err) {
    console.warn('Firestore unreachable — using local SportBuddy СПб mirror:', err);
    return false;
  }
}

// 1. loadAppData — load everything cleanly from Firestore (with automatic fail-safe to initial realistic cache)
export async function loadAppData(): Promise<AppData> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const hasPendingQueue = getOfflineQueue().length > 0;
  
  // If offline, serve directly from offline cache
  if (!isOnline) {
    const cached = getOfflineCache();
    if (cached && cached.currentUser.id === CURRENT_USER_ID) {
      return { ...cached, isOffline: true, hasPendingQueue };
    }
  }

  try {
    const canConnect = await ensureFirestoreSeeded();
    if (canConnect) {
      // Fetch all collections from Firestore (bounded — never hangs the splash screen)
      const [usersSnap, trainingsSnap, feedSnap, privateSnap] = await withTimeout(
        Promise.all([
          getDocs(query(collection(db, 'users'))),
          getDocs(query(collection(db, 'trainings'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'feed'), orderBy('id', 'desc'))),
          getDoc(doc(db, 'usersPrivate', CURRENT_USER_ID))
        ]),
        FIRESTORE_TIMEOUT_MS * 2
      );

      const allUsers: UserProfile[] = [];
      usersSnap.forEach((docSnap) => {
        allUsers.push(normalizeUserProfile(docSnap.data()));
      });

      const trainings: Training[] = [];
      trainingsSnap.forEach((docSnap) => {
        trainings.push(docSnap.data() as Training);
      });
      const activeTrainings = getActiveTrainings(trainings);

      const feedPosts: FeedPost[] = [];
      feedSnap.forEach((docSnap) => {
        feedPosts.push(docSnap.data() as FeedPost);
      });

      // Sort feed posts by date roughly or maintain list
      let currentUser = allUsers.find(u => u.id === CURRENT_USER_ID);
      if (!currentUser) {
        // Do not create the account directly from the client. A fresh profile
        // is persisted by App through /api/sportbuddy-mutation, where the
        // Firebase UID is taken from the verified ID token and the one-time
        // welcome Premium is granted transactionally.
        currentUser = createFreshProfile(CURRENT_USER_ID);
        allUsers.unshift(currentUser);
      } else {
        // VK/email authentication may create the identity document before the
        // full profile bootstrap. Merge safe defaults so old/partial records
        // cannot crash discovery, feed, rewards or matching.
        currentUser = createFreshProfile(CURRENT_USER_ID, currentUser);
        if (privateSnap.exists()) currentUser = { ...currentUser, ...(privateSnap.data() as Partial<UserProfile>) };
      }

      if (currentUser) {
        const result: AppData = {
          currentUser,
          allUsers: allUsers.length > 0 ? allUsers : INITIAL_USERS,
          trainings: activeTrainings,
          feedPosts: feedPosts.length > 0 ? feedPosts : INITIAL_FEED,
          comments: {},
          isOffline: false,
          hasPendingQueue
        };
        saveOfflineCache(result);
        return result;
      }
    }
  } catch (error) {
    console.warn('Error loading from Firestore, serving fallback/offline persistence:', error);
  }

  // Fallback / Simulated Firestore memory if offline or unconfigured API keys
  const cached = getOfflineCache();
  if (cached && cached.allUsers.length > 0) {
    // Never hand another account's cached profile to the signed-in athlete.
    if (cached.currentUser.id === CURRENT_USER_ID) {
      return { ...cached, isOffline: !isOnline, hasPendingQueue };
    }
  }

  const defaultData: AppData = {
    currentUser: createFreshProfile(CURRENT_USER_ID),
    allUsers: [createFreshProfile(CURRENT_USER_ID)],
    trainings: getActiveTrainings(INITIAL_TRAININGS),
    feedPosts: INITIAL_FEED,
    comments: {},
    isOffline: !isOnline,
    hasPendingQueue
  };
  saveOfflineCache(defaultData);
  return defaultData;
}

// 2. createTraining — Premium-only at repository level, not just UI level
export async function createTraining(
  newTraining: Omit<Training, 'id' | 'createdBy' | 'createdAt' | 'participantIds'>, creator: UserProfile
): Promise<Training> {
  if (!hasActivePremium(creator)) throw new PremiumTrainingRequiredError();
  const result = await callServer<{ training: Training }>('/api/sportbuddy-mutation', { action: 'training', operation: 'createTraining', training: newTraining });
  const training = result.training; const cached = getOfflineCache();
  if (cached) { cached.trainings = [training, ...cached.trainings.filter(t => t.id !== training.id)]; saveOfflineCache(cached); }
  return training;
}

// 3. toggleJoinTraining
export async function toggleJoinTraining(trainingId: string): Promise<boolean> {
  triggerHapticImpact('medium');
  const result = await callServer<{ joined: boolean; participantIds: string[] }>('/api/sportbuddy-mutation', { action: 'training', operation: 'toggleJoinTraining', trainingId });
  const cached = getOfflineCache(); if (cached) { const training = cached.trainings.find(t => t.id === trainingId); if (training) training.participantIds = result.participantIds; saveOfflineCache(cached); }
  return result.joined;
}

// 4. toggleLikeProfile
export async function toggleLikeProfile(targetUserId: string): Promise<{ isLiked: boolean; isMatch: boolean; error?: string }> {
  triggerHapticImpact('light');
  try {
    const result = await callServer<{ isLiked: boolean; isMatch: boolean; matchIds: string[]; likedUserIds: string[] }>('/api/sportbuddy-mutation', { action: 'match', targetUserId });
    const cached = getOfflineCache(); if (cached) { cached.currentUser.likedUserIds = result.likedUserIds; cached.currentUser.matchIds = result.matchIds; saveOfflineCache(cached); }
    return { isLiked: result.isLiked, isMatch: result.isMatch };
  } catch (error) { return { isLiked: false, isMatch: false, error: error instanceof Error ? error.message : 'Не удалось выполнить действие' }; }
}

// 5. createPost
export async function createPost(
  content: string, sportTag: string, mediaUrl?: string, mediaType: 'image' | 'video' = 'image', publisher?: UserProfile
): Promise<FeedPost | null> {
  if (!publisher && !getOfflineCache()?.currentUser) return null;
  try {
    const result = await callServer<{ post: FeedPost }>('/api/feed-create', { content, sportTag, mediaUrl, mediaType });
    const cached = getOfflineCache(); if (cached) { cached.feedPosts = [result.post, ...cached.feedPosts.filter(p => p.id !== result.post.id)]; saveOfflineCache(cached); }
    return result.post;
  } catch { return null; }
}

// 6. createComment
export async function createComment(postId: string, content: string): Promise<PostComment> {
  const result = await callServer<{ comment: PostComment; post: FeedPost }>('/api/sportbuddy-mutation', { action:'feed', operation:'comment', postId, content });
  const cached=getOfflineCache(); if(cached){ cached.feedPosts=cached.feedPosts.map(p=>p.id===postId?result.post:p); saveOfflineCache(cached); }
  return result.comment;
}

// 7. toggleLikePost
export async function toggleLikePost(postId: string): Promise<boolean> {
  triggerHapticImpact('light');
  const result = await callServer<{ liked:boolean; post:FeedPost }>('/api/sportbuddy-mutation', { action:'feed', operation:'like', postId });
  const cached=getOfflineCache(); if(cached){ cached.feedPosts=cached.feedPosts.map(p=>p.id===postId?result.post:p); saveOfflineCache(cached); }
  return result.liked;
}

// 8. awardDailyLogin
export async function awardDailyLogin(): Promise<{ medals: number; streak: number; rewardGiven: boolean }> {
  const result = await callServer<{ medals: number; streak: number; rewardGiven: boolean }>('/api/sportbuddy-mutation', { action: 'dailyMedal' });
  const cached = getOfflineCache(); if (cached) { cached.currentUser.totalDailyMedals = result.medals; cached.currentUser.dailyMedalStreak = result.streak; cached.currentUser.lastClaimedDate = new Date().toISOString().slice(0,10); cached.currentUser.lastLoginTimestamp = Date.now(); saveOfflineCache(cached); }
  return result;
}

// 9. incrementWorkout (Requirement 5: Кнопка "Засчитать тренировку +1")
export async function incrementWorkout(): Promise<number> {
  throw new Error('Прямое начисление тренировки отключено. Тренировка должна быть подтверждена сервером.');
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<void> {
  const result = await callServer<{ profile: UserProfile | null }>('/api/sportbuddy-mutation', { action: 'profile', updates });
  const safe = updates as Record<string, unknown>;
  const cached = getOfflineCache();
  if (cached?.currentUser) { cached.currentUser = { ...cached.currentUser, ...safe } as UserProfile; saveOfflineCache(cached); }
  void result;
}

// Offline queue sync replay when reconnected
export async function syncOfflineQueue(): Promise<number> {
  // Critical business operations are never replayed from localStorage.
  // Legacy queues are discarded because replaying them would bypass the
  // server transaction layer introduced in the stabilization pass.
  const count = getOfflineQueue().length;
  clearOfflineQueue();
  return count;
}
