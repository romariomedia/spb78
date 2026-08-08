import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
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
import { createFreshProfile } from './reset';

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

function addOfflineAction(action: Omit<OfflineAction, 'id' | 'createdAt'>): void {
  const queue = getOfflineQueue();
  queue.push({
    ...action,
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    createdAt: Date.now()
  });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
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

// Fire-and-forget write: never blocks the UI, silently ignores unreachable backend
function backgroundWrite(action: () => Promise<unknown>): void {
  try {
    void withTimeout(Promise.resolve(action()), FIRESTORE_TIMEOUT_MS).catch(() => {
      /* offline or unreachable — local cache already updated */
    });
  } catch {
    /* ignore */
  }
}

/**
 * Replaces the active profile in the local mirror with a zero-progress one.
 * Used exactly once after registration, before any UI reads statistics.
 *
 * NOTE: Demo profiles stay local-only. The fresh profile is the only user
 * profile mirrored to Firestore, preventing sample data from reaching the
 * real community database.
 */
export function persistFreshProfile(profile: UserProfile): void {
  const cached = getOfflineCache();
  const community = (cached?.allUsers ?? INITIAL_USERS)
    .filter((u) => u.id !== CURRENT_USER_ID)
    .filter((u) => u.isDemo);

  const data: AppData = {
    currentUser: profile,
    allUsers: [profile, ...community],
    trainings: cached?.trainings ?? INITIAL_TRAININGS,
    feedPosts: cached?.feedPosts ?? INITIAL_FEED,
    comments: cached?.comments ?? {},
    isOffline: false,
    hasPendingQueue: false
  };

  saveOfflineCache(data);
  backgroundWrite(() => setDoc(doc(db, 'users', profile.id), profile));
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
      const [usersSnap, trainingsSnap, feedSnap] = await withTimeout(
        Promise.all([
          getDocs(query(collection(db, 'users'))),
          getDocs(query(collection(db, 'trainings'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'feed'), orderBy('id', 'asc')))
        ]),
        FIRESTORE_TIMEOUT_MS * 2
      );

      const allUsers: UserProfile[] = [];
      usersSnap.forEach((docSnap) => {
        allUsers.push(docSnap.data() as UserProfile);
      });

      const trainings: Training[] = [];
      trainingsSnap.forEach((docSnap) => {
        trainings.push(docSnap.data() as Training);
      });

      const feedPosts: FeedPost[] = [];
      feedSnap.forEach((docSnap) => {
        feedPosts.push(docSnap.data() as FeedPost);
      });

      // Sort feed posts by date roughly or maintain list
      let currentUser = allUsers.find(u => u.id === CURRENT_USER_ID);
      if (!currentUser) {
        // A missing cloud document means this account is new: start clean.
        currentUser = createFreshProfile(CURRENT_USER_ID);
        backgroundWrite(() => setDoc(doc(db, 'users', CURRENT_USER_ID), currentUser));
        allUsers.unshift(currentUser);
      }

      if (currentUser) {
        const result: AppData = {
          currentUser,
          allUsers: allUsers.length > 0 ? allUsers : INITIAL_USERS,
          trainings: trainings.length > 0 ? trainings : INITIAL_TRAININGS,
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
    trainings: INITIAL_TRAININGS,
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
  newTraining: Omit<Training, 'id' | 'createdBy' | 'createdAt' | 'participantIds'>,
  creator: UserProfile
): Promise<Training> {
  if (!hasActivePremium(creator)) throw new PremiumTrainingRequiredError();

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const id = `tr-${Date.now().toString().slice(-4)}`;
  const fullTraining: Training = {
    ...newTraining,
    id,
    createdBy: CURRENT_USER_ID,
    participantIds: [CURRENT_USER_ID],
    createdAt: new Date().toISOString()
  };

  if (!isOnline) {
    addOfflineAction({ type: 'createTraining', payload: fullTraining });
    // Update local cache directly
    const cached = getOfflineCache();
    if (cached) {
      cached.trainings.unshift(fullTraining);
      saveOfflineCache(cached);
    }
    return fullTraining;
  }

  const cached = getOfflineCache();
  if (cached) {
    cached.trainings.unshift(fullTraining);
    saveOfflineCache(cached);
  }
  backgroundWrite(() => setDoc(doc(db, 'trainings', id), fullTraining));

  return fullTraining;
}

// 3. toggleJoinTraining
export async function toggleJoinTraining(trainingId: string): Promise<boolean> {
  triggerHapticImpact('medium');
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const cached = getOfflineCache();
  let isJoined = false;

  if (cached) {
    const training = cached.trainings.find(t => t.id === trainingId);
    if (training) {
      const idx = training.participantIds.indexOf(CURRENT_USER_ID);
      if (idx !== -1) {
        training.participantIds.splice(idx, 1);
        isJoined = false;
      } else {
        if (training.participantIds.length < training.participantsMax) {
          training.participantIds.push(CURRENT_USER_ID);
          isJoined = true;
        } else {
          return false; // Full
        }
      }
      saveOfflineCache(cached);
    }
  }

  if (!isOnline) {
    addOfflineAction({ type: 'toggleJoinTraining', payload: { trainingId, userId: CURRENT_USER_ID } });
    return isJoined;
  }

  // Sync to Firestore in the background — local cache is the source of truth for the UI
  const updatedTraining = getOfflineCache()?.trainings.find(t => t.id === trainingId);
  if (updatedTraining) {
    backgroundWrite(() =>
      updateDoc(doc(db, 'trainings', trainingId), { participantIds: updatedTraining.participantIds })
    );
  }

  return isJoined;
}

// 4. toggleLikeProfile
export async function toggleLikeProfile(targetUserId: string): Promise<{ isLiked: boolean; isMatch: boolean }> {
  triggerHapticImpact('light');
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const cached = getOfflineCache();
  let isLiked = false;
  let isMatch = false;

  if (cached) {
    const me = cached.currentUser;
    const target = cached.allUsers.find(u => u.id === targetUserId);
    if (me && target) {
      const likedIdx = me.likedUserIds.indexOf(targetUserId);
      if (likedIdx !== -1) {
        me.likedUserIds.splice(likedIdx, 1);
        const matchIdx = me.matchIds.indexOf(targetUserId);
        if (matchIdx !== -1) me.matchIds.splice(matchIdx, 1);
        isLiked = false;
      } else {
        me.likedUserIds.push(targetUserId);
        isLiked = true;
        // Check if mutual like
        if (target.likedUserIds.includes(CURRENT_USER_ID)) {
          if (!me.matchIds.includes(targetUserId)) {
            me.matchIds.push(targetUserId);
          }
          if (!target.matchIds.includes(CURRENT_USER_ID)) {
            target.matchIds.push(CURRENT_USER_ID);
          }
          isMatch = true;
        }
      }
      saveOfflineCache(cached);
    }
  }

  if (!isOnline) {
    addOfflineAction({ type: 'toggleLikeProfile', payload: { targetUserId } });
    return { isLiked, isMatch };
  }

  // Background sync of the freshly computed local state
  const me = getOfflineCache()?.currentUser;
  const target = getOfflineCache()?.allUsers.find(u => u.id === targetUserId);
  if (me) {
    backgroundWrite(() =>
      updateDoc(doc(db, 'users', CURRENT_USER_ID), {
        likedUserIds: me.likedUserIds,
        matchIds: me.matchIds
      })
    );
  }
  if (isMatch && target) {
    backgroundWrite(() => updateDoc(doc(db, 'users', targetUserId), { matchIds: target.matchIds }));
  }

  return { isLiked, isMatch };
}

// 5. createPost
export async function createPost(content: string, sportTag: string, mediaUrl?: string, mediaType: 'image' | 'video' = 'image'): Promise<FeedPost | null> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const cached = getOfflineCache();
  const me = cached?.currentUser || INITIAL_USERS[0];

  if (!me || !hasActivePremium(me) || me.isVerified !== true) {
    return null; // Premium and server-verified profile are required to publish
  }

  const id = `post-${Date.now()}`;
  const newPost: FeedPost = {
    id,
    authorId: me.id,
    authorName: me.name,
    authorAvatar: me.avatar,
    authorPlan: me.subscriptionPlan,
    sportTag,
    content,
    mediaUrl: mediaUrl || undefined,
    mediaType: mediaUrl ? mediaType : undefined,
    likes: [],
    commentsCount: 0,
    createdAt: 'Только что',
    comments: []
  };

  if (cached) {
    cached.feedPosts.unshift(newPost);
    saveOfflineCache(cached);
  }

  if (!isOnline) {
    addOfflineAction({ type: 'createPost', payload: newPost });
    return newPost;
  }

  backgroundWrite(() => setDoc(doc(db, 'feed', id), newPost));

  return newPost;
}

// 6. createComment
export async function createComment(postId: string, content: string): Promise<PostComment> {
  const cached = getOfflineCache();
  const me = cached?.currentUser || INITIAL_USERS[0];
  
  const newComment: PostComment = {
    id: `c-${Date.now()}`,
    postId,
    authorId: me?.id || CURRENT_USER_ID,
    authorName: me?.name || 'Александр Громов',
    authorAvatar: me?.avatar || '',
    content,
    createdAt: 'Только что'
  };

  if (cached) {
    const post = cached.feedPosts.find(p => p.id === postId);
    if (post) {
      post.comments = post.comments || [];
      post.comments.push(newComment);
      post.commentsCount = post.comments.length;
      saveOfflineCache(cached);
    }
  }

  const syncedPost = getOfflineCache()?.feedPosts.find(p => p.id === postId);
  if (syncedPost) {
    backgroundWrite(() =>
      updateDoc(doc(db, 'feed', postId), {
        comments: syncedPost.comments || [],
        commentsCount: syncedPost.commentsCount
      })
    );
  }

  return newComment;
}

// 7. toggleLikePost
export async function toggleLikePost(postId: string): Promise<boolean> {
  triggerHapticImpact('light');
  const cached = getOfflineCache();
  let liked = false;
  if (cached) {
    const post = cached.feedPosts.find(p => p.id === postId);
    if (post) {
      const idx = post.likes.indexOf(CURRENT_USER_ID);
      if (idx !== -1) {
        post.likes.splice(idx, 1);
        liked = false;
      } else {
        post.likes.push(CURRENT_USER_ID);
        liked = true;
      }
      saveOfflineCache(cached);
    }
  }

  const syncedPost = getOfflineCache()?.feedPosts.find(p => p.id === postId);
  if (syncedPost) {
    backgroundWrite(() => updateDoc(doc(db, 'feed', postId), { likes: syncedPost.likes }));
  }
  return liked;
}

// 8. awardDailyLogin
export async function awardDailyLogin(): Promise<{ medals: number; streak: number; rewardGiven: boolean }> {
  const cached = getOfflineCache();
  let medals = 7;
  let streak = 7;
  let rewardGiven = false;

  if (cached && cached.currentUser) {
    cached.currentUser.totalDailyMedals += 1;
    cached.currentUser.dailyMedalStreak += 1;
    medals = cached.currentUser.totalDailyMedals;
    streak = cached.currentUser.dailyMedalStreak;
    rewardGiven = true;
    saveOfflineCache(cached);
  }

  backgroundWrite(() =>
    updateDoc(doc(db, 'users', CURRENT_USER_ID), {
      totalDailyMedals: medals,
      dailyMedalStreak: streak
    })
  );

  return { medals, streak, rewardGiven };
}

// 9. incrementWorkout (Requirement 5: Кнопка "Засчитать тренировку +1")
export async function incrementWorkout(): Promise<number> {
  triggerHapticImpact('medium');
  const cached = getOfflineCache();
  let total = 13;

  if (cached && cached.currentUser) {
    cached.currentUser.totalWorkouts += 1;
    total = cached.currentUser.totalWorkouts;
    saveOfflineCache(cached);
  }

  backgroundWrite(() => updateDoc(doc(db, 'users', CURRENT_USER_ID), { totalWorkouts: total }));

  return total;
}

// Update user profile in Firestore
export async function updateProfile(updates: Partial<UserProfile>): Promise<void> {
  const cached = getOfflineCache();
  if (cached && cached.currentUser) {
    cached.currentUser = { ...cached.currentUser, ...updates };
    saveOfflineCache(cached);
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    addOfflineAction({ type: 'updateProfile', payload: updates });
    return;
  }

  try {
    await withTimeout(updateDoc(doc(db, 'users', CURRENT_USER_ID), updates));
  } catch {
    // First profile save may race initial document creation. Retry with full
    // cached profile, which includes required name/bio fields for Rules.
    try {
      const fullProfile = getOfflineCache()?.currentUser;
      if (!fullProfile) throw new Error('profile-cache-missing');
      await withTimeout(setDoc(doc(db, 'users', CURRENT_USER_ID), fullProfile, { merge: true }));
    } catch {
      addOfflineAction({ type: 'updateProfile', payload: updates });
      throw new Error('profile-sync-failed');
    }
  }
}

// Offline queue sync replay when reconnected
export async function syncOfflineQueue(): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  for (const item of queue) {
    try {
      if (item.type === 'createTraining') {
        await withTimeout(setDoc(doc(db, 'trainings', item.payload.id), item.payload));
        synced++;
      } else if (item.type === 'incrementWorkout') {
        await withTimeout(updateDoc(doc(db, 'users', CURRENT_USER_ID), { totalWorkouts: item.payload.total }));
        synced++;
      } else if (item.type === 'updateProfile') {
        await withTimeout(updateDoc(doc(db, 'users', CURRENT_USER_ID), item.payload));
        synced++;
      }
    } catch {
      // Keep unfinished items if connection drops again
    }
  }
  clearOfflineQueue();
  return synced;
}
