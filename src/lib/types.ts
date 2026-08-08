export interface RewardItem {
  id: string;
  title: string;
  category: 'ticket' | 'gear' | 'coupon' | 'premium';
  description: string;
  location: string; // e.g. "Санкт-Петербург"
  icon: string;
  dateEarned: string;
  code?: string;
}

export interface BoxTierConfig {
  requiredWorkouts: number;
  title: string;
  boxName: string;
  badge: string;
  possibleRewards: Omit<RewardItem, 'id' | 'dateEarned'>[];
}

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  avatar: string;
  bio: string;
  sports: string[];
  locationName: string;
  lat: number;
  lng: number;
  rating: number;
  totalWorkouts: number;
  totalDailyMedals: number;
  dailyMedalStreak: number;
  activeLooking: boolean;
  likedUserIds: string[];
  matchIds: string[];
  blockedUserIds?: string[];
  subscriptionPlan: 'free' | 'premium';
  premiumTrialEndsAt?: string;
  rewardPremiumEndsAt?: string;
  // Rewards System enhancements:
  lastLoginTimestamp?: number; // timestamp in ms for 24h expiration check
  lastClaimedDate?: string; // YYYY-MM-DD format to prevent multi-claims on same calendar day
  claimedBoxTiers?: number[]; // array of workout tiers opened: [7, 14, 28]
  rewardItems?: RewardItem[]; // inventory of won Saint-Petersburg event tickets and gears
  // Auth & Subscription:
  email?: string;
  registeredAt?: string;
  trialPremiumEndsAt?: string;   // ISO — 30 free days for every new account
  premiumUntil?: string;         // ISO — effective premium expiry (trial + promo days)
  biometricEnabled?: boolean;
  redeemedPromoCodes?: string[];
  // Profile details & anti-fraud (152-ФЗ compliant):
  birthDate?: string;            // ISO yyyy-mm-dd
  hideBirthDate?: boolean;
  /** Gender is chosen once at onboarding and locked afterwards. */
  genderSet?: boolean;       // user may hide it from other athletes
  photoPortfolio?: string[];     // up to 5 sport photos
  hasRealPhoto?: boolean;        // avatar uploaded → account is not deleted
  legalAcceptedAt?: string;      // consent to personal data processing
  phone?: string;
  hidePhone?: boolean;
  // Friends system (Premium only):
  friendIds?: string[];             // mutual friends
  friendRequestsSent?: string[];    // outgoing requests
  friendRequestsReceived?: string[];// incoming requests
  // Verification (photo check within 24h after registration):
  isVerified?: boolean;
  verifiedAt?: string;
  // Interface personalisation (Premium):
  themeAccent?: string;
  themeSurface?: string;
  // Three-tier medal system (bronze → silver → gold):
  medalTier?: 'bronze' | 'silver' | 'gold';
  /** Sample profile shown only while the community is empty.
   *  Never written to Firestore and never counted in the leaderboard. */
  isDemo?: boolean;
  // Presence & geolocation radar:
  hasUsedGeolocation?: boolean;     // device shared location at least once
  lastSeenAt?: number;              // ms timestamp of last activity
  lastGeoAt?: number;               // ms timestamp of last location update
  deviceId?: string;                // registered device fingerprint
  // Participant rating from training organizers (1..5 stars):
  ratingSum?: number;               // sum of all received stars
  ratingCount?: number;             // number of received reviews
  ratingsReceived?: TrainingRating[];
}

export interface TrainingRating {
  id: string;
  trainingId: string;
  trainingTitle: string;
  sport: string;
  organizerId: string;
  organizerName: string;
  organizerAvatar: string;
  participantId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  tags: string[];        // e.g. «Пунктуальный», «Отличная форма»
  comment?: string;
  createdAt: string;
  timestamp: number;
  /** Direction of the review — both sides of a real training are rated. */
  kind?: 'organizer_to_participant' | 'participant_to_organizer';
  /** Modern unambiguous fields (legacy fields above remain for migration). */
  reviewerId?: string;
  reviewerName?: string;
  reviewerAvatar?: string;
  targetUserId?: string;
}

