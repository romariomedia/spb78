import { BoxTierConfig, PromoCode, RewardItem, UserProfile } from '../lib/types';
import { updateProfile } from './repository';
import { triggerHapticNotification } from './native';
import { generatePromoCode, isPremiumActive } from './promo';
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
export async function verifyAndProcessStreak(user: UserProfile): Promise<{
  updatedUser: UserProfile;
  streakBurned: boolean;
  canClaimToday: boolean;
  hoursUntilExpiration: number;
}> {
  const now = Date.now();
  const todayStr = getTodayDateString();
  let streakBurned = false;
  let updatedUser = { ...user };

  // Ensure arrays and default timestamps are present
  if (updatedUser.lastLoginTimestamp === undefined) {
    // initialize timestamp to now - 2 hours for newly seeded accounts
    updatedUser.lastLoginTimestamp = now - (2 * 3600 * 1000);
  }

  // If more than 24 hours passed since lastLoginTimestamp AND we didn't claim today, streak burns!
  const timeDiff = now - updatedUser.lastLoginTimestamp;
  if (timeDiff > TWENTY_FOUR_HOURS_MS && updatedUser.lastClaimedDate !== todayStr && updatedUser.dailyMedalStreak > 0) {
    updatedUser.dailyMedalStreak = 0;
    streakBurned = true;
    triggerHapticNotification('warning');
    await updateProfile({ dailyMedalStreak: 0, lastLoginTimestamp: now });
  }

  const canClaimToday = updatedUser.lastClaimedDate !== todayStr;
  
  // Calculate remaining hours before 24h deadline resets streak (from last check-in)
  const elapsedTime = now - (updatedUser.lastLoginTimestamp || now);
  const remainingMs = Math.max(0, TWENTY_FOUR_HOURS_MS - elapsedTime);
  const hoursUntilExpiration = Number((remainingMs / (1000 * 60 * 60)).toFixed(1));

  return {
    updatedUser,
    streakBurned,
    canClaimToday,
    hoursUntilExpiration: hoursUntilExpiration > 0 ? hoursUntilExpiration : 24
  };
}

// Claim Today's SportBuddy Golden Medal
export async function claimDailyMedal(user: UserProfile): Promise<{
  updatedUser: UserProfile;
  unlockedPremium: boolean;
  message: string;
  promo?: PromoCode;
}> {
  triggerHapticNotification('success');
  const now = Date.now();
  const todayStr = getTodayDateString();

  const newStreak = user.dailyMedalStreak + 1;
  const newTotalMedals = user.totalDailyMedals + 1;
  let unlockedPremium = false;
  let promo: PromoCode | undefined;

  // Rule: 7 medals in a row -> gift a 7-day Premium PROMO CODE
  if (newStreak % 7 === 0) {
    unlockedPremium = true;
    promo = generatePromoCode('streak', 7, user.id, '7 золотых медалей подряд');
  }

  const updatedUser: UserProfile = {
    ...user,
    dailyMedalStreak: newStreak,
    totalDailyMedals: newTotalMedals,
    lastLoginTimestamp: now,
    lastClaimedDate: todayStr
  };

  await updateProfile({
    dailyMedalStreak: newStreak,
    totalDailyMedals: newTotalMedals,
    lastLoginTimestamp: now,
    lastClaimedDate: todayStr
  });

  let message = `🏅 Вы получили Золотую Медаль SportBuddy за сегодняшний вход! Серия: ${newStreak} дн.`;
  if (unlockedPremium && promo) {
    message = `🎉 7 золотых медалей подряд! Вам начислен промокод на 7 дней Premium: ${promo.code}. Активируйте его в профиле!`;
  }

  return { updatedUser, unlockedPremium, message, promo };
}

// Open SportBuddy BOX for completing workout milestones (7, 14, 28)
export async function openSportBuddyBox(user: UserProfile, tierIndex: number): Promise<{
  updatedUser: UserProfile;
  wonItem: RewardItem;
  error?: string;
  promo?: PromoCode;
}> {
  if (IS_TEST_PERIOD_ACTIVE) {
    return {
      updatedUser: user,
      wonItem: {} as RewardItem,
      error: '🎁 Тестовый период: прогресс BOX считается, но призы начнут выдаваться после завершения 30-дневной беты.'
    };
  }

  const tierConfig = SPORTBUDDY_BOX_TIERS[tierIndex];
  if (!tierConfig) {
    return { updatedUser: user, wonItem: {} as RewardItem, error: 'Бокс не найден' };
  }

  if (!isPremiumActive(user)) {
    return { 
      updatedUser: user, 
      wonItem: {} as RewardItem, 
      error: '🔒 Открытие SportBuddy BOX доступно только для пользователей с Premium подпиской!' 
    };
  }

  if (user.totalWorkouts < tierConfig.requiredWorkouts) {
    return {
      updatedUser: user,
      wonItem: {} as RewardItem,
      error: `Для открытия этого бокса нужно выполнить ${tierConfig.requiredWorkouts} тренировок. У вас: ${user.totalWorkouts}.`
    };
  }

  const claimedTiers = user.claimedBoxTiers || [];
  if (claimedTiers.includes(tierConfig.requiredWorkouts)) {
    return {
      updatedUser: user,
      wonItem: {} as RewardItem,
      error: 'Вы уже получили приз из этого SportBuddy BOX!'
    };
  }

  triggerHapticNotification('success');

  // Randomly select one of the high-value Saint Petersburg rewards in this box
  const possible = tierConfig.possibleRewards;
  const selectedReward = possible[Math.floor(Math.random() * possible.length)] || possible[0]!;

  const wonItem: RewardItem = {
    ...selectedReward,
    id: `rew_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    dateEarned: new Date().toLocaleDateString('ru-RU'),
    code: `SPB-${Math.floor(100000 + Math.random() * 900000)}`
  };

  const newClaimedTiers = [...claimedTiers, tierConfig.requiredWorkouts];
  const currentItems = user.rewardItems || [];
  const newRewardItems = [wonItem, ...currentItems];

  // Every SportBuddy BOX also contains a gift promo code with bonus Premium days
  const bonusDays = tierIndex === 0 ? 7 : tierIndex === 1 ? 14 : 30;
  const promo = generatePromoCode('box', bonusDays, user.id, tierConfig.boxName);

  const updatedUser: UserProfile = {
    ...user,
    claimedBoxTiers: newClaimedTiers,
    rewardItems: newRewardItems
  };

  await updateProfile({
    claimedBoxTiers: newClaimedTiers,
    rewardItems: newRewardItems
  });

  return { updatedUser, wonItem, promo };
}

