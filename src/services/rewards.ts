import { BoxTierConfig, PromoCode, RewardItem, UserProfile } from '../lib/types';
import { callServer } from './serverApi';
import { IS_TEST_PERIOD_ACTIVE } from '../lib/release';

// SportBuddy BOX Tiers Configuration (Prompt requirement: BOX 1 at 7 workouts, BOX 2 at 14, BOX 3 at 28)
export const SPORTBUDDY_BOX_TIERS: BoxTierConfig[] = [
  {
    requiredWorkouts: 7,
    title: 'SportBuddy BOX 1 (Старт)',
    boxName: 'Секретный Бокс №1',
    badge: '🥉 7 Тренировок',
    possibleRewards: [
      {
        title: 'Билет на домашний матч ФК «Зенит»',
        category: 'ticket',
        description: 'Официальный билет на Трибуну C, Газпром Арена (Санкт-Петербург). Поддержите любимую команду в прямом эфире!',
        location: 'Санкт-Петербург, Газпром Арена',
        icon: '⚽️'
      },
      {
        title: 'Фирменный шейкер SportBuddy PRO',
        category: 'gear',
        description: 'Спортивный термошейкер 750мл с венчиком из нержавеющей стали и герметичным замком от обтекания.',
        location: 'Доставка или пункт выдачи в СПб',
        icon: '🥤'
      },
      {
        title: 'Скидочный ваучер 1000₽ в «Спортмастер PRO»',
        category: 'coupon',
        description: 'Действует на любую экипировку для бега и фитнеса во всех флагманских магазинах Санкт-Петербурга.',
        location: 'Санкт-Петербург',
        icon: '🏷️'
      }
    ]
  },
  {
    requiredWorkouts: 14,
    title: 'SportBuddy BOX 2 (Прогресс)',
    boxName: 'Секретный Бокс №2',
    badge: '🥈 14 Тренировок',
    possibleRewards: [
      {
        title: 'Слот на беговой марафон «Белые Ночи СПб»',
        category: 'ticket',
        description: 'Официальный стартовый пакет на культовый ночной забег по центру Санкт-Петербурга (дистанции 10 км или 42.2 км).',
        location: 'Санкт-Петербург, Дворцовая площадь',
        icon: '🏃‍♂️'
      },
      {
        title: 'Комплект фитнес-резинок Pro-Loop Ultimate',
        category: 'gear',
        description: 'Набор из 5 эластичных лент различного сопротивления из 100% натурального латекса в фирменной сумке.',
        location: 'Санкт-Петербург',
        icon: '🏋️‍♀️'
      },
      {
        title: 'VIP-посещение Олимпийского бассейна на Крестовском',
        category: 'ticket',
        description: 'Бесплатное разовое посещение профессионального бассейна 50м и термо-зоны саун после интенсивной тренировки.',
        location: 'Санкт-Петербург, Крестовский остров',
        icon: '🏊‍♂️'
      }
    ]
  },
  {
    requiredWorkouts: 28,
    title: 'SportBuddy BOX 3 (Элита)',
    boxName: 'Секретный Бокс №3',
    badge: '🥇 28 Тренировок',
    possibleRewards: [
      {
        title: 'Абонемент на 1 месяц в фитнес-клуб World Class СПб',
        category: 'premium',
        description: 'Безлимитный доступ во все залы групповых программ, тренажерный зал и SPA-комплекс в Санкт-Петербурге.',
        location: 'Санкт-Петербург (Сеть World Class)',
        icon: '💎'
      },
      {
        title: 'Беспроводные спортивные наушники Bone Conduction',
        category: 'gear',
        description: 'Профессиональные беговые наушники с костной проводимостью звука и защитой от дождя IPX7.',
        location: 'Доставка по Санкт-Петербургу',
        icon: '🎧'
      },
      {
        title: 'VIP-ложа на баскетбольное дерби БК «Зенит»',
        category: 'ticket',
        description: 'Парный билет в центральный партер на матч Единой Лиги ВТБ в КСК «Арена» на Футбольной аллее.',
        location: 'Санкт-Петербург, КСК «Арена»',
        icon: '🏀'
      }
    ]
  }
];

// 24 hours in milliseconds
export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Get YYYY-MM-DD format for today
export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0] || '2026-03-31';
}

// Check and verify daily medal streak status (Burn streak if > 24 hours since last valid activity/claim)
export async function verifyAndProcessStreak(user: UserProfile): Promise<{ updatedUser: UserProfile; streakBurned: boolean; canClaimToday: boolean; hoursUntilExpiration: number }> {
  const now=Date.now(), todayStr=getTodayDateString(), progress=user.medalProgress;
  const lastTs=Number(progress?.lastClaimTimestamp || user.lastLoginTimestamp || now);
  const canClaimToday=(progress?.lastClaimDayKey || user.lastClaimedDate) !== todayStr;
  const elapsed=Math.max(0,now-lastTs);
  const hoursUntilExpiration=Number((Math.max(0,TWENTY_FOUR_HOURS_MS-elapsed)/(1000*60*60)).toFixed(1));
  return { updatedUser:user, streakBurned:false, canClaimToday, hoursUntilExpiration:hoursUntilExpiration>0?hoursUntilExpiration:24 };
}

// Claim Today's SportBuddy Golden Medal
export async function claimDailyMedal(user: UserProfile): Promise<{ updatedUser: UserProfile; unlockedPremium: boolean; message: string; promo?: PromoCode }> {
  const result = await callServer<{ medals:number; streak:number; progress?:UserProfile['medalProgress']; promo?:PromoCode; newTier?:string }>('/api/sportbuddy-mutation', { action:'dailyMedal' });
  const updatedUser: UserProfile = { ...user, totalDailyMedals:result.medals, dailyMedalStreak:result.streak, medalProgress:result.progress, ...(result.newTier ? { medalTier:result.newTier as UserProfile['medalTier'] } : {}) };
  return { updatedUser, unlockedPremium:Boolean(result.promo), message:result.promo ? `🎉 Цикл завершён! Вам начислен промокод на ${result.promo.days} дней Premium.` : `🏅 Медаль получена! Серия: ${result.streak} дн.`, promo:result.promo };
}

// Open SportBuddy BOX for completing workout milestones (7, 14, 28)
export async function openSportBuddyBox(user: UserProfile, tierIndex: number): Promise<{ updatedUser: UserProfile; wonItem: RewardItem; error?: string; promo?: PromoCode }> {
  if (IS_TEST_PERIOD_ACTIVE) return { updatedUser:user, wonItem:{} as RewardItem, error:'🎁 Тестовый период: прогресс BOX считается, но призы начнут выдаваться после завершения 30-дневной беты.' };
  try {
    const result = await callServer<{ reward:RewardItem; claimedBoxTiers:number[]; rewardItems:RewardItem[] }>('/api/sportbuddy-mutation', { action:'openBox', tierIndex });
    return { updatedUser:{ ...user, claimedBoxTiers:result.claimedBoxTiers, rewardItems:result.rewardItems }, wonItem:result.reward };
  } catch(error) { return { updatedUser:user, wonItem:{} as RewardItem, error:error instanceof Error ? error.message : 'Не удалось открыть BOX' }; }
}