export const RATING_TAGS = [
  'Пунктуальный',
  'Отличная форма',
  'Командный игрок',
  'Мотивирует других',
  'Честная игра',
  'Опоздал',
  'Не пришёл'
] as const;

/* ----------------------------- Check-in on arrival ---------------------------- */

export interface TrainingCheckIn {
  id: string;
  trainingId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  accuracyMeters?: number;
  arrivedAt: string;   // human readable
  timestamp: number;
  note?: string;       // «Я у главного входа»
  verified: boolean;   // within the allowed radius
}

export const ORGANIZER_RATING_TAGS = [
  'Отлично организовано',
  'Понятный план',
  'Хорошая площадка',
  'Дружелюбная атмосфера',
  'Поддерживал группу',
  'Опоздал с началом',
  'Тренировка не состоялась'
] as const;

/** Maximum distance from the training point that counts as "arrived" */
export const CHECKIN_RADIUS_METERS = 300;

export const ARRIVAL_NOTES = [
  'Я у главного входа',
  'Стою у спортплощадки',
  'Жду на парковке',
  'Я на месте, ищу группу',
  'Подхожу, буду через 5 минут'
] as const;

/* --------------------------------- My Goal ---------------------------------- */

export type GoalType = 'workouts' | 'distance' | 'streak' | 'weight' | 'custom';
export type GoalPeriod = 'week' | 'month' | 'quarter' | 'year';

export interface GoalProgressEntry {
  id: string;
  value: number;
  note?: string;
  date: string;
  timestamp: number;
}

export interface PersonalGoal {
  id: string;
  ownerId: string;
  type: GoalType;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  period: GoalPeriod;
  sport?: string;
  createdAt: string;
  deadline: string;      // ISO
  completedAt?: string;
  history: GoalProgressEntry[];
}

/* ------------------------ Official SportBuddy events ------------------------ */

export type EventCategory = 'competition' | 'contest' | 'festival' | 'masterclass' | 'charity';
export type EventStatus = 'draft' | 'published' | 'finished';

export interface OfficialEvent {
  id: string;
  title: string;
  category: EventCategory;
  sport: string;
  description: string;
  /** Short marketing line shown on the card */
  tagline: string;
  coverUrl?: string;
  videoUrl?: string;
  locationName: string;
  address: string;
  lat: number;
  lng: number;
  dateLabel: string;
  time: string;
  participantsMax: number;   // 10..100
  participantIds: string[];
  prizePool?: string;
  entryFee?: string;
  status: EventStatus;
  createdBy: string;
  createdAt: string;
  isOfficial: true;
}

export const EVENT_MIN_PARTICIPANTS = 10;
export const EVENT_MAX_PARTICIPANTS = 100;

export const EVENT_CATEGORIES: { id: EventCategory; label: string; icon: string }[] = [
  { id: 'competition', label: 'Соревнование', icon: '🏆' },
  { id: 'contest',     label: 'Конкурс',      icon: '🎯' },
  { id: 'festival',    label: 'Фестиваль',    icon: '🎉' },
  { id: 'masterclass', label: 'Мастер-класс', icon: '🎓' },
  { id: 'charity',     label: 'Благотворительный забег', icon: '❤️' }
];

/** Only this account can access the admin panel */
export const ADMIN_EMAIL = 'support@sportbuddy78.ru';

export type LeaderboardMetric = 'workouts' | 'streak' | 'boxes' | 'medals';

export interface LeaderboardEntry {
  rank: number;
  user: UserProfile;
  value: number;
  isCurrentUser: boolean;
}

export type ChatCategory = 'matches' | 'friends';

export const MAX_PORTFOLIO_PHOTOS = 5;
export const AVATAR_GRACE_PERIOD_HOURS = 24;

/* --------------------------------- Sports ---------------------------------- */

/** Core disciplines of SportBuddy СПб */
export const SPORTS: string[] = [
  'Бег',
  'Футбол',
  'Теннис',
  'Баскетбол',
  'Падел',
  'Хоккей',
  'Велопрогулка',
  'Воркаут'
];

/** Same list with the "Все" option for filters */
export const SPORT_FILTERS: string[] = ['Все', ...SPORTS];

/** Same list with the "Общее" option for feed posts / events */
export const SPORT_TAGS: string[] = [...SPORTS, 'Общее'];

export const SPORT_ICONS: Record<string, string> = {
  'Бег': '🏃',
  'Футбол': '⚽️',
  'Теннис': '🎾',
  'Баскетбол': '🏀',
  'Падел': '🎾',
  'Хоккей': '🏒',
  'Велопрогулка': '🚴',
  'Воркаут': '🤸',
  'Общее': '🏅'
};

/* ------------------------- Verification & presence -------------------------- */

export type VerificationStepId = 'avatar' | 'portfolio' | 'geo';

export interface VerificationStep {
  id: VerificationStepId;
  label: string;
  description: string;
  icon: string;
  done: boolean;
  /** Optional steps improve discovery but do not block account verification. */
  required?: boolean;
}

export interface VerificationState {
  steps: VerificationStep[];
  isVerified: boolean;
  completedCount: number;
  requiredCount: number;
  requiredCompletedCount: number;
  hoursLeft: number;
  expired: boolean;
}

export type PresenceStatus = 'online' | 'recent' | 'offline';

export interface NearbyAthlete {
  user: UserProfile;
  distanceKm: number;
  presence: PresenceStatus;
  lastSeenLabel: string;
}

/** Search radius for the "people near me" radar */
export const NEARBY_RADIUS_KM = 5;
/** Users active within this window are considered online */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
/** Users active within this window were "recently nearby" */
export const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type PromoSource = 'box' | 'streak' | 'partner';

export interface PromoCode {
  code: string;
  days: number;
  source: PromoSource;
  title: string;
  createdAt: string;
  usedAt?: string;
  ownerId: string;
}

export interface AuthAccount {
  id: string;
  /** Firebase Authentication UID — used as the Firestore document key. */
  firebaseUid?: string;
  name: string;
  /** Set when the account was created through VK ID */
  vkId?: string;
  provider?: 'email' | 'vk';
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  biometricEnabled: boolean;
  /** Chosen at registration; locked forever afterwards. */
  gender?: 'male' | 'female';
}

export interface Training {
  id: string;
  title: string;
  sport: string;
  dateLabel: string;
  time: string;
  locationName: string;
  address: string;
  lat: number;
  lng: number;
  level: 'amateur' | 'semi-pro' | 'pro';
  participantsMax: number;
  participantIds: string[];
  description: string;
  createdBy: string;
  createdAt: string;
  /** Machine-readable date yyyy-mm-dd (calendar + countdown) */
  dateKey?: string;
  // Completion & organizer ratings:
  isCompleted?: boolean;
  completedAt?: string;
  ratedParticipantIds?: string[]; // participants already rated by the organizer
  /** Checked-in participants who submitted their rating of the organizer */
  organizerRatedByParticipantIds?: string[];
  checkedInUserIds?: string[];    // participants who confirmed arrival on site
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorPlan?: 'free' | 'premium';
  sportTag: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  likes: string[]; // User IDs who liked
  commentsCount: number;
  createdAt: string;
  comments?: PostComment[];
}

export type TabType = 'discover' | 'trainings' | 'chats' | 'feed' | 'profile';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string; // human readable label
  timestamp: number;
  read: boolean;
}

export interface ChatThread {
  id: string;              // deterministic: chat_<idA>__<idB>
  participantIds: string[];
  companionId: string;     // the matched partner (not me)
  messages: ChatMessage[];
  lastMessageAt: number;
  createdAt: string;
}

export interface MatchEvent {
  id: string;
  user: UserProfile;
  matchedAt: string;
}

export interface OfflineAction {
  id: string;
  type: 'createTraining' | 'toggleJoinTraining' | 'toggleLikeProfile' | 'createPost' | 'createComment' | 'awardDailyLogin' | 'incrementWorkout' | 'claimSportBuddyBox' | 'resetMedalStreak' | 'updateProfile';
  payload: any;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'match' | 'message' | 'training_reminder' | 'system' | 'reward' | 'checkin' | 'friend_request';
  time: string;
  read: boolean;
  link?: string;
}
