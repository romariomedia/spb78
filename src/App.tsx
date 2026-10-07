import { DistrictSelect } from './components/DistrictSelect';
import { districtLabel, getDistrict, matchesDistrict } from '../shared/districts.js';
import { PhotoEditor } from './components/PhotoEditor';
import { Stories } from './components/Stories';
import { AvatarImage } from './components/AvatarImage';
import { NotificationSettings } from './components/NotificationSettings';
import { startProductAnalytics } from './services/productAnalytics';
import { AppAnnouncements } from './components/AppAnnouncements';
import { subscribeNotifications,restorePush,readNotifications } from './services/notifications';
import { trainingGenderError, trainingGenderLabel } from './lib/trainingEligibility';
import { BetaNotice } from './components/BetaNotice';
import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense, JSX } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  Users, Dumbbell, Newspaper, MapPin, Heart, X as CloseIcon, 
  Filter, Plus, Share2, MessageCircle, Send, Zap, Crown, 
  ChevronRight, Bell, WifiOff, RefreshCw, Sparkles, Search, CheckCheck, Reply, Trash2,
  Map as MapIcon, SlidersHorizontal, CheckCircle2,
  Calendar, ShieldAlert, Clock, Lock, UserPlus
} from 'lucide-react';

import { 
  UserProfile, Training, FeedPost, TabType, AppNotification, ChatThread, ChatMessage 
} from './lib/types';
import {
  loadChatThreads, sendChatMessage, sendTrainingGroupMessage, ensureTrainingGroupChat, markThreadAsRead, countUnread, deleteChatMessage, setChatTyping,
  buildChatId, clearChatCache, formatTimeLabel, getReportableChatThreads, loadChatHistory, subscribeChatThreads
} from './services/chats';
import { 
  loadAppData, loadFeedPosts, createTraining, toggleJoinTraining, toggleLikeProfile, 
  createPost, createComment, toggleLikePost, PremiumTrainingRequiredError,
  updateProfile, syncOfflineQueue, persistFreshProfile, setCurrentUserId, CURRENT_USER_ID, getOfflineQueue 
} from './services/repository';
import { getCurrentCoords, calculateDistanceKm, Coords, DEFAULT_COORDS } from './services/geolocation';
import { getAddressFromCoords } from './services/geocoding';
import {
  uploadToCloudinary, uploadMedia, uploadRemoteUrl,
  avatarUrl, photoUrl, cldUrl, videoPoster, CloudinaryUploadError
} from './services/cloudinary';
import { joinedTrainingIds } from './services/dataLoading';
import { subscribeAppInvalidation } from './services/realtime';
import { 
  triggerHapticImpact, triggerHapticNotification, takeAvatarPhoto,
  pickPhotoFromGallery, shareContent, setupDeepLinkListener, launchMatchConfetti,
  generateDemoNotifications, sendLocalNotification
} from './services/native';
import { isNativeApp } from './services/media';

import { AuthAccount } from './lib/types';
import { getSessionAccount, logout as clearLocalAuthSession, removeLocalAccount } from './services/auth';
import { signOutTransport, ensureTransportSession } from './lib/firebase';
import { authReady, getFirebaseUid, signOutFirebase } from './services/firebaseAuth';
import { createFreshProfile } from './services/reset';
import { setJoinedTraining, clearJoinedTrainings } from './services/memberships';
import { syncSubscriptionPlan, isPremiumActive } from './services/promo';
import { AuthScreen } from './components/AuthScreen';
import { SuccessScreen } from './components/SuccessScreen';
import { PromoSection } from './components/PromoSection';
import { ProfileEditor } from './components/ProfileEditor';
import { LegalSection } from './components/LegalSection';
import { PricingSection } from './components/PricingSection';
import { LivePhoto } from './components/LivePhoto';
import { Leaderboard } from './components/Leaderboard';
import { AmbientBackdrop } from './components/AmbientBackdrop';
import { FriendsSection } from './components/FriendsSection';
import { RateParticipantsModal } from './components/RateParticipantsModal';
import { RateOrganizerModal } from './components/RateOrganizerModal';
import { CheckInPanel } from './components/CheckInPanel';
import { GoalsSection } from './components/GoalsSection';
import { buildArrivalNotification, getMyCheckIn } from './services/checkin';
import { MATCH_SAFETY_REMINDER, UNSAFE_SUGGESTION_WARNING } from './legal/terms';
import { MedalsSection } from './components/MedalsSection';
import { ProfileSummary } from './components/ProfileSummary';
import { SportPassportCard } from './components/SportPassportCard';
import { SportPassportView } from './components/SportPassportView';
import { Virtuoso } from 'react-virtuoso';
import { TrainingCard } from './components/TrainingCard';
import { PostCard } from './components/PostCard';
import { ProfileStatsSection } from './components/ProfileStatsSection';
import { TrainingCalendar } from './components/TrainingCalendar';
import { UpcomingTrainings } from './components/UpcomingTrainings';
import {
  getTrainingDayKey, toDayKey, formatDayLabel, formatFullDate,
  getDueReminders, markReminderSent, getCountdown, formatCountdown, getActiveTrainings
} from './services/schedule';
import { claimDailyMedal, medalDayKey, syncProfileMedals } from './services/medals';
import { WorkoutProgress } from './components/WorkoutProgress';
import { ThemeSection } from './components/ThemeSection';
import { ThemePreferences } from './lib/themes';
import { isBetaActive, TEST_PERIOD_MESSAGE } from './lib/release';
import { initTheme, resetTheme } from './services/theme';
import { NearbyRadar } from './components/NearbyRadar';
import { VerificationCard } from './components/VerificationCard';
import { VerificationStepId, SPORTS, SPORT_FILTERS, SPORT_TAGS } from './lib/types';
import { getVerificationState, syncVerification, deleteExpiredUnverifiedProfile } from './services/verification';
import { seedPresence, registerMyPresence } from './services/presence';
import { OfficialEvents } from './components/OfficialEvents';
import { OfficialEvent } from './lib/types';
import {
  isAdmin, toggleEventRegistration, isRegistered,
  getCategoryConfig, eventFillPercent, refreshEvents
} from './services/events';
import { clearAdminSession } from './services/adminAuth';
import { checkMessageForUnsafeSuggestion, SAFETY_BANNER_TIMEOUT_MS } from './services/safety';
import { RatingSection } from './components/RatingSection';
import { ComplaintModal } from './components/ComplaintModal';
import { StarRating } from './components/StarRating';
import {
  completeTraining, isOrganizer, pendingRatings,
  pendingOrganizerRatings, getTrainingsAwaitingRating, computeAverageRating
} from './services/ratings';
import { creditWorkout, formatCooldown, msUntilNextCredit, refreshWorkoutCredits } from './services/workoutLog';
import { refreshRatings } from './services/ratings';
import { refreshMyCheckIns } from './services/checkin';
import { ChatCategory } from './lib/types';
import {
  initFriendsState, getFriendStatus, sendFriendRequest,
  acceptFriendRequest, cancelFriendRequest
} from './services/friends';
import { subscribeIncomingFriendRequests, subscribeOutgoingFriendRequests, subscribeFriendships } from './services/friendRealtime';
import { hasPersonalPhoto, hoursUntilDeletion, calculateAge, formatBirthDate, getDiscoveryPhoto } from './services/profile';
import { BottomNav } from './components/BottomNav';
import { Modal } from './components/Modal';
import { ProgressBar } from './components/ProgressBar';
import { RewardsSection } from './components/RewardsSection';
import { WelcomeGuide, hasSeenWelcomeGuide, markWelcomeGuideSeen } from './components/WelcomeGuide';
import { PlacesSection } from './components/PlacesSection';
const LeisureSection = lazy(() => import('./components/LeisureSection'));
import { SportVenue } from './lib/venues';

/* Тяжёлые экраны грузятся по требованию: карта (~45 КБ gzip), админка
   и студия эфира не нужны при первом рендере. */
const LeafletMap = lazy(() => import('./components/LeafletMap').then(m => ({ default: m.LeafletMap })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const LiveBroadcast = lazy(() => import('./components/LiveBroadcast').then(m => ({ default: m.LiveBroadcast })));
const AdminAccessModal = lazy(() => import('./components/AdminAccessModal').then(m => ({ default: m.AdminAccessModal })));

/** Скелетон карты вместо прыжка layout при подгрузке чанка. */
const MapFallback: React.FC<{ height?: string }> = ({ height = '380px' }) => (
  <div
    style={{ height }}
    className="flex w-full items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60"
  >
    <span className="animate-pulse text-xs font-bold text-slate-500">Загрузка карты…</span>
  </div>
);

/**
 * Vertical gap between virtualised cards.
 * Defined outside the component so Virtuoso keeps the same reference and
 * never remounts rows on re-render.
 */
const VirtuosoSpacedItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children, ...props
}) => (
  <div {...props} className="pb-3">
    {children}
  </div>
);

/** Shown by Virtuoso when the feed has no posts yet */
const FeedEmptyPlaceholder: React.FC = () => (
  <div className="text-center py-12 px-4 bg-slate-900/50 rounded-3xl border border-slate-800 text-slate-400">
    <Newspaper className="w-12 h-12 text-slate-600 mx-auto mb-2 opacity-60" />
    <p className="font-semibold text-sm">В ленте пока пусто</p>
    <p className="text-xs mt-1">
      Публикуйте фото с тренировок и ведите трансляции — станьте первым!
    </p>
  </div>
);

/** Локальная заглушка: внешний Unsplash-фолбэк не работал офлайн. */
const AVATAR_FALLBACK = '/avatar-placeholder.svg';

export default function App(): JSX.Element {
  // Auth State
  const [account, setAccount] = useState<AuthAccount | null>(() => getSessionAccount());
  const [authNotice, setAuthNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadWarning, setLoadWarning] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(() => window.location.pathname === '/success');
  const [welcomeTrialShown, setWelcomeTrialShown] = useState<boolean>(false);
  // Set before async loading starts so a fresh registration can never inherit
  // stale cache/Firestore aggregates from a previous device user.
  const freshAccountRef = useRef<{ account: AuthAccount; vkAvatar?: string } | null>(null);

  // App Core State
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [leisureEventId, setLeisureEventId] = useState('');
  const [direction, setDirection] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(getOfflineQueue().length);

  // Data Store
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [userCoords, setUserCoords] = useState<Coords>(DEFAULT_COORDS);
  const [hasCurrentLocation, setHasCurrentLocation] = useState(false);
  const [userLocationLabel, setUserLocationLabel] = useState<string>('Определение локации...');

  // Discovery Filter & View State
  const [discoverSportFilter, setDiscoverSportFilter] = useState<string>('Все');
  const [discoverViewMode, setDiscoverViewMode] = useState<'cards' | 'map' | 'nearby'>('cards');
  const [isLocating, setIsLocating] = useState(false);
  const [swipedIds, setSwipedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('sportbuddy_swiped_ids_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Фильтруем старые свайпы (старше 24 часов)
        const now = Date.now();
        const valid = Object.entries(parsed)
          .filter(([_, timestamp]) => now - Number(timestamp) < 24 * 60 * 60 * 1000)
          .map(([id]) => id);
        return valid;
      }
    } catch {
      /* ignore */
    }
    return [];
  });
  const [matchedUser, setMatchedUser] = useState<UserProfile | null>(null);
  const [selectedUserModal, setSelectedUserModal] = useState<UserProfile | null>(null);

  // Training Creation & Filter State
  const [trainingDistrictFilter, setTrainingDistrictFilter] = useState('');
  const [newTrDistrict, setNewTrDistrict] = useState('');
  const [trainingSportFilter, setTrainingSportFilter] = useState<string>('Все');
  const [trainingLevelFilter, setTrainingLevelFilter] = useState<'all' | 'amateur' | 'semi-pro' | 'pro'>('all');
  const [calendarDay, setCalendarDay] = useState<string | null>(null);
  // Bumps whenever the authenticated athlete joins/leaves a real training.
  const [onlyMyTrainings, setOnlyMyTrainings] = useState<boolean>(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [isCreateTrainingOpen, setIsCreateTrainingOpen] = useState<boolean>(false);

  // Create Training Form Fields
  const [newTrTitle, setNewTrTitle] = useState('');
  const [newTrSport, setNewTrSport] = useState('Бег');
  const [newTrDate, setNewTrDate] = useState(() =>
    toDayKey(new Date(Date.now() + 24 * 60 * 60 * 1000))
  );
  const [newTrTime, setNewTrTime] = useState('10:00');
  const [newTrLevel, setNewTrLevel] = useState<'amateur' | 'semi-pro' | 'pro'>('amateur');
  const [newTrMax, setNewTrMax] = useState(10);
  const [newTrGender, setNewTrGender] = useState<'any' | 'male' | 'female'>('any');
  const [newTrDesc, setNewTrDesc] = useState('');
  const [newTrCoords, setNewTrCoords] = useState<Coords>(DEFAULT_COORDS);
  const [newTrLocationSelected, setNewTrLocationSelected] = useState(false);
  const [newTrAddress, setNewTrAddress] = useState('Локация на карте');
  const [newTrCity, setNewTrCity] = useState('Санкт-Петербург');
  const [isMapSelectorOpen, setIsMapSelectorOpen] = useState(false);
  const [isPlacesOpen, setIsPlacesOpen] = useState(false);
  const [selectedVenueForTraining, setSelectedVenueForTraining] = useState<SportVenue | null>(null);
  const [venueRentalConfirmed, setVenueRentalConfirmed] = useState(false);

  // Feed State
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postSportTag, setPostSportTag] = useState('Общее');
  const [editingFeedPhoto, setEditingFeedPhoto] = useState<File | null>(null);
  const [postMediaUrl, setPostMediaUrl] = useState('');
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Chats State (Premium only)
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [allChatThreads, setAllChatThreads] = useState<ChatThread[]>([]);
  const [chatCategory, setChatCategory] = useState<ChatCategory>('matches');
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatMessagesOffline, setChatMessagesOffline] = useState(false);
  const [chatReplyTarget, setChatReplyTarget] = useState<ChatMessage | null>(null);
  const [chatDeleteTargetId, setChatDeleteTargetId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [complaintContactId, setComplaintContactId] = useState<string | undefined>();
  // Safety banner shown when a companion suggests a non-sport meeting
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);

  // Profile & Notifications
  const [localNotifications, setLocalNotifications] = useState<AppNotification[]>(() => import.meta.env.DEV ? generateDemoNotifications() : []);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [serverNotifications,setServerNotifications]=useState<AppNotification[]>([]);
  const [notificationsOffline,setNotificationsOffline]=useState(false);
  const notifications=[...serverNotifications,...localNotifications.filter(n=>!serverNotifications.some(x=>x.id===n.id))];
  useEffect(()=>{
    setServerNotifications([]);setLocalNotifications([]);
    if(!currentUser?.id)return;
    void restorePush(currentUser.id).catch(()=>undefined);
    return subscribeNotifications(currentUser.id,setServerNotifications,setNotificationsOffline);
  },[currentUser?.id]);

  useEffect(()=>{
    if(!currentUser?.id)return;
    return startProductAnalytics(currentUser.id);
  },[currentUser?.id]);

  const [rewardModal, setRewardModal] = useState<{ title: string; subtitle: string; content: React.ReactNode } | null>(null);
  // Refresh date-based feature gates even when the app stays open across midnight.
  const [, refreshAccessClock] = useState(0);
  useEffect(() => {
    const refresh = () => refreshAccessClock(v => v + 1);
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  // Server transaction makes retries and concurrent tabs safe. Calendar follows Moscow.
  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    let pending = false;
    const check = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      if (currentUser.medalProgress?.lastClaimDayKey === medalDayKey()) return;
      pending = true;
      const result = await claimDailyMedal(currentUser);
      pending = false;
      if (!cancelled && result.ok) setCurrentUser(previous => previous?.id === currentUser.id
        ? syncProfileMedals({...previous, medalProgress:result.progress}) : previous);
    };
    void check();
    const timer = window.setInterval(check, 60000);
    const visible = () => { void check(); };
    document.addEventListener('visibilitychange', visible);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [currentUser?.id, currentUser?.medalProgress?.lastClaimDayKey]);

  const [profileSection, setProfileSection] = useState<'overview' | 'passport' | 'edit' | 'tariff' | 'legal'>('overview');
  const [versionTapCount, setVersionTapCount] = useState(0);
  // Interface personalisation — applied on first render
  const [theme, setTheme] = useState<ThemePreferences>(() => initTheme());
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [ratingTraining, setRatingTraining] = useState<Training | null>(null);
  const [organizerRatingTraining, setOrganizerRatingTraining] = useState<Training | null>(null);
  const [isComplaintOpen, setIsComplaintOpen] = useState(false);
  // Official SportBuddy events & admin panel
  const [selectedEvent, setSelectedEvent] = useState<OfficialEvent | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminAccessOpen, setIsAdminAccessOpen] = useState(false);
  const [adminSessionVersion, setAdminSessionVersion] = useState(0);
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0);
  const mediaInputRef = React.useRef<HTMLInputElement>(null);

  /* --- Загрузка медиа: прогресс, отмена, подпись, неблокирующие тосты --- */
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => uploadAbortRef.current?.abort(), []);

  // Модалка подписи вместо window.prompt: в iOS WebView и PWA prompt блокируется
  const [pendingMedia, setPendingMedia] = useState<{ file: File; isVideo: boolean } | null>(null);
  const [pendingCaption, setPendingCaption] = useState('');
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const notify = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ text, kind });
    triggerHapticNotification(kind === 'ok' ? 'success' : 'warning');
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  // Предпросмотр через objectURL — освобождаем, иначе утечка памяти
  useEffect(() => {
    if (!pendingMedia) { setPendingPreview(null); return; }
    const url = URL.createObjectURL(pendingMedia.file);
    setPendingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingMedia]);

  // A new application launch is treated as a new admin login attempt.
  // The owner must request a fresh 4-digit e-mail code before event management.
  useEffect(() => {
    clearAdminSession();
    setAdminSessionVersion((v) => v + 1);
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await authReady;
      const firebaseUid = getFirebaseUid();
      // Ensure every repository call is scoped to the actual logged-in account,
      // not the old shared demo identity.
      const activeSession = getSessionAccount();
      if (firebaseUid) setCurrentUserId(firebaseUid);
      else if (activeSession) setCurrentUserId(activeSession.firebaseUid ?? activeSession.id);
      const data = await loadAppData();
      if (getSessionAccount()?.id !== activeSession?.id) return;
      void refreshWorkoutCredits(CURRENT_USER_ID).catch(() => {});
      void refreshRatings(CURRENT_USER_ID).catch(() => {});
      void refreshMyCheckIns(CURRENT_USER_ID).catch(() => {});

      // Merge the authenticated account into the profile and apply subscription rules
      let profile = data.currentUser;
      const session = activeSession ?? getSessionAccount();
      const freshAccount = freshAccountRef.current;
      const isFreshAccount = Boolean(freshAccount);

      if (freshAccount && data.profileMissing) {
        // A brand-new athlete has no historical workouts, medals, ratings,
        // rewards, friends, chats or pre-existing training attendance.
        profile = createFreshProfile(CURRENT_USER_ID, {
          ...data.currentUser,
          name: freshAccount.account.name,
          email: freshAccount.account.email,
          avatar: freshAccount.vkAvatar || '',
          hasRealPhoto: Boolean(freshAccount.vkAvatar),
          registeredAt: freshAccount.account.createdAt,
          // Gender chosen at registration is locked; VK logins confirm it in
          // the onboarding gate right after the first login.
          ...(freshAccount.account.gender
            ? { gender: freshAccount.account.gender, genderSet: true }
            : { genderSet: false }),
          // VK ID accounts are fully verified on arrival: VK already proved
          // identity and supplies a real photo. E-mail signups keep the
          // standard photo + portfolio verification within 24 hours.
          ...(freshAccount.account.provider === 'vk'
            ? {
                isVerified: true,
                hasRealPhoto: true,
                verifiedAt: new Date().toISOString()
              }
            : {})
        });
        clearJoinedTrainings(freshAccount.account.id);
      }

      if (session) {
        profile = { ...profile, name: session.name, email: session.email };
        // VK ID accounts arrive fully verified with a real photo attached.
        if (session.provider === 'vk') {
          profile = {
            ...profile,
            hasRealPhoto: true,
            isVerified: true,
            verifiedAt: profile.verifiedAt || new Date().toISOString()
          };
        }
        if (isFreshAccount) {
          setWelcomeTrialShown(true);
        }
      }
      profile = syncSubscriptionPlan(profile);
      profile = initFriendsState(profile, data.allUsers);
      // Recalculate medal totals & tier (burns the cycle if a day was missed)
      profile = syncProfileMedals(profile);

      // Do not keep an expired unverified athlete in the application. This is
      // immediate on return to the app; Cloud Scheduler handles inactive users.
      if (getVerificationState(profile).expired) {
        await deleteExpiredUnverifiedProfile(profile);
        // Remove the local mirror too so the person can register again as a
        // brand-new user with the same e-mail afterwards.
        if (session) removeLocalAccount(session.id);
        clearLocalAuthSession();
        void signOutFirebase();
        void signOutTransport();
        setAuthNotice('Аккаунт удалён: верификация с личным фото и портфолио не была завершена в течение 24 часов.');
        setAccount(null);
        setCurrentUser(null);
        return;
      }

      // Create the new account profile through Vercel. The server returns the
      // authoritative profile, including the one-time 30-day welcome Premium.
      if (freshAccount || data.profileMissing) {
        (profile as UserProfile & { provider?: string }).provider = session?.provider === 'vk' ? 'vk' : 'email';
        profile = await persistFreshProfile(profile);
        freshAccountRef.current = null;
        profile = initFriendsState(profile, data.allUsers);
        profile = syncProfileMedals(profile);
      }

      setCurrentUser(profile);
      setAllUsers(data.allUsers.map(u => (u.id === profile.id ? profile : u)));
      // Server participantIds are shared across devices; local journals cannot override them.
      setTrainings(getActiveTrainings(data.trainings));
      setLoadError('');
      setLoadWarning(data.loadWarning ?? '');
      setFeedPosts(data.feedPosts);
      setIsOffline(data.isOffline);
      setPendingSyncCount(getOfflineQueue().length);
    } catch (err) {
      console.error('Data loading failure:', err);
      setLoadError('Не удалось загрузить данные. Проверьте соединение и повторите попытку.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [account?.id]);

  /**
   * Realtime Firestore invalidation: posts, profiles and trainings published
   * by other devices appear without a manual reload. Repository remains the
   * sole normalizer/cache layer, so this listener stays intentionally thin.
   *
   * Если изменилась только лента (чужие лайки, комментарии, публикации),
   * перечитываем лишь её: полный fetchAllData() читал бы профиль, всех
   * пользователей, тренировки и приватные поля при каждом лайке.
   */
  useEffect(() => {
    if (!account) return;
    const unsubscribe = subscribeAppInvalidation((sections) => {
      if (document.visibilityState === 'hidden') return;
      const feedOnly = sections.size === 1 && sections.has('feed');
      if (feedOnly) {
        void loadFeedPosts().then(setFeedPosts).catch(() => undefined);
        return;
      }
      void fetchAllData();
    });
    return unsubscribe;
  }, [account?.id, fetchAllData]);

  /**
   * Приветственное окно о возможностях проекта.
   *
   * Показывается один раз на устройстве и только после того, как закрыт экран
   * первого входа, — иначе два окна наложились бы друг на друга. Повторно
   * открыть его можно кнопкой со звёздочкой в шапке.
   */
  useEffect(() => {
    if (!currentUser || isLoading || welcomeTrialShown) return;
    if (hasSeenWelcomeGuide()) return;
    setIsGuideOpen(true);
  }, [currentUser, isLoading, welcomeTrialShown]);

  const closeGuide = useCallback(() => {
    setIsGuideOpen(false);
    markWelcomeGuideSeen();
  }, []);

  // Swipe Card gesture tracking
  const dragX = useMotionValue(0);
  const rotate = useTransform(dragX, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(dragX, [20, 150], [0, 1]);
  const skipOpacity = useTransform(dragX, [-150, -20], [1, 0]);

  // 1. Initial Load & Geolocation & Deep Links


  const handleAuthenticated = (
    authAccount: AuthAccount,
    isNewAccount: boolean,
    vkAvatar?: string
  ) => {
    // A fresh application login always requires a fresh admin OTP.
    clearAdminSession();
    setAdminSessionVersion((v) => v + 1);
    setCurrentUserId(authAccount.firebaseUid ?? authAccount.id);
    if (isNewAccount) {
      freshAccountRef.current = { account: authAccount, vkAvatar };
    }
    setAccount(authAccount);
    setWelcomeTrialShown(false);
    setIsLoading(true);
    // VK ID already supplies a real photo — counts towards verification
    if (vkAvatar) {
      void updateProfile({ avatar: vkAvatar, hasRealPhoto: true }).catch(() => {
        // The fresh-profile bootstrap retry will persist this on the next sync.
      });
    }
    fetchAllData();
  };

  // Gender onboarding: chosen once after the first login, locked afterwards.
  const [pendingGender, setPendingGender] = useState<'male' | 'female' | null>(null);
  const needsGenderGate = Boolean(account && currentUser && currentUser.genderSet === false);

  const confirmGender = async () => {
    if (!currentUser || !pendingGender) return;
    const next: UserProfile = { ...currentUser, gender: pendingGender, genderSet: true };
    setCurrentUser(next);
    setAllUsers(prev => prev.map(u => (u.id === next.id ? next : u)));
    await updateProfile({ gender: pendingGender, genderSet: true }).catch(() => {
      /* offline-first */
    });
    triggerHapticNotification('success');
    setPendingGender(null);
  };

  const handleLogout = () => {
    // Full local reset: session, admin OTP session and app state.
    // Firebase identity (e-mail or transport) is dropped in the background.
    if(currentUser?.id)clearChatCache(currentUser.id);
    clearAdminSession();
    clearLocalAuthSession();
    void signOutFirebase();
    void signOutTransport();
    setAccount(null);
    setCurrentUser(null);
    setAllUsers([]);
    setTrainings([]);
    setFeedPosts([]);
    setChatThreads([]);
    setAllChatThreads([]);
    setLocalNotifications(import.meta.env.DEV ? generateDemoNotifications() : []);
    setActiveTab('discover');
    setProfileSection('overview');
    setOpenChatId(null);
    setSelectedTraining(null);
  };

  const handlePaymentSuccessContinue = () => {
    window.history.replaceState({}, '', '/');
    setPaymentSuccess(false);
    setActiveTab('profile');
    void fetchAllData();
  };

  const handleVersionTap = () => {
    setVersionTapCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        triggerHapticNotification('success');
        setIsAdminAccessOpen(true);
        notify('Секретный вход в админку открыт 🔑');
        console.log('Secret trigger activated', versionTapCount);
        return 0;
      }
      triggerHapticImpact('light');
      return next;
    });
  };

  useEffect(() => {
    // Re-establish the silent Firestore transport identity for returning users
    // (VK ID already mints a custom token during login). Never blocks the UI.
    void ensureTransportSession();

    fetchAllData();

    // Hard failsafe: the splash screen must never block the app, even on a stalled network
    const splashFailsafe = setTimeout(() => {
      setIsLoading(false);
      setIsRefreshing(false);
    }, 6000);

    // Setup Geolocation
    getCurrentCoords().then(async (coords) => {
      setUserCoords(coords);
      setHasCurrentLocation(true);
      // Register this device on the radar and scatter the community around it
      setAllUsers(prev => (prev.length > 0 ? seedPresence(prev, coords) : prev));
      try {
        const addr = await getAddressFromCoords(coords.lat, coords.lng);
        setUserLocationLabel(addr.shortAddress || 'Санкт-Петербург');
      } catch {
        setUserLocationLabel('Местоположение определено');
      }
    }).catch(() => {
      setHasCurrentLocation(false);
      setUserLocationLabel('Геолокация не определена');
    });

    // Deep Link Listener: trainings + VK ID OAuth callback.
    // The browser version keeps its existing redirect; only native Android
    // receives the App Link and forwards code/device_id to AuthScreen.
    const removeLinkListener = setupDeepLinkListener(
      (trainingId) => {
        loadAppData().then(data => {
          const found = data.trainings.find(t => t.id === trainingId);
          if (found) {
            setSelectedTraining(found);
            setActiveTab('trainings');
          }
        });
      },
      (code, deviceId) => {
        window.dispatchEvent(new CustomEvent('vk-oauth-callback', {
          detail: { code, device_id: deviceId }
        }));
      }
    );

    // Network status monitoring
    const handleOnline = async () => {
      setIsOffline(false);
      const count = await syncOfflineQueue();
      if (count > 0) {
        setPendingSyncCount(0);
        triggerHapticNotification('success');
        fetchAllData();
      }
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(splashFailsafe);
      removeLinkListener();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTabChange = (newTab: TabType) => {
    const tabOrder: TabType[] = ['discover', 'trainings', 'leisure', 'chats', 'feed', 'profile'];
    const oldIdx = tabOrder.indexOf(activeTab);
    const newIdx = tabOrder.indexOf(newTab);
    setDirection(newIdx > oldIdx ? 1 : -1);
    setActiveTab(newTab);
    if (newTab !== 'chats') setOpenChatId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isPremium = currentUser ? isPremiumActive(currentUser) : false;
  /** Feed posts, gallery media and broadcasts require Premium + trusted verification. */
  const canPublishToFeed = isPremium && currentUser?.isVerified === true;

  const requirePublishingVerification = (): boolean => {
    if (!currentUser) return false;
    if (!isPremium) {
      notify('Публикации доступны с Premium-статусом.', 'err');
      setProfileSection('tariff');
      handleTabChange('profile');
      return false;
    }
    if (!currentUser.isVerified) {
      notify('Завершите верификацию: личное фото + одно фото в портфолио.', 'err');
      setProfileSection('edit');
      setActiveTab('profile');
      return false;
    }
    return true;
  };

  // Refresh chat threads whenever matches, friends or category change
  useEffect(() => {
    if (!currentUser) return;
    const selected=loadChatThreads(currentUser, allUsers, chatCategory);
    setChatThreads(selected);
    const combined=[...loadChatThreads(currentUser,allUsers,'matches'),...loadChatThreads(currentUser,allUsers,'friends')];
    setAllChatThreads([...new Map(combined.map(thread=>[thread.id,thread])).values()].sort((a,b)=>b.lastMessageAt-a.lastMessageAt));
  }, [currentUser, allUsers, chatCategory]);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeChatThreads(currentUser, chatCategory, setChatThreads, setAllChatThreads);
  }, [currentUser, chatCategory]);

  useEffect(() => {
    if (!currentUser || !openChatId) {
      setChatMessagesOffline(false);
      return;
    }
    const thread=chatThreads.find(item=>item.id===openChatId);
    if(!thread || (!thread.messageCount && thread.messages.length===0)) {
      setChatMessagesOffline(false);
      return;
    }
    let cancelled=false;
    void loadChatHistory(openChatId,currentUser.id)
      .then(messages=>{
        if(cancelled)return;
        setChatMessagesOffline(false);
        setChatThreads(previous=>previous.map(item=>item.id===openChatId?{...item,messages}:item));
      })
      .catch(()=>{if(!cancelled)setChatMessagesOffline(true);});
    return ()=>{cancelled=true;};
  }, [currentUser?.id, openChatId]);

  useEffect(() => {
    if (!openChatId) return;
    const frame=requestAnimationFrame(()=>chatScrollRef.current?.scrollTo({top:chatScrollRef.current.scrollHeight,behavior:'smooth'}));
    return ()=>cancelAnimationFrame(frame);
  }, [openChatId, chatThreads.find(thread=>thread.id===openChatId)?.messages.length]);

  const [friendSyncErrors, setFriendSyncErrors] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.id;
    setFriendSyncErrors({});
    const error = (key: string) => (failed: boolean) => setFriendSyncErrors(previous => ({...previous, [key]: failed}));
    const patch = (updates: Partial<UserProfile>) => setCurrentUser(previous => previous?.id === uid ? {...previous, ...updates} : previous);
    const stops = [
      subscribeIncomingFriendRequests(uid, requests => patch({friendRequestsReceived: requests.map(r => r.fromId)}), error('incoming')),
      subscribeOutgoingFriendRequests(uid, requests => patch({friendRequestsSent: requests.map(r => r.toId)}), error('outgoing')),
      subscribeFriendships(uid, friendIds => patch({friendIds}), error('friends'))
    ];
    return () => stops.forEach(stop => stop());
  }, [currentUser?.id]);

  // Scan the latest incoming message for unsafe (non-sport) meeting suggestions
  useEffect(() => {
    if (!openChatId) {
      setSafetyWarning(null);
      return;
    }
    const thread = chatThreads.find(t => t.id === openChatId);
    const last = thread?.messages[thread.messages.length - 1];
    if (!last || last.senderId === CURRENT_USER_ID) return;
    if (!last.read && document.visibilityState === 'visible') {
      void markThreadAsRead(openChatId).catch(() => undefined);
    }

    if (checkMessageForUnsafeSuggestion(last.text)) {
      setSafetyWarning(UNSAFE_SUGGESTION_WARNING);
      triggerHapticNotification('warning');
    }
  }, [chatThreads, openChatId]);

  // Auto-dismiss the safety banner after 10 seconds
  useEffect(() => {
    if (!safetyWarning) return;
    const timer = setTimeout(() => setSafetyWarning(null), SAFETY_BANNER_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [safetyWarning]);

  useEffect(()=>{
    if(!openChatId||!currentUser)return;
    if(!chatDraft.trim()){
      void setChatTyping(openChatId,false).catch(()=>undefined);
      return;
    }
    const start=window.setTimeout(()=>void setChatTyping(openChatId,true).catch(()=>undefined),250);
    const stop=window.setTimeout(()=>void setChatTyping(openChatId,false).catch(()=>undefined),3200);
    return ()=>{clearTimeout(start);clearTimeout(stop);};
  },[openChatId,currentUser?.id,chatDraft]);

  useEffect(()=>{
    setChatReplyTarget(null);
    setChatDeleteTargetId(null);
  },[openChatId]);

    const friendsCount = (currentUser?.friendIds || []).length;
  const friendRequestsCount = (currentUser?.friendRequestsReceived || []).length;

  const chatUnreadCount = useMemo(() => (isPremium ? countUnread(allChatThreads) : 0), [allChatThreads, isPremium]);
  const visibleChatThreads = useMemo(() => {
    const needle=chatSearch.trim().toLowerCase();
    if(!needle)return chatThreads;
    return chatThreads.filter(thread=>{
      const companion=allUsers.find(user=>user.id===thread.companionId);
      const last=thread.messages[thread.messages.length-1];
      return [thread.trainingTitle,thread.trainingSport,companion?.name,companion?.sports?.join(' '),last?.text].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  },[chatThreads,chatSearch,allUsers]);

  /** Contacts eligible for a safety report: only real chats with messages. */
  const reportableChatContacts = useMemo(() => {
    if (!currentUser) return [];
    return getReportableChatThreads(currentUser.id).flatMap((thread) => {
      const contactId = thread.participantIds.find((id) => id !== currentUser.id);
      const user = allUsers.find((candidate) => candidate.id === contactId);
      return user ? [{ user, thread }] : [];
    });
  }, [currentUser, allUsers, chatThreads]);

  const [friendsNotificationVersion,setFriendsNotificationVersion]=useState(0);
  const [pendingNotificationLink,setPendingNotificationLink]=useState(()=>window.location.hash);
  useEffect(()=>{
    const hash=()=>setPendingNotificationLink(window.location.hash);
    const message=(e:MessageEvent)=>{if(e.data?.type==='sportbuddy-open-notification'&&typeof e.data.link==='string')setPendingNotificationLink(e.data.link);};
    window.addEventListener('hashchange',hash);navigator.serviceWorker?.addEventListener('message',message);
    return()=>{window.removeEventListener('hashchange',hash);navigator.serviceWorker?.removeEventListener('message',message);};
  },[]);
  useEffect(()=>{
    if(!currentUser||!pendingNotificationLink)return;
    const link=pendingNotificationLink;
    if(link.startsWith('#chat=')){
      let id;try{id=decodeURIComponent(link.slice(6));}catch{return;}
      setActiveTab('chats');
      const category:ChatCategory=id.startsWith('training_')?'trainings':(currentUser.friendIds||[]).some(friend=>buildChatId(currentUser.id,friend)===id)?'friends':'matches';
      if(chatCategory!==category){setChatCategory(category);return;}
      if(!chatThreads.some(t=>t.id===id))return;
      setOpenChatId(id);
    }else if(link.startsWith('#training=')){
      let id;try{id=decodeURIComponent(link.slice(10));}catch{return;}
      setActiveTab('trainings');const training=trainings.find(t=>t.id===id);if(!training)return;setSelectedTraining(training);
    }else if(link==='#profile-friends'){try{localStorage.setItem('sportbuddy_profile_friends_open_v1','1');}catch{/* UI preference only */}setFriendsNotificationVersion(v=>v+1);setProfileSection('overview');setActiveTab('profile');setTimeout(()=>document.getElementById('profile-friends')?.scrollIntoView({behavior:'smooth'}),100);}
    else if(link.startsWith('#event=')){
      let id;try{id=decodeURIComponent(link.slice(7));}catch{return;}
      setActiveTab('trainings');
      void refreshEvents().then(events=>{const event=events.find(e=>e.id===id&&e.status==='published');if(event)setSelectedEvent(event);else notify('Событие больше недоступно','err');}).catch(()=>notify('Не удалось открыть событие','err'));
    }
    else if(link.startsWith('#leisure=')){try{setLeisureEventId(decodeURIComponent(link.slice(9)));setActiveTab('leisure');}catch{/* malformed link */}}
    else if(link==='#events')setActiveTab('trainings');
    else if(link==='#notifications')setIsNotifModalOpen(true);
    setPendingNotificationLink('');
  },[currentUser?.id,pendingNotificationLink,chatThreads,trainings,chatCategory]);
  useEffect(()=>{
    if(openChatId)history.replaceState(null,'','#chat='+encodeURIComponent(openChatId));
    else if(window.location.hash.startsWith('#chat='))history.replaceState(null,'',window.location.pathname+window.location.search);
  },[openChatId]);

  const openChatThread = chatThreads.find(t => t.id === openChatId) || null;
  const openChatIsTraining = openChatThread?.kind === 'training';
  const openChatCompanion = openChatThread && !openChatIsTraining
    ? allUsers.find(u => u.id === openChatThread.companionId) || null
    : null;
  const lastMineMessageId = openChatThread
    ? [...openChatThread.messages].reverse().find(message=>message.senderId===CURRENT_USER_ID)?.id
    : undefined;
  const typingUserIds = openChatThread
    ? openChatThread.participantIds.filter(id=>id!==CURRENT_USER_ID && Date.now()-Number(openChatThread.typingAt?.[id]||0)<5000)
    : [];
  const typingNames=typingUserIds.map(id=>allUsers.find(user=>user.id===id)?.name?.split(' ')[0]).filter(Boolean) as string[];
  const messageAuthor=(senderId:string)=>senderId===CURRENT_USER_ID?'Вы':allUsers.find(user=>user.id===senderId)?.name||'Участник';

  const handleOpenChat = (chatId: string) => {
    triggerHapticImpact('light');
    void markThreadAsRead(chatId).catch(() => notify('Не удалось сохранить прочтение сообщений', 'err'));
    setOpenChatId(chatId);
    if (currentUser) setChatThreads(loadChatThreads(currentUser, allUsers, chatCategory));
  };

  const handleSendChatMessage = () => {
    if (chatSending || !chatDraft.trim() || !openChatThread || !currentUser) return;
    if(!openChatIsTraining && !openChatCompanion)return;
    if(openChatThread.archivedAt){notify('Чат завершённой тренировки доступен только для чтения','err');return;}
    triggerHapticImpact('light');
    const text = chatDraft.trim();
    const replyTarget=chatReplyTarget;
    setChatDraft('');
    setChatReplyTarget(null);
    setChatSending(true);
    void setChatTyping(openChatThread.id,false).catch(()=>undefined);
    const sending=openChatIsTraining
      ? sendTrainingGroupMessage(openChatThread.id,text,replyTarget?.id)
      : sendChatMessage(openChatThread.id,openChatCompanion!.id,text,replyTarget?.id);
    void sending
      .then(() => setChatThreads(loadChatThreads(currentUser, allUsers, chatCategory)))
      .catch((error) => {
        setChatDraft(text);
        setChatReplyTarget(replyTarget);
        notify(error instanceof Error ? error.message : 'Не удалось отправить сообщение', 'err');
      })
      .finally(()=>setChatSending(false));
  };

  const openTrainingGroupChat=async(training:Training)=>{
    if(!currentUser||!training.participantIds.includes(currentUser.id)){
      notify('Чат доступен только участникам тренировки','err');return;
    }
    try{
      const result=await ensureTrainingGroupChat(training.id);
      setSelectedTraining(null);
      setChatCategory('trainings');
      handleTabChange('chats');
      setPendingNotificationLink('#chat='+encodeURIComponent(result.chatId));
    }catch(error){
      notify(error instanceof Error?error.message:'Не удалось открыть чат тренировки','err');
    }
  };

  const handleDeleteMessage = (message:ChatMessage) => {
    if(!openChatThread||message.senderId!==CURRENT_USER_ID||message.deletedAt)return;
    setChatDeleteTargetId(null);
    void deleteChatMessage(openChatThread.id,message.id)
      .then(deleted=>{
        setChatThreads(previous=>previous.map(thread=>thread.id===openChatThread.id
          ? {...thread,messages:thread.messages.map(item=>item.id===deleted.id?deleted:item),lastMessage:thread.lastMessage?.id===deleted.id?deleted:thread.lastMessage}
          : thread));
        if(chatReplyTarget?.id===deleted.id)setChatReplyTarget(null);
        notify('Сообщение удалено для всех','ok');
      })
      .catch(error=>notify(error instanceof Error?error.message:'Не удалось удалить сообщение','err'));
  };

  // Open a chat with a matched partner (used from the match celebration modal)
  const goToChatWith = (companion: UserProfile) => {
    if (!isPremium) {
      setMatchedUser(null);
      handleTabChange('chats');
      return;
    }
    const chatId = buildChatId(CURRENT_USER_ID, companion.id);
    setMatchedUser(null);
    setChatCategory('matches');
    handleTabChange('chats');
    setTimeout(() => handleOpenChat(chatId), 120);
  };

  // Open a chat with a friend (used from the friends list)
  const goToFriendChat = (friend: UserProfile) => {
    const chatId = buildChatId(CURRENT_USER_ID, friend.id);
    setChatCategory('friends');
    handleTabChange('chats');
    setTimeout(() => handleOpenChat(chatId), 120);
  };

  const friendActionBusy = useRef(false);
  const applyFriendUpdate = (updated: UserProfile) => {
    setCurrentUser(previous => previous?.id === updated.id ? {
      ...previous, friendIds: updated.friendIds,
      friendRequestsSent: updated.friendRequestsSent, friendRequestsReceived: updated.friendRequestsReceived
    } : previous);
  };
  // Shared handling for profile and training participant actions.
  const handleFriendAction = async (target: Pick<UserProfile, 'id'>) => {
    if (!currentUser || friendActionBusy.current) return;
    if (!isPremium) { notify('Добавление в друзья доступно с Premium.', 'err'); return; }
    friendActionBusy.current = true;
    try {
      const status = getFriendStatus(currentUser, target.id);
      let updated = currentUser;
      if (status === 'none') updated = await sendFriendRequest(currentUser, target.id);
      else if (status === 'received') updated = await acceptFriendRequest(currentUser, target.id);
      else if (status === 'sent') updated = await cancelFriendRequest(currentUser, target.id);
      applyFriendUpdate(updated);
      if (status !== 'friends') notify(updated.friendIds?.includes(target.id) ? 'Вы теперь друзья!' : status === 'sent' ? 'Заявка отменена' : 'Заявка отправлена', 'ok');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось изменить заявку. Попробуйте ещё раз.', 'err');
    } finally { friendActionBusy.current = false; }
  };

  // Filtered Discovery Candidates
  // Discovery is strictly opposite-gender: only confirmed profiles of the
  // other gender appear for swiping and likes.
  const discoverCandidates = useMemo(() => {
    if (!currentUser || currentUser.genderSet === false) return [];
    // Strict opposite-gender separation. Legacy Firestore profiles without the
    // genderSet flag are treated as confirmed as long as gender is present.
    const blocked = currentUser.blockedUserIds || [];
    return allUsers.filter(u => {
      if (u.id === currentUser.id) return false;
      if (blocked.includes(u.id)) return false;
      if (u.genderSet === false || u.gender === currentUser.gender) return false;
      // Never surface faceless profiles: a personal photo is mandatory.
      if (!hasPersonalPhoto(u)) return false;
      if (swipedIds.includes(u.id)) return false;
      if (discoverSportFilter !== 'Все' && !u.sports.includes(discoverSportFilter)) return false;
      return u.activeLooking;
    });
  }, [allUsers, currentUser, swipedIds, discoverSportFilter]);

  const currentCandidate = discoverCandidates[0];

  // Filtered Trainings
  const filteredTrainings = useMemo(() => {
    return trainings.filter(tr => {
      if (!matchesDistrict(tr, trainingDistrictFilter)) return false;
      if (trainingSportFilter !== 'Все' && tr.sport !== trainingSportFilter) return false;
      if (trainingLevelFilter !== 'all' && tr.level !== trainingLevelFilter) return false;
      if (onlyMyTrainings && !tr.participantIds.includes(CURRENT_USER_ID)) return false;
      if (calendarDay && getTrainingDayKey(tr) !== calendarDay) return false;
      return true;
    });
  }, [trainings, trainingDistrictFilter, trainingSportFilter, trainingLevelFilter, onlyMyTrainings, calendarDay]);

  /** O(1) organiser lookup — avoids allUsers.find() inside every card */
  const creatorsById = useMemo(
    () => new Map(allUsers.map(u => [u.id, u])),
    [allUsers]
  );

  /** Membership comes from server data, including joins from another device. */
  const actualJoinedTrainingIds = useMemo(
    () => joinedTrainingIds(trainings, currentUser?.id),
    [trainings, currentUser?.id]
  );

  const actualJoinedTrainings = useMemo(
    () => trainings.filter((t) => actualJoinedTrainingIds.has(t.id)),
    [trainings, actualJoinedTrainingIds]
  );

  /* --- Stable feed callbacks so memoised PostCard rows skip re-renders --- */

  const handleToggleLikePost = useCallback(async (post: FeedPost) => {
    const liked = await toggleLikePost(post.id);
    setFeedPosts(prev => prev.map(p => {
      if (p.id !== post.id) return p;
      const likes = liked
        ? (p.likes.includes(CURRENT_USER_ID) ? p.likes : [...p.likes, CURRENT_USER_ID])
        : p.likes.filter(id => id !== CURRENT_USER_ID);
      return { ...p, likes };
    }));
  }, []);

  const handleToggleComments = useCallback((postId: string) => {
    triggerHapticImpact('light');
    setActiveCommentPostId(prev => (prev === postId ? null : postId));
  }, []);

  const handleSharePost = useCallback((post: FeedPost) => {
    shareContent(
      `SportBuddy Пост от ${post.authorName}`,
      post.content,
      window.location.href
    );
  }, []);

  /* ---- Reminder scheduler: notify 2 hours before a signed-up training ---- */
  useEffect(() => {
    if (!currentUser) return;

    const check = () => {
      const due = getDueReminders(trainings, CURRENT_USER_ID);
      due.forEach((t) => {
        markReminderSent(t.id);
        const c = getCountdown(t);
        setLocalNotifications(prev => [{
          id: `notif_remind_${t.id}`,
          title: `⏰ Тренировка через ${formatCountdown(c)}`,
          message: `«${t.title}» • ${t.time} • ${t.locationName}. Не забудьте отметиться о прибытии!`,
          type: 'training_reminder',
          time: 'только что',
          read: false,
          link: `#training=${t.id}`
        }, ...prev]);
        triggerHapticNotification('warning');
        sendLocalNotification(
          `Тренировка через ${formatCountdown(c)}`,
          `${t.title} — ${t.locationName}`
        );
      });
    };

    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [trainings, currentUser]);

  // Handlers for Discovery Like/Skip
  const handleLikeCandidate = async (targetUser: UserProfile) => {
    triggerHapticImpact('medium');
    setSwipedIds(prev => {
      const next = [...prev, targetUser.id];
      try {
        const parsed = JSON.parse(localStorage.getItem('sportbuddy_swiped_ids_v1') || '{}');
        parsed[targetUser.id] = Date.now();
        localStorage.setItem('sportbuddy_swiped_ids_v1', JSON.stringify(parsed));
      } catch {}
      return next;
    });
    
    const result = await toggleLikeProfile(targetUser.id);
    if (result.error) {
      notify(result.error, 'err');
      return;
    }
    if (result.isMatch) {
      launchMatchConfetti();
      setMatchedUser(targetUser);
      // Update local matches count
      if (currentUser) {
        setCurrentUser({ ...currentUser, matchIds: [...currentUser.matchIds, targetUser.id] });
      }
    }
  };

  const handleSkipCandidate = (targetUserId: string) => {
    triggerHapticImpact('light');
    setSwipedIds(prev => {
      const next = [...prev, targetUserId];
      try {
        const parsed = JSON.parse(localStorage.getItem('sportbuddy_swiped_ids_v1') || '{}');
        parsed[targetUserId] = Date.now();
        localStorage.setItem('sportbuddy_swiped_ids_v1', JSON.stringify(parsed));
      } catch {}
      return next;
    });
  };

  // Create new training submission
  const handleSubmitTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrTitle.trim() || !currentUser) return;
    if (!getDistrict(newTrDistrict)) { notify('Выберите район места встречи', 'err'); return; }
    if (!newTrLocationSelected) { notify('Выберите место встречи на карте', 'err'); return; }
    if (selectedVenueForTraining && !venueRentalConfirmed) {
      notify('Подтвердите, что аренда площадки согласована с владельцем', 'err');
      return;
    }

    // UI guard — Free athletes can still browse and join, but not organize.
    if (!isPremium) {
      triggerHapticNotification('warning');
      setIsCreateTrainingOpen(false);
      setProfileSection('tariff');
      handleTabChange('profile');
      return;
    }

    triggerHapticImpact('medium');
    let created: Training;
    try {
      created = await createTraining({
        title: newTrTitle,
        sport: newTrSport,
        dateLabel: `${formatFullDate(newTrDate)}, ${newTrTime}`,
        dateKey: newTrDate,
        time: newTrTime,
        districtId: newTrDistrict,
        locationName: newTrCity,
        address: newTrAddress,
        lat: newTrCoords.lat,
        lng: newTrCoords.lng,
        level: newTrLevel,
        participantsMax: Number(newTrMax) || 10,
        participantGender: newTrGender,
        description: newTrDesc,
        ...(selectedVenueForTraining ? {
          venueId: selectedVenueForTraining.id,
          venueName: selectedVenueForTraining.name,
          venueRentalConfirmed
        } : {})
      }, currentUser);
    } catch (err) {
      if (err instanceof PremiumTrainingRequiredError) {
        triggerHapticNotification('warning');
        setIsCreateTrainingOpen(false);
        setProfileSection('tariff');
        handleTabChange('profile');
        return;
      }
      throw err;
    }

    setTrainings(prev => [created, ...prev]);
    // Creating an event means the organizer is genuinely registered for it.
    setJoinedTraining(account?.id, created.id, true);
    setIsCreateTrainingOpen(false);
    setSelectedTraining(created);

    // Reset fields
    setNewTrGender('any');
    setNewTrDistrict('');
    setNewTrTitle('');
    setNewTrDesc('');
    setSelectedVenueForTraining(null);
    setVenueRentalConfirmed(false);
  };

  /** Starts the organizer flow from a SportBuddy Places card. */
  const handleCreateTrainingFromVenue = (venue: SportVenue) => {
    triggerHapticImpact('medium');
    setIsPlacesOpen(false);

    if (!isPremium) {
      triggerHapticNotification('warning');
      setProfileSection('tariff');
      handleTabChange('profile');
      return;
    }

    setSelectedVenueForTraining(venue);
    setVenueRentalConfirmed(false);
    setNewTrAddress(venue.address);
    setNewTrCity('Санкт-Петербург');
    setNewTrDistrict('');
    setNewTrLocationSelected(false);

    const compatibleSport = venue.sports.find(item => SPORTS.includes(item));
    if (compatibleSport) setNewTrSport(compatibleSport);

    setIsCreateTrainingOpen(true);
  };

  /** Entry point for the "Создать" button — Free users are sent to tariff. */
  const handleOpenCreateTraining = () => {
    triggerHapticImpact('medium');
    if (!isPremium) {
      triggerHapticNotification('warning');
      setProfileSection('tariff');
      handleTabChange('profile');
      return;
    }
    setSelectedVenueForTraining(null);
    setVenueRentalConfirmed(false);
    setIsCreateTrainingOpen(true);
  };

  // Toggle Join Training
  const handleJoinTraining = async (tr: Training) => {
    const genderError = !tr.participantIds.includes(CURRENT_USER_ID) ? trainingGenderError(tr, currentUser) : null;
    if (genderError) { notify(genderError, 'err'); return; }
    let isJoined: boolean;
    try { isJoined = await toggleJoinTraining(tr.id); }
    catch (error) { notify(error instanceof Error ? error.message : 'Не удалось изменить запись', 'err'); return; }
    // Keep the legacy local journal as a cache; render the server-confirmed result.
    setJoinedTraining(account?.id, tr.id, isJoined);
    setTrainings(prev => prev.map(t => {
      if (t.id === tr.id) {
        const nextIds = isJoined
          ? [...new Set([...t.participantIds, CURRENT_USER_ID])]
          : t.participantIds.filter(id => id !== CURRENT_USER_ID);
        return { ...t, participantIds: nextIds };
      }
      return t;
    }));
    if (selectedTraining && selectedTraining.id === tr.id) {
      setSelectedTraining(prev => prev ? {
        ...prev,
        participantIds: isJoined ? [...prev.participantIds, CURRENT_USER_ID] : prev.participantIds.filter(id => id !== CURRENT_USER_ID)
      } : null);
    }
  };

  // Create Post
  const handleCreatePost = async () => {
    if (!postContent.trim() || !currentUser) return;
    if (!requirePublishingVerification()) return;

    let media = postMediaUrl.trim() || undefined;
    if (media) {
      try {
        setUploadProgress(0);
        media = await uploadRemoteUrl(media, {
          folder: 'sportbuddy/feed/image',
          tags: ['feed', 'remote', currentUser.id],
          onProgress: setUploadProgress
        });
      } catch {
        notify('Не удалось загрузить медиа по ссылке — публикуем без него.', 'err');
        media = undefined;
      } finally {
        setUploadProgress(null);
      }
    }

    const post = await createPost(postContent, postSportTag, media, 'image', currentUser);
    if (post) {
      setFeedPosts(prev => [post, ...prev]);
      setPostContent('');
      setPostMediaUrl('');
      setIsCreatePostOpen(false);
      triggerHapticNotification('success');
    } else {
      notify('Не удалось опубликовать. Проверьте Premium, верификацию и связь.', 'err');
    }
  };

  // The admin entry is reachable by anyone, but the modal itself enforces
  // server-side e-mail + password + OTP — so exposing the button is safe.
  const isAdminUser = useMemo(
    () => isAdmin(currentUser),
    [currentUser, adminSessionVersion]
  );
  const verification = currentUser ? getVerificationState(currentUser) : null;

  // Stable callback so memoised sections skip re-renders
  const openRewardModal = useCallback(
    (title: string, subtitle: string, content: React.ReactNode) =>
      setRewardModal({ title, subtitle, content }),
    []
  );

  useEffect(() => {
    if (currentUser?.isVerified) setWelcomeTrialShown(false);
  }, [currentUser?.isVerified]);

  // Revert to the free palette once Premium expires
  useEffect(() => {
    if (!currentUser || isPremium) return;
    const usesPremiumTheme = theme.accent !== 'emerald' || theme.surface !== 'midnight';
    if (usesPremiumTheme) setTheme(resetTheme());
  }, [isPremium, currentUser, theme.accent, theme.surface]);

  /** Requests GPS, registers the device on the radar and refreshes presence */
  const handleRefreshLocation = async () => {
    if (!currentUser) return;
    setIsLocating(true);
    try {
      const coords = await getCurrentCoords();
      setUserCoords(coords);
      setHasCurrentLocation(true);
      setUserLocationLabel('Местоположение определено');

      const updatedMe = await registerMyPresence(currentUser, coords);
      const verified = await syncVerification(updatedMe);
      setCurrentUser(verified);

      // Refresh presence of every registered device around
      setAllUsers(prev =>
        seedPresence(prev, coords).map(u => (u.id === verified.id ? verified : u))
      );

      try {
        const addr = await getAddressFromCoords(coords.lat, coords.lng);
        setUserLocationLabel(addr.shortAddress || 'Санкт-Петербург');
      } catch {
        /* keep previous label */
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось обновить геолокацию', 'err');
    } finally {
      setIsLocating(false);
    }
  };

  /** Routes the user to the screen that completes the requested step */
  const handleVerificationStep = (step: VerificationStepId) => {
    if (step === 'geo') {
      handleRefreshLocation();
      return;
    }
    setProfileSection('edit');
    handleTabChange('profile');
  };


  // Register / cancel registration for an official SportBuddy event
  const handleToggleEventRegistration = (event: OfficialEvent) => {
    if (!currentUser) return;
    void toggleEventRegistration(event.id, currentUser.id).then((updated) => {
      if (!updated) return;
      setSelectedEvent(updated);
      setEventsRefreshKey(k => k + 1);
    }).catch((error) => setAuthNotice(error instanceof Error ? error.message : 'Не удалось изменить регистрацию'));
  };

  // Participant confirmed arrival → organizer gets a push-style notification
  const handleCheckedIn = (updatedTraining: Training) => {
    setTrainings(prev => prev.map(t => (t.id === updatedTraining.id ? updatedTraining : t)));
    setSelectedTraining(updatedTraining);

    const myCheckIn = currentUser ? getMyCheckIn(updatedTraining.id, currentUser.id) : undefined;
    if (myCheckIn && updatedTraining.createdBy !== CURRENT_USER_ID) {
      // Notify the organizer (delivered locally + via FCM in the native build)
      setLocalNotifications(prev => [buildArrivalNotification(myCheckIn, updatedTraining), ...prev]);
    }

  };

  // Organizer opens a chat with an arrived participant
  const handleMessageParticipant = (participant: UserProfile) => {
    setSelectedTraining(null);
    if (!isPremium) {
      notify('Чат с участниками доступен с Premium.', 'err');
      return;
    }
    const isFriend = (currentUser?.friendIds || []).includes(participant.id);
    const chatId = buildChatId(CURRENT_USER_ID, participant.id);
    setChatCategory(isFriend ? 'friends' : 'matches');
    handleTabChange('chats');
    setTimeout(() => handleOpenChat(chatId), 120);
  };

  // Organizer finishes a training → rating flow unlocks
  const handleCompleteTraining = async (training: Training) => {
    if (!currentUser) return;
    try {
      const updated = await completeTraining(training);
      setTrainings(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      if (selectedTraining?.id === updated.id) setSelectedTraining(updated);

      // The creator earns a daily credit only for a training they actually
      // GPS-checked into and completed on its scheduled day.
      const credit = await creditWorkout(currentUser, 'organizer-completion', updated);
      if (credit.ok) {
        setCurrentUser(credit.user);
        setAllUsers(prev => prev.map(u => (u.id === credit.user.id ? credit.user : u)));
        setLocalNotifications(prev => [{
          id: `notif_organizer_credit_${updated.id}`,
          title: '🏋️ Проведённая тренировка засчитана',
          message: `«${updated.title}» подтверждена. Всего тренировок: ${credit.total}.`,
          type: 'reward', time: 'только что', read: false
        }, ...prev]);
      }

      if (pendingRatings(updated).length > 0) {
        setSelectedTraining(null);
        setRatingTraining(updated);
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      const messages: Record<string, string> = {
        'not-training-day': 'Завершить тренировку можно только в её календарный день.',
        'missing-training-date': 'У тренировки не указана корректная дата — создайте её заново через календарь.',
        'training-not-started': 'Сначала должно наступить время начала тренировки.',
        'organizer-not-checked-in': 'Сначала отметьтесь на месте по GPS как организатор.'
      };
      notify(messages[code] || 'Не удалось завершить тренировку.', 'err');
    }
  };

  // A participant has been rated by the organizer
  const handleParticipantRated = (updatedTraining: Training, participant: UserProfile) => {
    setTrainings(prev => prev.map(t => (t.id === updatedTraining.id ? updatedTraining : t)));
    setRatingTraining(updatedTraining);
    setAllUsers(prev => prev.map(u => (u.id === participant.id ? participant : u)));
    if (currentUser?.id === participant.id) setCurrentUser(participant);
  };

  /** Participant completed the short post-training survey about the organizer. */
  const handleOrganizerRated = async (updatedTraining: Training, organizer: UserProfile) => {
    if (!currentUser) return;
    setTrainings(prev => prev.map(t => (t.id === updatedTraining.id ? updatedTraining : t)));
    setAllUsers(prev => prev.map(u => (u.id === organizer.id ? organizer : u)));
    setOrganizerRatingTraining(null);

    // This is the ONLY participant path to a workout credit.
    const credit = await creditWorkout(currentUser, 'participant-completion', updatedTraining);
    if (credit.ok) {
      setCurrentUser(credit.user);
      setAllUsers(prev => prev.map(u => (u.id === credit.user.id ? credit.user : u)));
      setLocalNotifications(prev => [{
        id: `notif_participant_credit_${updatedTraining.id}`,
        title: '🏋️ Тренировка подтверждена',
        message: `«${updatedTraining.title}» засчитана в прогресс. Всего тренировок: ${credit.total}.`,
        type: 'reward', time: 'только что', read: false
      }, ...prev]);
    } else if (credit.reason === 'already-credited') {
      setLocalNotifications(prev => [{
        id: `notif_daily_limit_${updatedTraining.id}`,
        title: 'Участие подтверждено ✅',
        message: `Сегодня уже есть зачёт тренировки. Оценка сохранена, следующий зачёт доступен через ${formatCooldown(credit.cooldownMs ?? msUntilNextCredit())}.`,
        type: 'system', time: 'только что', read: false
      }, ...prev]);
    } else {
      setLocalNotifications(prev => [{
        id: `notif_credit_blocked_${updatedTraining.id}`,
        title: 'Оценка сохранена ✅',
        message: 'Тренировка не добавлена в прогресс: зачёт возможен только в календарный день тренировки после подтверждённого участия.',
        type: 'system', time: 'только что', read: false
      }, ...prev]);
    }
  };

  const trainingsAwaitingRating = useMemo(
    () => getTrainingsAwaitingRating(trainings),
    [trainings]
  );

  // Завершённая видеозапись тренировки уходит в ленту через тот же диалог
  // подписи, что и обычное видео из галереи. Выдуманных зрителей нет:
  // приложение не ведёт трансляцию, а записывает видео на устройстве.
  const handlePublishBroadcast = (title: string, durationSec: number, file: File | null) => {
    if (!currentUser) return;
    if (!requirePublishingVerification()) return;

    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    const duration = mins > 0 ? `${mins} мин ${secs} сек` : `${secs} сек`;

    if (!file) {
      notify('Устройство не поддержало видеозапись — опубликуйте видео или фото из галереи', 'err');
      return;
    }

    openCaptionDialog(file, true);
    setPendingCaption(`🎥 Запись тренировки «${title}» · ${duration} · ${currentUser.locationName}`);
    notify('Запись готова — добавьте подпись и опубликуйте');
  };

  /** Готовит выбранный файл и открывает модалку подписи. */
  const openCaptionDialog = useCallback((file: File, isVideo?: boolean) => {
    setPendingMedia({ file, isVideo: isVideo ?? file.type.startsWith('video') });
    setPendingCaption(
      (isVideo ?? file.type.startsWith('video'))
        ? 'Моё видео с тренировки в Санкт-Петербурге 🎥'
        : 'Фото с тренировки в Санкт-Петербурге 📸'
    );
  }, []);

  /** Кнопка «Из галереи»: native — системный picker, web — input[type=file]. */
  const handleOpenGallery = async () => {
    triggerHapticImpact('medium');
    if (!requirePublishingVerification()) return;
    if (!isNativeApp) { mediaInputRef.current?.click(); return; }
    try {
      const file = await pickPhotoFromGallery();
      if (file) setEditingFeedPhoto(file);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Галерея недоступна', 'err');
    }
  };

  /** Web-ветка input[type=file]: фото и видео. */
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentUser) return;
    if (!requirePublishingVerification()) return;

    const isVideo = file.type.startsWith('video');
    if (isVideo) openCaptionDialog(file, true);
    else setEditingFeedPhoto(file);
  };

  /** Публикация подготовленного медиа в ленту. */
  const publishPendingMedia = async () => {
    if (!pendingMedia || !currentUser || uploadProgress !== null) return;
    const { file, isVideo } = pendingMedia;

    uploadAbortRef.current?.abort();
    const ctrl = new AbortController();
    uploadAbortRef.current = ctrl;
    setUploadProgress(0);

    try {
      const { secureUrl } = await uploadMedia(file, {
        folder: isVideo ? 'sportbuddy/feed/video' : 'sportbuddy/feed/image',
        resourceType: isVideo ? 'video' : 'image',
        tags: ['feed', currentUser.id],
        onProgress: setUploadProgress,
        signal: ctrl.signal
      });

      if (CURRENT_USER_ID !== currentUser.id) throw new Error('Аккаунт изменился. Откройте публикацию заново.');
      const post = await createPost(
        pendingCaption.trim() || 'Новая публикация',
        currentUser.sports[0] || 'Общее',
        secureUrl,
        isVideo ? 'video' : 'image',
        currentUser
      );
      if (!post) {
        notify('Публикация недоступна: проверьте Premium и верификацию.', 'err');
        return;
      }
      setFeedPosts(prev => [post, ...prev]);
      setPendingMedia(null);
      setPendingCaption('');
      notify('Публикация добавлена в ленту');
    } catch (error) {
      if (!ctrl.signal.aborted) {
        notify(error instanceof Error ? error.message : 'Не удалось опубликовать файл', 'err');
      }
    } finally {
      setUploadProgress(null);
    }
  };

  // Create Comment
  const handleSendComment = async (postId: string) => {
    if (!newCommentText.trim()) return;
    const comment = await createComment(postId, newCommentText);
    setFeedPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const comments = p.comments || [];
        return {
          ...p,
          comments: [...comments, comment],
          commentsCount: comments.length + 1
        };
      }
      return p;
    }));
    setNewCommentText('');
    triggerHapticImpact('light');
  };

  // Capacitor Camera -> Cloudinary -> профиль
  const handleUpdateAvatar = async () => {
    if (!currentUser || uploadProgress !== null) return;

    let file: File | null = null;
    try {
      file = await takeAvatarPhoto();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Камера недоступна', 'err');
      return;
    }
    if (!file) return;

    uploadAbortRef.current?.abort();
    const ctrl = new AbortController();
    uploadAbortRef.current = ctrl;
    setUploadProgress(0);

    try {
      const avatar = await uploadToCloudinary(file, {
        folder: 'sportbuddy/avatars',
        tags: ['avatar', currentUser.id],
        onProgress: setUploadProgress,
        signal: ctrl.signal
      });

      const next = await updateProfile({ avatar }) ?? { ...currentUser, avatar };
      setCurrentUser(next);
      // Раньше allUsers не обновлялся — аватар оставался старым в списках
      setAllUsers(prev => prev.map(u => (u.id === next.id ? next : u)));
      const verified = await syncVerification(next);
      setCurrentUser(verified);
      setAllUsers(prev => prev.map(u => u.id === verified.id ? verified : u));
      notify('Фото обновлено — верификация пересчитана');
    } catch (error) {
      if (!ctrl.signal.aborted) {
        notify(error instanceof CloudinaryUploadError
          ? error.message
          : 'Не удалось загрузить фото', 'err');
      }
    } finally {
      setUploadProgress(null);
    }
  };

  // YooKassa return page works without react-router and returns to Profile.
  if (paymentSuccess) {
    return <SuccessScreen onContinue={handlePaymentSuccessContinue} />;
  }

  // Gate the whole app behind authentication
  if (!account) {
    return <AuthScreen initialNotice={authNotice} onAuthenticated={handleAuthenticated} />;
  }

  if (loadError && !currentUser && !isLoading) {
    return <div className="min-h-[100svh] bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p role="alert">{loadError}</p>
      <button disabled={isRefreshing} onClick={() => void fetchAllData()} className="rounded-xl bg-emerald-500 px-5 py-3 text-slate-950 disabled:opacity-50">
        {isRefreshing ? 'Загрузка…' : 'Повторить попытку'}
      </button>
    </div>;
  }

  if (currentUser?.isSuspended) {
    return <div className="flex min-h-[100svh] items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-sm rounded-[28px] border border-rose-500/40 bg-slate-900/95 p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-rose-500/40 bg-rose-500/10 text-3xl">⛔</div>
        <h2 className="mt-4 text-lg font-black text-white">Аккаунт временно ограничен</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Доступ к действиям SportBuddy78 приостановлен администрацией. Для уточнения обратитесь в поддержку.
        </p>
        <a href="mailto:support@sportbuddy78.ru" className="mt-4 block rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black text-slate-950">
          Написать в поддержку
        </a>
        <button onClick={handleLogout} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs font-bold text-slate-300">
          Выйти из аккаунта
        </button>
      </div>
    </div>;
  }

  // Gender onboarding gate: mandatory once, immutable afterwards. It drives
  // the opposite-gender discovery feed, so it must be set before entry.
  if (needsGenderGate && currentUser) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-slate-950 px-6 text-slate-100">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-sm rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-6 shadow-2xl"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border-2 border-emerald-400/60 bg-emerald-500/10 text-3xl">
            🤝
          </div>
          <h2 className="text-center text-xl font-black tracking-tight text-white">
            Почти готово, {currentUser.name.split(' ')[0] || 'чемпион'}!
          </h2>
          <p className="mt-2 text-center text-xs leading-relaxed text-slate-400">
            Укажите пол — мы покажем вам анкеты противоположного пола для знакомств
            и симпатий. <b className="text-slate-200">Изменить выбор после этого нельзя.</b>
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => { setPendingGender('male'); }}
              className={`flex flex-col items-center gap-2 rounded-2xl border py-5 transition active:scale-[0.97] ${
                pendingGender === 'male'
                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400'
              }`}
            >
              <span className="text-3xl">🙋‍♂️</span>
              <span className="text-sm font-bold">Мужчина</span>
            </button>
            <button
              onClick={() => { setPendingGender('female'); }}
              className={`flex flex-col items-center gap-2 rounded-2xl border py-5 transition active:scale-[0.97] ${
                pendingGender === 'female'
                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400'
              }`}
            >
              <span className="text-3xl">🙋‍♀️</span>
              <span className="text-sm font-bold">Женщина</span>
            </button>
          </div>

          <button
            onClick={confirmGender}
            disabled={!pendingGender}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-3.5 text-sm font-black text-slate-950 transition active:scale-[0.98] disabled:opacity-40"
          >
            Подтвердить и продолжить
          </button>
          <p className="mt-3 flex items-center justify-center gap-1 text-center text-[10px] text-slate-600">
            <Lock className="h-3 w-3" /> Выбор сохраняется навсегда
          </p>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[100svh] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] mb-4"
        >
          <Zap className="w-8 h-8 text-emerald-400" />
        </motion.div>
        <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">SportBuddy</h2>
        <p className="text-xs text-slate-400 mt-1">Находим твой спортивный Петербург…</p>
      </div>
    );
  }

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  return (
    <div className="sb-app-shell relative min-h-[100svh] bg-slate-950 text-slate-100 pb-24 font-sans antialiased">
      <AmbientBackdrop />

      {/* 1. Header Bar */}
      <header className="sb-app-header sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 pt-safe transition-all">
        <span className="sb-header-line" aria-hidden />
        <div className="mx-auto flex w-full max-w-md items-center justify-between lg:max-w-5xl">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)]">
              <Zap className="w-5 h-5 text-slate-950 fill-slate-950" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white leading-none flex items-center gap-1.5">
                SportBuddy <span className="text-[10px] font-black tracking-wider uppercase bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded-md shadow">78</span>
              </h1>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-medium truncate max-w-[170px]">
                <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">{userLocationLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Offline Status badge */}
            {isOffline && (
              <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] px-2 py-1 rounded-xl font-bold animate-pulse">
                <WifiOff className="w-3 h-3" /> Офлайн
              </span>
            )}

            {/* Guide: что умеет проект — для новичков и по желанию */}
            <button
              onClick={() => { triggerHapticImpact('light'); setIsGuideOpen(true); }}
              className="p-2 text-amber-300 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition active:scale-95"
              aria-label="Возможности SportBuddy"
              title="Что умеет SportBuddy"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {/* Sync Refresh Button */}
            <button
              onClick={fetchAllData}
              disabled={isRefreshing}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition active:scale-95"
              aria-label="Обновить данные"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* Notification Inbox Icon */}
            <button
              onClick={() => setIsNotifModalOpen(true)}
              className="relative p-2 text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition active:scale-95"
              aria-label="Уведомления"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow">
                  {unreadNotifCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      {(loadError || loadWarning) && <div role="status" className="mx-4 my-2 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-200">
        {loadError || loadWarning}
      </div>}
      <AppAnnouncements placement={activeTab} />

      {/* Offline Pending Action Toast */}
      {pendingSyncCount > 0 && (
        <div className="relative z-10 mx-auto w-full max-w-md px-4 mt-2 lg:max-w-5xl">
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-2.5 flex items-center justify-between text-xs text-slate-200">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>В очереди <b>{pendingSyncCount}</b> действий (отправка при сети)</span>
            </span>
            <button
              onClick={() => syncOfflineQueue().then(c => { if(c>0) setPendingSyncCount(0); })}
              className="text-emerald-400 font-bold hover:underline"
            >
              Синхронизировать
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Tab Body with Framer Motion Animation */}
      <main className="sb-main relative z-10 mx-auto w-full max-w-md px-4 pt-3 lg:max-w-5xl">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          >
            {/* ==================== TAB 1: DISCOVER (ЗНАКОМСТВА) ==================== */}
            {activeTab === 'discover' && (
              <div className="space-y-4">
                {/* Mode Switcher & Filters Header */}
                <div id="sb-discover-controls" className="flex flex-wrap gap-2 items-center justify-between bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-200">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Спорт:</span>
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 max-w-[240px]">
                    {SPORT_FILTERS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setDiscoverSportFilter(s)}
                        className={`text-xs px-2.5 py-1 rounded-xl whitespace-nowrap font-medium transition-all ${
                          discoverSportFilter === s
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {/* Toggle Cards / Map / Nearby radar */}
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setDiscoverViewMode('cards')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                        discoverViewMode === 'cards' ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-500'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" /> Свайп
                    </button>
                    <button
                      onClick={() => setDiscoverViewMode('map')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                        discoverViewMode === 'map' ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-500'
                      }`}
                    >
                      <MapIcon className="w-3.5 h-3.5" /> Карта
                    </button>
                    <button
                      onClick={() => { setDiscoverViewMode('nearby'); handleRefreshLocation(); }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                        discoverViewMode === 'nearby' ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-500'
                      }`}
                    >
                      📡 Рядом
                    </button>
                  </div>
                </div>

                {/* Verification banner — unlocks the nearby radar */}
                {currentUser && verification && !verification.isVerified && discoverViewMode !== 'nearby' && (
                  <VerificationCard user={currentUser} onStepAction={handleVerificationStep} />
                )}

                {/* VIEW 0: NEARBY RADAR (5 km) */}
                {discoverViewMode === 'nearby' && currentUser ? (
                  <NearbyRadar
                    currentUser={currentUser}
                    allUsers={allUsers}
                    myCoords={hasCurrentLocation ? userCoords : null}
                    locationLabel={userLocationLabel}
                    onSelectUser={(u) => setSelectedUserModal(u)}
                    onRefreshLocation={handleRefreshLocation}
                    onFixVerification={() => handleVerificationStep('avatar')}
                    isLocating={isLocating}
                  />
                ) : /* VIEW 1: MAP OF ALL PROFILES */
                discoverViewMode === 'map' ? (
                  <div className="space-y-3">
                    <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-300">Спортсмены, поделившиеся местоположением</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {hasCurrentLocation ? 'Местоположение определено' : 'Обзор Санкт-Петербурга'}
                      </span>
                    </div>
                    <Suspense fallback={<MapFallback height="460px" />}>
                      <LeafletMap
                        center={userCoords}
                        showCurrentLocation={hasCurrentLocation}
                        zoom={12}
                        users={allUsers.filter(u => u.id !== CURRENT_USER_ID && u.hasUsedGeolocation)}
                        onSelectUser={(u) => setSelectedUserModal(u)}
                        height="460px"
                      />
                    </Suspense>
                  </div>
                ) : (
                  /* VIEW 2: SWIPE CARDS (TINDER-STYLE) */
                  <div className="relative min-h-[460px] flex flex-col justify-between">
                    {currentCandidate ? (
                      <div className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden border-2 border-slate-800 bg-slate-900 shadow-[0_10px_35px_rgba(0,0,0,0.7)] group">
                        {/* Interactive Drag gesture for smooth native cards */}
                        <motion.div
                          key={currentCandidate.id}
                          style={{ x: dragX, rotate }}
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.9}
                          onDragEnd={(_, info) => {
                            if (info.offset.x > 110) {
                              handleLikeCandidate(currentCandidate);
                            } else if (info.offset.x < -110) {
                              handleSkipCandidate(currentCandidate.id);
                            }
                          }}
                          className="w-full h-full relative cursor-grab active:cursor-grabbing"
                        >
                          {/* Living photo — animates only when a face/body is clearly visible */}
                          <LivePhoto
                            src={photoUrl(getDiscoveryPhoto(currentCandidate), 800)}
                            alt={currentCandidate.name}
                            className="w-full h-full filter brightness-95 contrast-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-95 pointer-events-none" />

                          {/* Honest label: sample profile shown while the СПб community grows */}
                          {currentCandidate.isDemo && (
                            <span className="absolute top-4 left-4 z-10 text-[9px] font-black uppercase tracking-wider bg-slate-950/80 text-slate-300 border border-slate-600 px-2 py-1 rounded-lg backdrop-blur">
                              Пример анкеты
                            </span>
                          )}

                          {/* LIKE OVERLAY BADGE */}
                          <motion.div
                            style={{ opacity: likeOpacity }}
                            className="absolute top-6 left-6 border-4 border-emerald-400 bg-emerald-500/30 text-emerald-300 font-black text-2xl px-4 py-1.5 rounded-2xl transform -rotate-12 shadow-[0_0_20px_rgba(16,185,129,0.8)] z-20 pointer-events-none"
                          >
                            СИМПАТИЯ 🏃‍♀️💚
                          </motion.div>

                          {/* SKIP OVERLAY BADGE */}
                          <motion.div
                            style={{ opacity: skipOpacity }}
                            className="absolute top-6 right-6 border-4 border-rose-500 bg-rose-500/30 text-rose-300 font-black text-2xl px-4 py-1.5 rounded-2xl transform rotate-12 shadow-[0_0_20px_rgba(244,63,94,0.8)] z-20 pointer-events-none"
                          >
                            ПРОПУСТИТЬ ❌
                          </motion.div>

                          {/* Candidate Information Footer */}
                          <div className="absolute bottom-0 left-0 right-0 p-5 z-10 space-y-2.5">
                            <div className="flex items-end justify-between">
                              <div>
                                <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                                  {currentCandidate.name}, <span className="text-emerald-400 font-normal">{currentCandidate.age}</span>
                                </h3>
                                <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 
                                  {districtLabel(currentCandidate.districtId) || currentCandidate.locationName}{hasCurrentLocation && currentCandidate.hasUsedGeolocation && <span className="text-amber-400 font-bold"> • ~{calculateDistanceKm(userCoords.lat, userCoords.lng, currentCandidate.lat, currentCandidate.lng).toFixed(1)} км</span>}
                                </p>
                              </div>

                              <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-2.5 py-1.5 rounded-xl text-center">
                                <span className="text-amber-400 text-xs font-black">★ {currentCandidate.rating.toFixed(1)}</span>
                                <p className="text-[9px] text-slate-400 font-medium">{currentCandidate.totalWorkouts} трен.</p>
                              </div>
                            </div>

                            {/* Sports Tags */}
                            <div className="flex flex-wrap gap-1.5">
                              {currentCandidate.sports.map((s, idx) => (
                                <span key={idx} className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow">
                                  {s}
                                </span>
                              ))}
                              {currentCandidate.subscriptionPlan === 'premium' && (
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 flex items-center gap-1 shadow">
                                  <Crown className="w-3.5 h-3.5 fill-slate-950" /> PRO
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed bg-slate-900/60 backdrop-blur-md p-2.5 rounded-2xl border border-slate-800/80">
                              "{currentCandidate.bio}"
                            </p>

                            {/* Click to open full details */}
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedUserModal(currentCandidate); }}
                              className="text-xs font-bold text-slate-400 hover:text-emerald-400 flex items-center gap-1 pt-1 underline"
                            >
                              Подробная анкета и достижения <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>

                        {/* Floating Bottom Like/Skip Action Buttons */}
                        <div className="absolute -bottom-0 left-0 right-0 p-4 flex justify-center items-center gap-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pt-8 z-20">
                          <button
                            onClick={() => handleSkipCandidate(currentCandidate.id)}
                            className="w-14 h-14 rounded-full bg-slate-900 border-2 border-slate-700 hover:border-rose-500 text-rose-500 flex items-center justify-center shadow-xl transition-all active:scale-90"
                            aria-label="Пропустить анкету"
                          >
                            <CloseIcon className="w-7 h-7 stroke-[3]" />
                          </button>

                          <button
                            onClick={() => setSelectedUserModal(currentCandidate)}
                            className="w-11 h-11 rounded-full bg-slate-800/90 border border-slate-600 text-slate-300 hover:text-white flex items-center justify-center shadow transition active:scale-95 text-xs font-mono"
                            aria-label="Информация"
                          >
                            ℹ️
                          </button>

                          <button
                            onClick={() => handleLikeCandidate(currentCandidate)}
                            className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.7)] hover:scale-105 transition-all active:scale-90 animate-like-pulse"
                            aria-label="Симпатия"
                          >
                            <Heart className="w-8 h-8 fill-slate-950 stroke-none" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ALL SWIPED COMPLETE EMPTY STATE */
                      <div className="text-center py-16 px-4 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400 mx-auto flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                          🎯
                        </div>
                        <h3 className="text-lg font-bold text-white">Вы просмотрели всех кандидатов!</h3>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                          Новые спортивные анкеты в Санкт-Петербурге появляются каждый час. Загляните позже или сбросьте фильтры, чтобы посмотреть снова!
                        </p>
                        <button
                          onClick={() => { triggerHapticImpact('light'); setSwipedIds([]); try { localStorage.removeItem('sportbuddy_swiped_ids_v1'); } catch {} }}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-6 py-3 rounded-2xl text-sm transition shadow-[0_4px_15px_rgba(16,185,129,0.4)] active:scale-95 inline-flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" /> Смотреть анкеты заново
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 2: TRAININGS (ТРЕНИРОВКИ) ==================== */}
            {activeTab === 'trainings' && (
              <div className="space-y-4">
                {/* Header Actions & Filter */}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-black text-white tracking-tight">Спортивные тренировки</h2>
                    <p className="text-xs text-slate-400">Находите группы или организуйте свои пробежки</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { triggerHapticImpact('light'); setIsPlacesOpen(true); }}
                      className="font-black px-3 py-2.5 rounded-2xl text-xs transition flex items-center gap-1.5 bg-slate-900 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 active:scale-95"
                    >
                      <MapPin className="w-4 h-4" />
                      Площадки
                    </button>
                    <button
                      onClick={handleOpenCreateTraining}
                      className={`font-black px-4 py-2.5 rounded-2xl text-xs transition flex items-center gap-1.5 shadow active:scale-95 ${
                        isPremium
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                          : 'bg-slate-800 border border-amber-500/40 text-amber-300 hover:bg-slate-700'
                      }`}
                    >
                      {isPremium ? <Plus className="w-4 h-4 stroke-[3]" /> : <Crown className="w-4 h-4 fill-amber-300" />}
                      {isPremium ? 'Создать' : 'Создать PRO'}
                    </button>
                  </div>
                </div>

                {/* Pending participant ratings for the organizer */}
                {trainingsAwaitingRating.length > 0 && (
                  <div className="space-y-2">
                    {trainingsAwaitingRating.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { triggerHapticImpact('medium'); setRatingTraining(t); }}
                        className="w-full bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 border-2 border-amber-500/60 rounded-3xl p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition shadow-xl"
                      >
                        <span className="text-2xl shrink-0">⭐️</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-white truncate">
                            Оцените участников тренировки
                          </h4>
                          <p className="text-[11px] text-slate-300 truncate">
                            «{t.title}» • ждут оценки: {pendingRatings(t).length}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Official SportBuddy events */}
                {currentUser && (
                  <OfficialEvents
                    currentUser={currentUser}
                    onOpenEvent={(e) => setSelectedEvent(e)}
                    isAdminUser={isAdminUser}
                    onOpenAdmin={() => {
                      if (isAdminUser) setIsAdminOpen(true);
                      else setIsAdminAccessOpen(true);
                    }}
                    refreshKey={eventsRefreshKey}
                  />
                )}

                {/* Calendar with date filter */}
                <TrainingCalendar
                  trainings={trainings}
                  selectedDay={calendarDay}
                  onSelectDay={setCalendarDay}
                />

                {/* Community leaderboard */}
                <Leaderboard
                  allUsers={allUsers}
                  currentUserId={CURRENT_USER_ID}
                  onSelectUser={(u) => setSelectedUserModal(u)}
                />

                {/* Filter chip pills */}
                <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Filter className="w-3.5 h-3.5" /> Фильтр по спорту:
                    </span>
                    <button
                      onClick={() => setOnlyMyTrainings(!onlyMyTrainings)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition ${
                        onlyMyTrainings ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      ✓ Мои записи
                    </button>
                  </div>
                  
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {SPORT_FILTERS.map(sport => (
                      <button
                        key={sport}
                        onClick={() => setTrainingSportFilter(sport)}
                        className={`px-3 py-1 rounded-xl text-xs whitespace-nowrap font-semibold transition ${
                          trainingSportFilter === sport
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {sport}
                      </button>
                    ))}
                  </div>

                  <DistrictSelect value={trainingDistrictFilter} onChange={setTrainingDistrictFilter} label="Район места встречи" emptyLabel="Все районы" />
                  <div className="flex flex-wrap gap-2">
                    {getDistrict(currentUser?.districtId) && <button type="button" onClick={() => setTrainingDistrictFilter(currentUser?.districtId || '')} className="min-h-11 px-3 text-xs font-bold text-emerald-300 rounded-xl bg-emerald-500/10">Мой район</button>}
                    {trainingDistrictFilter && <button type="button" onClick={() => setTrainingDistrictFilter('')} className="min-h-11 px-3 text-xs text-slate-300">Все районы</button>}
                  </div>
                  {trainingDistrictFilter && <p className="text-xs text-slate-400">Тренировки без указанного района доступны в разделе «Все районы».</p>}

                  {/* Level selector */}
                  <div className="flex gap-1 pt-1 border-t border-slate-800/80">
                    {[
                      { id: 'all', label: 'Любой уровень' },
                      { id: 'amateur', label: 'Начинающие' },
                      { id: 'semi-pro', label: 'Любитель+' },
                      { id: 'pro', label: 'Профи' }
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={() => setTrainingLevelFilter(item.id as any)}
                        className={`flex-1 py-1 text-[11px] rounded-lg font-medium transition ${
                          trainingLevelFilter === item.id ? 'bg-slate-800 text-amber-400 font-bold border border-slate-700' : 'text-slate-400'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Training Cards — virtualised: only visible rows are rendered */}
                {filteredTrainings.length === 0 ? (
                  <div className="text-center py-12 px-4 bg-slate-900/50 rounded-3xl border border-slate-800 text-slate-400">
                    <Dumbbell className="w-12 h-12 text-slate-600 mx-auto mb-2 opacity-60" />
                    <p className="font-semibold text-sm">Тренировок с такими параметрами не найдено</p>
                    <p className="text-xs mt-1">Попробуйте изменить фильтры или создайте свою тренировку первым!</p>
                  </div>
                ) : (
                  <Virtuoso
                    useWindowScroll
                    data={filteredTrainings}
                    // Keeps a few cards mounted off-screen for a smooth mobile scroll
                    increaseViewportBy={{ top: 300, bottom: 600 }}
                    computeItemKey={(_, tr) => tr.id}
                    itemContent={(_, tr) => (
                      <TrainingCard
                        training={tr}
                        creator={creatorsById.get(tr.createdBy)}
                        currentUserId={CURRENT_USER_ID}
                        currentUser={currentUser}
                        userCoords={hasCurrentLocation ? userCoords : null}
                        onSelect={setSelectedTraining}
                        onJoin={handleJoinTraining}
                      />
                    )}
                    components={{ Item: VirtuosoSpacedItem }}
                  />
                )}
              </div>
            )}

            {/* ==================== TAB 3: CHATS (ЧАТЫ) — PREMIUM ONLY ==================== */}
            {activeTab === 'leisure' && currentUser && (
              <Suspense fallback={<p className="p-8 text-slate-400">Загружаем активный отдых…</p>}>
                <LeisureSection key={currentUser.id} user={currentUser} users={allUsers} isPremium={isPremium} initialEventId={leisureEventId}
                  onOpenUser={setSelectedUserModal} onOpenTariff={() => {setProfileSection('tariff');handleTabChange('profile');}} />
              </Suspense>
            )}

            {activeTab === 'chats' && currentUser && (
              <div className="space-y-4">
                {!isPremium ? (
                  /* PAYWALL for free accounts */
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-black text-white tracking-tight">Чаты с напарниками</h2>
                      <p className="text-xs text-slate-400">Общение доступно при взаимной симпатии</p>
                    </div>

                    <div className="bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                      <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border-2 border-amber-400 mx-auto flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(245,158,11,0.35)]">
                        🔒
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white">Чаты — функция Premium</h3>
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-xs mx-auto">
                          Переписка со спортсменами, с которыми у вас <b className="text-emerald-400">взаимная симпатия</b>, доступна только пользователям с Premium-подпиской SportBuddy СПб.
                        </p>
                      </div>

                      <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 text-left space-y-2 text-xs text-slate-300">
                        <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Безлимитные сообщения всем мэтчам</p>
                        <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Договаривайтесь о забегах и Падел-кортах</p>
                        <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Публикации в ленте и SportBuddy BOX</p>
                      </div>

                      <div className="space-y-2">
                        <button
                          onClick={() => { setProfileSection('tariff'); handleTabChange('profile'); }}
                          className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-slate-950 font-black rounded-2xl text-xs transition shadow-[0_0_25px_rgba(245,158,11,0.5)] active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Crown className="w-4 h-4 fill-slate-950" /> Активировать Premium 👑
                        </button>
                        <p className="text-[10px] text-slate-500">
                          Совет: 7 золотых медалей подряд дают 7 дней Premium бесплатно!
                        </p>
                      </div>
                    </div>

                    {/* Blurred preview of existing matches */}
                    {currentUser.matchIds.length > 0 && (
                      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
                        <p className="text-xs font-bold text-slate-300">
                          Вас уже ждут <b className="text-emerald-400">{currentUser.matchIds.length}</b> собеседник(а) 💬
                        </p>
                        {currentUser.matchIds.slice(0, 3).map(id => {
                          const u = allUsers.find(x => x.id === id);
                          if (!u) return null;
                          return (
                            <div key={id} className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                              <AvatarImage src={avatarUrl(u.avatar, 40) || AVATAR_FALLBACK} alt="" width={40} height={40} loading="lazy" decoding="async" className="w-10 h-10 rounded-full object-cover border border-emerald-500/60" />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-extrabold text-white">{u.name}</h4>
                                <p className="text-[11px] text-slate-500 blur-[3px] select-none">Привет! Побегаем в субботу?</p>
                              </div>
                              <span className="text-base">🔒</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : openChatThread && openChatCompanion ? (
                  /* ACTIVE CONVERSATION */
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-3xl p-3 shadow-lg">
                      <button
                        onClick={() => { triggerHapticImpact('light'); setOpenChatId(null); }}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition active:scale-90 shrink-0"
                        aria-label="Назад к списку чатов"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </button>
                      <AvatarImage
                        src={avatarUrl(openChatCompanion.avatar, 88) || AVATAR_FALLBACK}
                        width={44} height={44} decoding="async"
                        alt={openChatCompanion.name}
                        className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500 shadow"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black text-white truncate flex items-center gap-1.5">
                          {openChatCompanion.name}
                          {openChatCompanion.subscriptionPlan === 'premium' && (
                            <Crown className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          )}
                        </h3>
                        <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" /> {openChatCompanion.locationName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => { setComplaintContactId(openChatCompanion.id); setIsComplaintOpen(true); }}
                          className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 text-[9px] font-black text-rose-300 active:scale-95"
                        >
                          Пожаловаться
                        </button>
                        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/30">
                          {chatCategory === 'friends' ? 'ДРУГ 👥' : 'МЭТЧ 🤝'}
                        </span>
                      </div>
                    </div>

                    {chatMessagesOffline && (
                      <div role="status" className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] font-bold text-amber-300">
                        <WifiOff className="h-3.5 w-3.5"/> История чата временно офлайн. Показываем последние сохранённые сообщения.
                      </div>
                    )}

                    {/* Message list */}
                    <div ref={chatScrollRef} className="bg-slate-950 border border-slate-800 rounded-3xl p-4 space-y-3 min-h-[320px] max-h-[52vh] overflow-y-auto no-scrollbar">
                      <p className="text-center text-[10px] text-slate-600 font-medium">
                        Начало переписки • {openChatCompanion.sports.join(' • ')}
                      </p>

                      {openChatThread.messages.map((m: ChatMessage) => {
                        const mine = m.senderId === CURRENT_USER_ID;
                        const canDelete=mine&&!m.deletedAt&&Date.now()-m.timestamp<=15*60*1000;
                        return (
                          <div key={m.id} className={`group flex ${mine ? 'justify-end' : 'justify-start'} gap-2`}>
                            {!mine && (
                              <AvatarImage src={avatarUrl(openChatCompanion.avatar, 28) || AVATAR_FALLBACK} alt="" width={28} height={28} loading="lazy" decoding="async" className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0 mt-auto" />
                            )}
                            <div className="max-w-[78%]">
                              <div
                                className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow ${
                                  mine
                                    ? 'bg-emerald-500 text-slate-950 font-semibold rounded-br-md'
                                    : 'bg-slate-900 text-slate-100 border border-slate-800 rounded-bl-md'
                                }`}
                              >
                                {m.replyTo && (
                                  <div className={`mb-2 rounded-xl border-l-2 px-2.5 py-1.5 text-[10px] ${mine?'border-slate-900/40 bg-slate-950/10':'border-emerald-500/60 bg-slate-950/70 text-slate-400'}`}>
                                    <p className="font-black">{m.replyTo.senderId===CURRENT_USER_ID?'Вы':openChatCompanion.name}</p>
                                    <p className="truncate opacity-80">{m.replyTo.text||'Сообщение'}</p>
                                  </div>
                                )}
                                <p className={m.deletedAt?'italic opacity-70':''}>{m.text}</p>
                                <span className={`flex items-center gap-1 text-[9px] mt-1 ${mine ? 'text-emerald-900/70' : 'text-slate-500'}`}>
                                  {formatTimeLabel(m.timestamp)}
                                  {mine && !m.deletedAt && m.id === lastMineMessageId && (
                                    <>
                                      <span>·</span>
                                      <CheckCheck className="h-3 w-3"/>
                                      <span>{Number(openChatThread.readAt?.[openChatCompanion.id] || 0) >= m.timestamp ? 'прочитано' : 'доставлено'}</span>
                                    </>
                                  )}
                                </span>
                              </div>
                              {!m.deletedAt && (
                                <div className={`mt-1 flex gap-1 ${mine?'justify-end':'justify-start'}`}>
                                  <button onClick={()=>setChatReplyTarget(m)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold text-slate-500 hover:bg-slate-900 hover:text-slate-300">
                                    <Reply className="h-3 w-3"/> Ответить
                                  </button>
                                  {canDelete && (
                                    chatDeleteTargetId===m.id ? (
                                      <>
                                        <button onClick={()=>handleDeleteMessage(m)} className="rounded-lg bg-rose-500/15 px-2 py-1 text-[9px] font-black text-rose-300">Удалить для всех</button>
                                        <button onClick={()=>setChatDeleteTargetId(null)} className="rounded-lg px-2 py-1 text-[9px] font-bold text-slate-500">Отмена</button>
                                      </>
                                    ) : (
                                      <button onClick={()=>setChatDeleteTargetId(m.id)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold text-slate-500 hover:bg-rose-500/10 hover:text-rose-300">
                                        <Trash2 className="h-3 w-3"/> Удалить
                                      </button>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {companionTyping && (
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                          <span className="flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"/><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"/><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"/></span>
                          {openChatCompanion.name.split(' ')[0]} печатает…
                        </div>
                      )}

                    </div>

                    {/* ⚠️ Safety banner: companion suggested a non-sport meeting */}
                    <AnimatePresence>
                      {safetyWarning && (
                        <motion.button
                          initial={{ opacity: 0, y: 10, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -8, height: 0 }}
                          onClick={() => { triggerHapticImpact('light'); setSafetyWarning(null); }}
                          className="w-full overflow-hidden bg-amber-500/15 border border-amber-500/60 rounded-2xl p-3 flex items-start gap-2.5 text-left active:scale-[0.99] transition"
                        >
                          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-[11px] text-amber-100 leading-relaxed">
                              {safetyWarning}
                            </span>
                            <span className="block text-[10px] text-amber-400/70 font-bold mt-1">
                              Нажмите, чтобы скрыть
                            </span>
                          </span>
                          <CloseIcon className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {/* Composer */}
                    <div className="space-y-1.5">
                      {chatReplyTarget && (
                        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                          <Reply className="h-4 w-4 shrink-0 text-emerald-400"/>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-black uppercase tracking-wide text-emerald-400">Ответ на сообщение</p>
                            <p className="truncate text-[10px] text-slate-300">{chatReplyTarget.text}</p>
                          </div>
                          <button onClick={()=>setChatReplyTarget(null)} className="rounded-lg p-1 text-slate-500 hover:text-white" aria-label="Отменить ответ"><CloseIcon className="h-3.5 w-3.5"/></button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={2000}
                          value={chatDraft}
                          onChange={(e) => setChatDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) handleSendChatMessage(); }}
                          placeholder="Напишите сообщение..."
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={handleSendChatMessage}
                          disabled={chatSending || !chatDraft.trim()}
                          className={`px-4 rounded-2xl font-black transition shadow flex items-center justify-center shrink-0 ${
                            chatDraft.trim() && !chatSending
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_18px_rgba(16,185,129,0.5)] active:scale-95'
                              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                          aria-label="Отправить сообщение"
                        >
                          {chatSending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                      {chatDraft.length > 1500 && <p className="pr-1 text-right text-[9px] text-slate-500">{chatDraft.length}/2000</p>}
                    </div>

                    {/* Quick replies tailored to SPb */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                      {[
                        'Побегаем на Елагином? 🏃',
                        'Падел на Крестовском в субботу? 🎾',
                        'Велопрогулка от Севкабеля? 🚴',
                        'Во сколько встречаемся?'
                      ].map(q => (
                        <button
                          key={q}
                          onClick={() => setChatDraft(q)}
                          className="text-[11px] whitespace-nowrap bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl transition"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* THREAD LIST */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-black text-white tracking-tight">Чаты</h2>
                        <p className="text-xs text-slate-400">
                          {chatCategory === 'matches' ? 'Общение с взаимными симпатиями' : 'Общение с друзьями'}
                        </p>
                      </div>
                      <span className="text-[10px] font-black bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow">
                        <Crown className="w-3 h-3 fill-slate-950" /> PREMIUM
                      </span>
                    </div>

                    {/* Matches / Friends switcher */}
                    <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl flex gap-1">
                      {([
                        { id: 'matches' as ChatCategory, label: 'Мэтчи', icon: '💚', count: currentUser.matchIds.length },
                        { id: 'friends' as ChatCategory, label: 'Друзья', icon: '👥', count: friendsCount }
                      ]).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { triggerHapticImpact('light'); setChatCategory(c.id); setOpenChatId(null); }}
                          className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                            chatCategory === c.id
                              ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {c.icon} {c.label}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                            chatCategory === c.id ? 'bg-slate-950/20' : 'bg-slate-800'
                          }`}>
                            {c.count}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500"/>
                      <input
                        value={chatSearch}
                        onChange={e=>setChatSearch(e.target.value)}
                        placeholder="Поиск по имени, спорту или сообщениям"
                        className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-2.5 pl-9 pr-3 text-xs text-slate-100 outline-none focus:border-emerald-500"
                      />
                    </div>

                    {chatCategory === 'friends' && friendRequestsCount > 0 && (
                      <button
                        onClick={() => { setProfileSection('overview'); handleTabChange('profile'); }}
                        className="w-full bg-amber-500/15 border border-amber-500/50 rounded-2xl p-3 flex items-center gap-2.5 text-left active:scale-[0.99] transition"
                      >
                        <span className="text-lg shrink-0">📨</span>
                        <span className="flex-1 text-[11px] font-bold text-amber-300">
                          {friendRequestsCount} новых заявок в друзья — открыть профиль
                        </span>
                        <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
                      </button>
                    )}

                    {visibleChatThreads.length === 0 ? (
                      <div className="text-center py-14 px-4 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/40 mx-auto flex items-center justify-center text-3xl">
                          {chatCategory === 'matches' ? '💬' : '👥'}
                        </div>
                        <h3 className="text-base font-bold text-white">
                          {chatSearch.trim() ? 'Ничего не найдено' : chatCategory === 'matches' ? 'Пока нет взаимных симпатий' : 'Пока нет друзей'}
                        </h3>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                          {chatSearch.trim()
                            ? 'Попробуйте изменить запрос.'
                            : chatCategory === 'matches'
                              ? 'Чат открывается автоматически, когда вы и другой спортсмен из Санкт-Петербурга ставите друг другу «Симпатию».'
                              : 'Добавляйте спортсменов в друзья из анкет и таблицы лидеров — чат откроется после взаимного согласия.'}
                        </p>
                        <button
                          onClick={() => handleTabChange('discover')}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-2xl text-xs transition shadow-[0_0_18px_rgba(16,185,129,0.4)] active:scale-95 inline-flex items-center gap-2"
                        >
                          <Heart className="w-4 h-4 fill-slate-950 stroke-none" /> Найти напарника
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {visibleChatThreads.map(thread => {
                          const companion = allUsers.find(u => u.id === thread.companionId);
                          if (!companion) return null;
                          const last = thread.messages[thread.messages.length - 1];
                          const metadataUnread = Number(thread.unreadCount?.[CURRENT_USER_ID]);
                          const unread = Number.isFinite(metadataUnread) ? metadataUnread : thread.messages.filter(m => !m.read && m.senderId !== CURRENT_USER_ID).length;

                          return (
                            <button
                              key={thread.id}
                              onClick={() => handleOpenChat(thread.id)}
                              className="w-full text-left bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-3xl p-3.5 transition active:scale-[0.99] shadow-lg flex items-center gap-3"
                            >
                              <div className="relative shrink-0">
                                <AvatarImage
                                  src={avatarUrl(companion.avatar, 96) || AVATAR_FALLBACK}
                                  width={48} height={48} loading="lazy" decoding="async"
                                  alt={companion.name}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/70"
                                />
                                {Date.now() - Number(companion.lastSeenAt || 0) < 5 * 60 * 1000 && (
                                  <span title="Онлайн" className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-sm font-extrabold text-white truncate flex items-center gap-1">
                                    {companion.name}
                                    {companion.subscriptionPlan === 'premium' && (
                                      <Crown className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                                    )}
                                  </h4>
                                  <span className="text-[10px] text-slate-500 shrink-0">
                                    {last ? formatTimeLabel(last.timestamp) : ''}
                                  </span>
                                </div>
                                <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-slate-100 font-semibold' : 'text-slate-400'}`}>
                                  {last
                                    ? `${last.senderId === CURRENT_USER_ID ? 'Вы: ' : ''}${last.text}`
                                    : 'Начните диалог первым!'}
                                </p>
                                <p className="text-[10px] text-emerald-400/80 truncate mt-0.5">
                                  {companion.sports.slice(0, 3).join(' • ')}
                                </p>
                              </div>

                              {unread > 0 && (
                                <span className="bg-emerald-500 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow">
                                  {unread}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 4: FEED (ЛЕНТА) ==================== */}
            {activeTab === 'feed' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-white tracking-tight">Спортивная лента</h2>
                    <p className="text-xs text-slate-400">Достижения и тренировки сообщества</p>
                  </div>
                  
                  <button
                    onClick={() => {
                      triggerHapticImpact('medium');
                      if (!requirePublishingVerification()) return;
                      setIsCreatePostOpen(true);
                    }}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 transition shadow shrink-0 ${
                      canPublishToFeed
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <Newspaper className="w-4 h-4" /> 
                    <span>Пост {canPublishToFeed ? '👑' : '🔒'}</span>
                  </button>
                </div>

                {currentUser && <Stories key={currentUser.id} user={currentUser} canPublish={canPublishToFeed} onLocked={()=>{requirePublishingVerification();}}/>}

                {/* Live broadcast & gallery publishing */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      triggerHapticImpact('medium');
                      if (!requirePublishingVerification()) return;
                      setIsBroadcastOpen(true);
                    }}
                    className={`p-3.5 rounded-3xl border-2 text-left transition active:scale-95 ${
                      canPublishToFeed
                        ? 'bg-gradient-to-br from-rose-950/60 to-slate-900 border-rose-500/60 shadow-[0_0_18px_rgba(244,63,94,0.2)]'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="relative flex h-2 w-2">
                        <span className={`absolute inline-flex h-full w-full rounded-full ${canPublishToFeed ? 'bg-rose-400 animate-ping' : 'bg-slate-600'} opacity-75`} />
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${canPublishToFeed ? 'bg-rose-500' : 'bg-slate-600'}`} />
                      </span>
                      <span className={`text-xs font-black ${canPublishToFeed ? 'text-rose-300' : 'text-slate-400'}`}>
                        Видеозапись {canPublishToFeed ? '' : '🔒'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Запись видео с места тренировки
                    </p>
                  </button>

                  <button
                    onClick={handleOpenGallery}
                    disabled={uploadProgress !== null}
                    className={`p-3.5 rounded-3xl border-2 text-left transition active:scale-95 ${
                      canPublishToFeed
                        ? 'bg-gradient-to-br from-emerald-950/60 to-slate-900 border-emerald-500/60 shadow-[0_0_18px_rgba(16,185,129,0.2)]'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">🖼</span>
                      <span className={`text-xs font-black ${canPublishToFeed ? 'text-emerald-300' : 'text-slate-400'}`}>
                        Из галереи {canPublishToFeed ? '' : '🔒'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Фото или видео с телефона
                    </p>
                  </button>
                </div>

                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleGalleryUpload}
                  className="hidden"
                />

                {/* Feed — virtualised: only visible posts stay mounted */}
                <Virtuoso
                  useWindowScroll
                  data={feedPosts}
                  increaseViewportBy={{ top: 400, bottom: 800 }}
                  computeItemKey={(_, post) => post.id}
                  itemContent={(_, post) => (
                    <PostCard
                      post={post}
                      currentUserId={CURRENT_USER_ID}
                      currentUserAvatar={currentUser?.avatar}
                      isCommentsOpen={activeCommentPostId === post.id}
                      commentDraft={newCommentText}
                      onToggleLike={handleToggleLikePost}
                      onToggleComments={handleToggleComments}
                      onShare={handleSharePost}
                      onCommentDraftChange={setNewCommentText}
                      onSendComment={handleSendComment}
                    />
                  )}
                  components={{
                    Item: VirtuosoSpacedItem,
                    EmptyPlaceholder: FeedEmptyPlaceholder
                  }}
                />

              </div>
            )}

            {/* ==================== TAB 4: PROFILE (ПРОФИЛЬ) ==================== */}
            {activeTab === 'profile' && currentUser && (
              <div className="space-y-5 pb-6">
                {/* Profile inner navigation */}
                <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl flex gap-1">
                  {([
                    { id: 'overview', label: 'Обзор', icon: '👤' },
                    { id: 'edit', label: 'Профиль', icon: '✏️' },
                    { id: 'tariff', label: 'Тариф', icon: '👑' },
                    { id: 'legal', label: 'Право', icon: '⚖️' }
                  ] as const).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { triggerHapticImpact('light'); setProfileSection(s.id); }}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${
                        profileSection === s.id
                          ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>

                {/* Anti-fraud banner visible on every profile section */}
                {!hasPersonalPhoto(currentUser) && profileSection !== 'edit' && (
                  <button
                    onClick={() => setProfileSection('edit')}
                    className="w-full bg-rose-950/60 border-2 border-rose-500/60 rounded-3xl p-3.5 flex items-center gap-3 text-left transition active:scale-[0.99]"
                  >
                    <span className="text-2xl shrink-0">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-white">
                        Аккаунт будет удалён через {hoursUntilDeletion(currentUser)} ч
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Загрузите личное фото — защита сообщества от мошенников
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-rose-400 shrink-0" />
                  </button>
                )}

                {profileSection === 'edit' && (
                  <ProfileEditor
                    user={currentUser}
                    onUpdateUser={(u) => {
                      setCurrentUser(u);
                      setAllUsers(prev => prev.map(x => (x.id === u.id ? u : x)));
                    }}
                  />
                )}

                {profileSection === 'tariff' && (
                  <PricingSection
                    user={currentUser}
                  />
                )}

                {profileSection === 'legal' && (
                  <LegalSection
                    onReport={() => {
                      triggerHapticNotification('warning');
                      setIsComplaintOpen(true);
                    }}
                    onAdminTrigger={handleVersionTap}
                  />
                )}

                {profileSection === 'passport' && (
                  <SportPassportView
                    user={currentUser}
                    onBack={() => setProfileSection('overview')}
                    onUserUpdate={(next) => {
                      setCurrentUser(next);
                      setAllUsers(prev => prev.map(item => item.id === next.id ? next : item));
                    }}
                  />
                )}

                {profileSection === 'overview' && (
                  <>
                {/* Profile Card & Avatar */}
                <div className="bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl relative">
                  <ProfileSummary
                    user={currentUser}
                    friendsCount={friendsCount}
                    isPremium={isPremium}
                    avatar={avatarUrl(currentUser.avatar, 160) || AVATAR_FALLBACK}
                    onUpdateAvatar={handleUpdateAvatar}
                    birthday={currentUser.birthDate ? (currentUser.hideBirthDate
                      ? `${calculateAge(currentUser.birthDate) ?? currentUser.age} лет · дата рождения скрыта`
                      : `День рождения · ${formatBirthDate(currentUser.birthDate)}`) : undefined}
                  />

                  {/* Bio & Sports */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                    <p className="text-xs text-slate-300 leading-relaxed italic">"{currentUser.bio}"</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {currentUser.sports.map(s => (
                        <span key={s} className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/30 font-semibold">
                          #{s}
                        </span>
                      ))}
                    </div>

                    {/* Photo portfolio preview */}
                    {(currentUser.photoPortfolio?.length || 0) > 0 && (
                      <div className="pt-2">
                        <p className="text-[11px] font-bold text-slate-400 mb-1.5">
                          📸 Портфолио ({currentUser.photoPortfolio?.length}/5)
                        </p>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                          {currentUser.photoPortfolio?.map((url, i) => (
                            <img
                              key={i}
                              src={cldUrl(url, { width: 160, height: 160, crop: 'fill' })}
                              alt={`Спортивное фото ${i + 1}`}
                              loading="lazy"
                              className="w-20 h-20 rounded-2xl object-cover border border-slate-700 shrink-0"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <SportPassportCard
                  user={currentUser}
                  onOpen={() => {
                    triggerHapticImpact('light');
                    setProfileSection('passport');
                  }}
                />

                {/* Countdown to the next signed-up training */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> Мои ближайшие тренировки
                  </h4>
                  <UpcomingTrainings
                    // Account-specific journal prevents stale demo/cache
                    // participant records from appearing for a new athlete.
                    trainings={actualJoinedTrainings}
                    joinedTrainingIds={actualJoinedTrainingIds}
                    userId={CURRENT_USER_ID}
                    onOpenTraining={(t) => setSelectedTraining(t)}
                  />
                </div>

                {/* Compact stats with expandable full breakdown */}
                <ProfileStatsSection
                  user={currentUser}
                  trainings={trainings}
                  joinedTrainingIds={actualJoinedTrainingIds}
                />

                <BetaNotice />

                {/* Three-tier medals: bronze → silver → gold */}
                <MedalsSection
                  user={currentUser}
                  onUpdateUser={setCurrentUser}
                  onOpenModal={openRewardModal}
                />

                {/* Daily-limited workout progress (anti-fraud: 1 per 24h) */}
                <WorkoutProgress user={currentUser} />

                {/* Admin entry point — only visible to actual administrators or via secret tap trigger */}
                {isAdminUser && (
                  <button
                    onClick={() => {
                      triggerHapticImpact('medium');
                      if (isAdminUser) setIsAdminOpen(true);
                      else setIsAdminAccessOpen(true);
                    }}
                    className="w-full bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 border-2 border-amber-500/60 rounded-3xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition shadow-xl"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-amber-500 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-5 h-5 text-slate-950" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-white">
                        {isAdminUser ? 'Кабинет администратора' : 'Подтвердить вход администратора'}
                      </h4>
                      <p className="text-[11px] text-slate-300 truncate">
                        Создание официальных мероприятий SportBuddy
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
                  </button>
                )}

                {/* Interface theme customisation (Premium) */}
                <ThemeSection
                  theme={theme}
                  onChange={setTheme}
                  isPremium={isPremium}
                  onGoPremium={() => setProfileSection('tariff')}
                />

                {/* Personal goals & progress tracking */}
                <GoalsSection user={currentUser} />

                {/* Participant rating from organizers */}
                <RatingSection user={currentUser} compact />

                {/* Friends list (Premium) */}
                <div id="profile-friends" /><FriendsSection key={friendsNotificationVersion}
                  user={currentUser}
                  allUsers={allUsers}
                  syncError={Object.values(friendSyncErrors).some(Boolean)}
                  isPremium={isPremium}
                  onUpdateUser={applyFriendUpdate}
                  onOpenProfile={(u) => setSelectedUserModal(u)}
                  onOpenChat={goToFriendChat}
                  onGoPremium={() => setProfileSection('tariff')}
                />

                {/* Subscription, promo codes, biometrics & logout */}
                <PromoSection
                  user={currentUser}
                  onUpdateUser={(newUser) => setCurrentUser(newUser)}
                  onLogout={handleLogout}
                />

                {/* Full-Featured Rewards, Medals & SportBuddy BOX section */}
                <RewardsSection
                  user={currentUser}
                  onUpdateUser={setCurrentUser}
                  onOpenModal={openRewardModal}
                />

                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Official event details */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Мероприятие SportBuddy"
        subtitle={selectedEvent ? getCategoryConfig(selectedEvent.category).label : undefined}
        maxWidth="lg"
        footer={
          selectedEvent && currentUser && (() => {
            const registered = isRegistered(selectedEvent, currentUser.id);
            const full = selectedEvent.participantIds.length >= selectedEvent.participantsMax;
            return (
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => shareContent(
                    `Мероприятие SportBuddy: ${selectedEvent.title}`,
                    `${selectedEvent.tagline} • ${selectedEvent.dateLabel} • ${selectedEvent.locationName}`,
                    window.location.href
                  )}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs transition flex items-center gap-1.5"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleEventRegistration(selectedEvent)}
                  disabled={!registered && full}
                  className={`flex-1 py-3 font-black rounded-2xl text-xs transition active:scale-95 ${
                    registered
                      ? 'bg-rose-500 text-white'
                      : full
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.45)]'
                  }`}
                >
                  {registered ? 'Отменить участие ❌' : full ? 'Мест больше нет' : '🏆 Зарегистрироваться'}
                </button>
              </div>
            );
          })()
        }
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            {selectedEvent.coverUrl && (
              <img
                src={cldUrl(selectedEvent.coverUrl, { width: 720, height: 360, crop: 'fill' })}
                width={720} height={360} loading="lazy" decoding="async"
                alt={selectedEvent.title}
                className="w-full h-40 object-cover rounded-2xl border border-slate-800"
              />
            )}

            {selectedEvent.videoUrl && (
              <video
                src={selectedEvent.videoUrl}
                poster={videoPoster(selectedEvent.videoUrl)}
                preload="metadata"
                controls playsInline
                className="w-full max-h-56 rounded-2xl border border-slate-800 bg-black"
              />
            )}

            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase bg-emerald-500 text-slate-950 px-2 py-1 rounded-lg mb-2">
                ✓ Официальное мероприятие
              </span>
              <h3 className="text-lg font-black text-white leading-snug">{selectedEvent.title}</h3>
              <p className="text-emerald-400 font-semibold mt-0.5">{selectedEvent.tagline}</p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2">
              <p className="flex items-center gap-2 text-slate-200">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                {selectedEvent.dateLabel} • {selectedEvent.time}
              </p>
              <p className="flex items-center gap-2 text-slate-200">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                {selectedEvent.locationName} ({selectedEvent.address})
              </p>
              {selectedEvent.prizePool && (
                <p className="flex items-center gap-2 text-amber-300 font-bold">
                  🏆 {selectedEvent.prizePool}
                </p>
              )}
              {selectedEvent.entryFee && (
                <p className="text-slate-300">🎟 Участие: {selectedEvent.entryFee}</p>
              )}
            </div>

            <p className="text-slate-200 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              {selectedEvent.description}
            </p>

            <ProgressBar
              percentage={eventFillPercent(selectedEvent)}
              label={`Участники: ${selectedEvent.participantIds.length} / ${selectedEvent.participantsMax}`}
              subLabel={`Свободно ${Math.max(0, selectedEvent.participantsMax - selectedEvent.participantIds.length)}`}
              color={eventFillPercent(selectedEvent) > 85 ? 'amber' : 'emerald'}
              height="sm"
            />

            <Suspense fallback={<MapFallback height="180px" />}>
              <LeafletMap
                center={{ lat: selectedEvent.lat, lng: selectedEvent.lng }}
                zoom={14}
                height="180px"
              />
            </Suspense>
          </div>
        )}
      </Modal>

      {/* Admin panel — only for support@sportbuddy78.ru */}
      {currentUser && (
        <Suspense fallback={null}>
          <AdminPanel
            isOpen={isAdminOpen}
            onClose={() => setIsAdminOpen(false)}
            currentUser={currentUser}
            authorized={isAdminUser}
            onEventsChanged={() => setEventsRefreshKey(k => k + 1)}
          />
        </Suspense>
      )}

      {/* Mandatory OTP step: support@sportbuddy78.ru receives a new code on every login */}
      <Suspense fallback={null}>
        <AdminAccessModal
          isOpen={isAdminAccessOpen}
          onClose={() => setIsAdminAccessOpen(false)}
          onVerified={() => {
            setAdminSessionVersion((v) => v + 1);
            setIsAdminAccessOpen(false);
            setIsAdminOpen(true);
          }}
        />
      </Suspense>

      {/* First sign-in after registration: public 30-day beta welcome */}
      <Modal
        isOpen={welcomeTrialShown}
        onClose={() => setWelcomeTrialShown(false)}
        title="Добро пожаловать в SportBuddy78"
        subtitle={isBetaActive() ? "Premium бесплатно до конца 2026 года · подтвердите профиль для публикаций" : "Пройдите верификацию — откройте 30 дней Premium"}
        footer={
          <button
            onClick={() => setWelcomeTrialShown(false)}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-3.5 text-sm font-black text-slate-950 active:scale-[0.98]"
          >
            Начать свой путь
          </button>
        }
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-500/30 to-emerald-500/20 text-4xl shadow-[0_0_30px_rgba(251,191,36,0.2)]">
            {currentUser?.isVerified ? '🎉' : '🛡️'}
          </div>
          <div>
            {currentUser?.isVerified ? (
              <>
                <h3 className="sb-display text-base font-black text-white">{isBetaActive() ? 'Premium открыт до конца 2026 года' : '30 дней Premium активированы'}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  Вход через VK ID подтвердил вашу личность — верификация пройдена автоматически.
                  {isBetaActive() ? 'Чаты и публикации открыты. SportBuddy BOX станет доступен с 1 января 2027 года.' : 'Чаты, публикации и SportBuddy BOX доступны по условиям Premium.'}
                  На бесплатном тарифе доступны 5 взаимных мэтчей за 7 дней; Premium снимает это ограничение.
                </p>
              </>
            ) : (
              <>
                <h3 className="sb-display text-base font-black text-white">{isBetaActive() ? 'Подтвердите профиль для публикаций' : 'Верификация открывает Premium'}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  {isBetaActive() ? 'Premium уже открыт для всех до конца 2026 года. Добавьте личное фото и одно фото в портфолио, чтобы подтвердить профиль и публиковать в ленте. SportBuddy BOX откроется 1 января 2027 года.' : 'Добавьте личное фото и одно фото в портфолио — после проверки получите 30 дней Premium бесплатно: чаты, публикации и BOX по условиям программы. На бесплатном тарифе доступны 5 взаимных мэтчей за 7 дней; Premium снимает лимит.'}
                </p>
              </>
            )}
          </div>
          {!currentUser?.isVerified && (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3 text-left">
              <p className="text-[11px] font-bold text-slate-300">Что нужно для верификации:</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                📸 Личное фото лица · 🖼 одно спортивное фото в портфолио · ⏱ в течение 24 часов.
                Без верификации аккаунт удаляется, но вы сможете зарегистрироваться заново.
              </p>
            </div>
          )}

          {isBetaActive() && (
            <div className="rounded-2xl border border-amber-400/45 bg-amber-400/[0.08] p-3.5 text-left">
              <p className="text-[11px] font-black text-amber-300">🎁 О призовых SportBuddy BOX</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{TEST_PERIOD_MESSAGE}</p>
            </div>
          )}

          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.07] p-3.5 text-left">
            <p className="text-[11px] font-black text-emerald-300">Помогите сделать SportBuddy78 лучше</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
              Пользуйтесь сервисом: создавайте и посещайте тренировки, отмечайтесь по GPS,
              пробуйте календарь, чаты и медали. Если заметите проблему или неудобный сценарий,
              сообщите нам через раздел «Право» или поддержку.
            </p>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Культ спорта и здоровых отношений • Санкт-Петербург
          </p>
        </div>
      </Modal>

      {/* Возможности проекта: показываются новичку один раз, дальше — по кнопке в шапке */}
      <WelcomeGuide
        isOpen={isGuideOpen}
        onClose={closeGuide}
        userName={currentUser?.name}
        onStart={() => {
          closeGuide();
          setActiveTab('discover');
        }}
      />

      {/* Safety complaint: choose a real chat contact, then open a prefilled support email */}
      <ComplaintModal
        isOpen={isComplaintOpen}
        onClose={() => { setIsComplaintOpen(false); setComplaintContactId(undefined); }}
        reporter={currentUser}
        contacts={reportableChatContacts}
        initialContactId={complaintContactId}
      />

      {/* Rate participants after a finished training */}
      <RateParticipantsModal
        isOpen={!!ratingTraining}
        onClose={() => setRatingTraining(null)}
        training={ratingTraining}
        organizer={currentUser}
        allUsers={allUsers}
        onRated={handleParticipantRated}
      />

      {/* Participant survey: rates the organizer after a real completed session */}
      <RateOrganizerModal
        isOpen={!!organizerRatingTraining}
        onClose={() => setOrganizerRatingTraining(null)}
        training={organizerRatingTraining}
        participant={currentUser}
        organizer={
          organizerRatingTraining
            ? allUsers.find((u) => u.id === organizerRatingTraining.createdBy) ?? null
            : null
        }
        onSubmitted={handleOrganizerRated}
      />

      {/* Video recording studio (full screen) */}
      <Suspense fallback={null}>
        <LiveBroadcast
          isOpen={isBroadcastOpen}
          onClose={() => setIsBroadcastOpen(false)}
          authorName={currentUser?.name || 'Спортсмен'}
          locationLabel={userLocationLabel}
          onPublish={handlePublishBroadcast}
        />
      </Suspense>

      <PlacesSection
        isOpen={isPlacesOpen}
        onClose={() => setIsPlacesOpen(false)}
        onCreateTraining={handleCreateTrainingFromVenue}
      />

      {/* 3. Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        unreadCount={unreadNotifCount}
        chatUnreadCount={chatUnreadCount}
        isPremium={isPremium}
      />

      {/* 4. MODALS */}

      {/* MODAL 1: MATCH CELEBRATION (ВЗАИМНАЯ СИМПАТИЯ) */}
      <Modal
        isOpen={!!matchedUser}
        onClose={() => setMatchedUser(null)}
        title="Взаимная симпатия! 🎉💚"
        subtitle="Новый спортивный напарник найден!"
        footer={
          <div className="flex gap-2 w-full">
            <button
              onClick={() => {
                triggerHapticImpact('medium');
                if (matchedUser) goToChatWith(matchedUser);
              }}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-2xl text-sm transition shadow-[0_4px_15px_rgba(16,185,129,0.5)] active:scale-95 flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> {isPremium ? 'Написать в чат' : 'Открыть чаты 🔒'}
            </button>
            <button
              onClick={() => setMatchedUser(null)}
              className="px-4 py-3 bg-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-bold transition"
            >
              Позже
            </button>
          </div>
        }
      >
        {matchedUser && (
          <div className="text-center py-2 space-y-4">
            <div className="flex items-center justify-center gap-4">
              <AvatarImage src={avatarUrl(currentUser?.avatar, 160) || AVATAR_FALLBACK} alt="" width={80} height={80} decoding="async" className="w-20 h-20 rounded-full object-cover border-4 border-emerald-400 shadow-xl" />
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-[0_0_20px_rgba(16,185,129,0.8)] z-10 animate-bounce">
                🤝
              </div>
              <AvatarImage src={avatarUrl(matchedUser.avatar, 160) || AVATAR_FALLBACK} alt="" width={80} height={80} decoding="async" className="w-20 h-20 rounded-full object-cover border-4 border-emerald-400 shadow-xl" />
            </div>
            
            <div>
              <h3 className="text-xl font-extrabold text-white">{matchedUser.name} также ищет партнера для тренировок!</h3>
              <p className="text-xs text-slate-300 mt-1">Общие дисциплины: <b className="text-emerald-400">{matchedUser.sports.join(', ')}</b></p>
            </div>

            {/* ⚠️ Platform rule: dating happens through sport only */}
            <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-3.5 flex items-start gap-2.5 text-left">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Dumbbell className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-emerald-300 flex items-center gap-1 mb-0.5">
                  🏃‍♂️ Знакомства только на тренировках
                </p>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  {MATCH_SAFETY_REMINDER}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              💡 Совет SportBuddy СПб: Предложите совместный забег в {matchedUser.locationName.split(',')[0]}, матч в Падел на Крестовском или вечернюю велопрогулку вдоль Финского залива!
            </p>
          </div>
        )}
      </Modal>

      {/* MODAL 2: USER PROFILE DETAILS */}
      <Modal
        isOpen={!!selectedUserModal}
        onClose={() => setSelectedUserModal(null)}
        title="Анкета спортсмена"
        footer={
          selectedUserModal && selectedUserModal.id !== CURRENT_USER_ID ? (
            <div className="flex gap-2 w-full">
              <button
                onClick={() => { handleSkipCandidate(selectedUserModal.id); setSelectedUserModal(null); }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-2xl text-xs transition"
              >
                Пропустить
              </button>
              <button
                onClick={() => { handleLikeCandidate(selectedUserModal); setSelectedUserModal(null); }}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 rounded-2xl text-xs transition shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center justify-center gap-1"
              >
                <Heart className="w-4 h-4 fill-slate-950 stroke-none" /> Симпатия
              </button>
            </div>
          ) : undefined
        }
      >
        {selectedUserModal && (
          <div className="space-y-4">
            {/* Friend action (Premium) */}
            {currentUser && selectedUserModal.id !== CURRENT_USER_ID && (() => {
              const status = getFriendStatus(currentUser, selectedUserModal.id);
              const cfg = {
                none:     { text: '➕ Добавить в друзья', cls: 'bg-emerald-500 text-slate-950' },
                sent:     { text: '⏳ Заявка отправлена — отменить', cls: 'bg-slate-800 text-slate-300 border border-slate-700' },
                received: { text: '✅ Принять заявку в друзья', cls: 'bg-amber-500 text-slate-950' },
                friends:  { text: '👥 Вы друзья — написать', cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/50' }
              }[status];
              return (
                <button
                  onClick={() => {
                    if (status === 'friends') {
                      setSelectedUserModal(null);
                      goToFriendChat(selectedUserModal);
                    } else {
                      handleFriendAction(selectedUserModal);
                    }
                  }}
                  className={`w-full py-3 rounded-2xl font-black text-xs transition active:scale-95 ${cfg.cls} ${!isPremium ? 'opacity-70' : ''}`}
                >
                  {isPremium ? cfg.text : '🔒 Друзья — только для Premium'}
                </button>
              );
            })()}

            <div className="flex items-center gap-3">
              <AvatarImage src={avatarUrl(selectedUserModal.avatar, 128) || AVATAR_FALLBACK} alt="" width={64} height={64} loading="lazy" decoding="async" className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow" />
              <div>
                <h3 className="text-lg font-black text-white">{selectedUserModal.name}, {selectedUserModal.age}</h3>
                <p className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" /> {districtLabel(selectedUserModal.districtId) || selectedUserModal.locationName}
                </p>
                <div className="mt-1">
                  <StarRating value={Math.round(computeAverageRating(selectedUserModal))} size="sm" readOnly />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-medium">Рейтинг</span>
                <span className="text-amber-400 font-black text-sm">
                  ★ {computeAverageRating(selectedUserModal).toFixed(1)}
                </span>
                <span className="block text-[9px] text-slate-500">
                  {selectedUserModal.ratingCount || 0} оценок
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-medium">Тренировок</span>
                <span className="text-slate-200 font-black text-sm">{selectedUserModal.totalWorkouts}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-medium">Медалей</span>
                <span className="text-emerald-400 font-black text-sm">🏅 {selectedUserModal.totalDailyMedals}</span>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-400 mb-1.5">Спортивные дисциплины</h5>
              <div className="flex flex-wrap gap-1.5">
                {selectedUserModal.sports.map(s => (
                  <span key={s} className="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/40">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-400 mb-1">О себе и тренировочных целях</h5>
              <p className="text-xs text-slate-200 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                "{selectedUserModal.bio}"
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: CREATE TRAINING */}
      <Modal
        isOpen={isCreateTrainingOpen}
        onClose={() => {
          setIsCreateTrainingOpen(false);
          setSelectedVenueForTraining(null);
          setVenueRentalConfirmed(false);
        }}
        title={newTrSport === 'Походы' ? 'Новый поход' : 'Новая тренировка'}
        subtitle={newTrSport === 'Походы'
          ? 'Найдите компанию для активного отдыха и красивого маршрута'
          : 'Организуйте совместные пробежки или игры'}
      >
        <form onSubmit={handleSubmitTraining} className="space-y-4 text-xs">
          {selectedVenueForTraining && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-emerald-200">Площадка: {selectedVenueForTraining.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-300">{selectedVenueForTraining.address}</p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    SportBuddy не бронирует площадку автоматически. Сначала согласуйте дату и время с владельцем.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-slate-700 bg-slate-950/70 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={venueRentalConfirmed}
                  onChange={event => setVenueRentalConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-500"
                />
                <span className="text-[11px] leading-relaxed text-slate-200">
                  Я самостоятельно связался с площадкой и подтверждаю, что аренда на выбранное время согласована.
                </span>
              </label>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-300 mb-1">Название тренировки *</label>
            <input
              type="text"
              required
              placeholder={newTrSport === 'Походы'
                ? 'Например: Поход к Линдуловской роще'
                : 'Например: Утренняя интервальная беговая'}
              value={newTrTitle}
              onChange={e => setNewTrTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Вид спорта</label>
              <select
                value={newTrSport}
                onChange={e => setNewTrSport(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {SPORTS.filter(s => s !== 'Активный отдых').map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                {newTrSport === 'Походы' ? 'Сложность маршрута' : 'Уровень участников'}
              </label>
              <select
                value={newTrLevel}
                onChange={e => setNewTrLevel(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 font-semibold"
              >
                <option value="amateur">{newTrSport === 'Походы' ? 'Лёгкий' : 'Начинающие'}</option>
                <option value="semi-pro">{newTrSport === 'Походы' ? 'Средний' : 'Любитель+'}</option>
                <option value="pro">{newTrSport === 'Походы' ? 'Сложный' : 'Профессионалы'}</option>
              </select>
            </div>
          </div>

          <DistrictSelect value={newTrDistrict} onChange={setNewTrDistrict} label="Район места встречи" emptyLabel="Выберите район" required />
          <p className="text-xs text-slate-400">Укажите район тренировки, даже если живёте в другом. Для похода — район старта.</p>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Дата</label>
              <input
                type="date"
                value={newTrDate}
                min={toDayKey(new Date())}
                onChange={e => setNewTrDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Время старта</label>
              <input
                type="time"
                value={newTrTime}
                onChange={e => setNewTrTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[9px] text-emerald-400 font-bold mt-1 truncate">
                {formatDayLabel(newTrDate)}, {newTrTime}
              </p>
            </div>

            <div>
              <label htmlFor="training-participant-gender" className="block font-bold text-slate-300 mb-1">Кто может записаться</label>
              <select id="training-participant-gender" value={newTrGender} onChange={e => setNewTrGender(e.target.value as 'any' | 'male' | 'female')} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-slate-100">
                <option value="any">Любой</option>
                <option value="male">Мужчины</option>
                <option value="female">Женщины</option>
              </select>
              <p className="mt-2 text-xs text-slate-400">Ограничение для новых участников. При записи учитывается пол, указанный в профиле.</p>
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1">Макс. мест</label>
              <input
                type="number"
                min={2}
                max={50}
                value={newTrMax}
                onChange={e => setNewTrMax(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-slate-100 font-mono font-bold"
              />
            </div>
          </div>

          {/* Leaflet Map Point Picker Button */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-emerald-400" /> {newTrSport === 'Походы' ? 'Точка старта:' : 'Локация тренировки:'}
              </span>
              <button
                type="button"
                onClick={() => setIsMapSelectorOpen(true)}
                className="text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold px-3 py-1 rounded-lg border border-emerald-500/30 transition"
              >
                {selectedVenueForTraining
                  ? '📍 Подтвердить точку площадки'
                  : newTrSport === 'Походы'
                    ? '📍 Выбрать точку старта'
                    : '📍 Выбрать на карте Leaflet'}
              </button>
            </div>
            <p className="font-semibold text-emerald-300 truncate">{newTrAddress}, {newTrCity}</p>
            <p className="text-[10px] text-slate-500 font-mono">Координаты: {newTrCoords.lat.toFixed(4)}, {newTrCoords.lng.toFixed(4)}</p>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">
              {newTrSport === 'Походы' ? 'Маршрут и план похода' : 'Описание и план тренировки'}
            </label>
            <textarea
              rows={3}
              placeholder={newTrSport === 'Походы'
                ? 'Куда идём, примерная дистанция, продолжительность, что взять с собой и где встречаемся...'
                : 'Что берем с собой, как находим друг друга, темп пробежки...'}
              value={newTrDesc}
              onChange={e => setNewTrDesc(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsCreateTrainingOpen(false);
                setSelectedVenueForTraining(null);
                setVenueRentalConfirmed(false);
              }}
              className="px-4 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl transition"
            >
              Отменить
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl transition shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-95"
            >
              {newTrSport === 'Походы' ? 'Создать поход' : 'Создать тренировку'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: INTERACTIVE MAP PIN SELECTOR FOR NEW TRAINING */}
      <Modal
        isOpen={isMapSelectorOpen}
        onClose={() => setIsMapSelectorOpen(false)}
        title={newTrSport === 'Походы' ? 'Выберите точку старта' : 'Выберите точку на карте'}
        subtitle={newTrSport === 'Походы' ? 'Отметьте место сбора группы' : 'Кликните в любое место OpenStreetMap'}
        maxWidth="lg"
        footer={
          <button
            onClick={() => {
              triggerHapticImpact('medium');
              if (!newTrLocationSelected) { notify('Сначала нажмите на место встречи на карте', 'err'); return; }
              setIsMapSelectorOpen(false);
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl transition shadow-[0_0_20px_rgba(16,185,129,0.5)] w-full"
          >
            Подтвердить выбранную локацию
          </button>
        }
      >
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            {newTrSport === 'Походы'
              ? 'Отметьте точку, где участники собираются перед стартом маршрута:'
              : 'Нажмите на любую спортивную площадку, парк или стадион, чтобы прикрепить адрес:'}
          </p>
          <Suspense fallback={<MapFallback height="380px" />}>
            <LeafletMap
              center={newTrCoords}
              zoom={13}
              interactiveSelect={true}
              selectedCoords={newTrLocationSelected ? newTrCoords : null}
              onSelectPoint={(coords, addr) => {
                setNewTrCoords(coords);
                setNewTrLocationSelected(true);
                setNewTrAddress(addr.shortAddress);
                setNewTrCity(addr.city);
              }}
              height="380px"
            />
          </Suspense>
        </div>
      </Modal>

      {/* MODAL 5: TRAINING DETAILS OVERVIEW */}
      <Modal
        isOpen={!!selectedTraining}
        onClose={() => setSelectedTraining(null)}
        title="Информация о тренировке"
        footer={
          selectedTraining && (
            isOrganizer(selectedTraining, CURRENT_USER_ID) ? (
              <div className="w-full space-y-2">
                {!selectedTraining.isCompleted ? (
                  <button
                    onClick={() => handleCompleteTraining(selectedTraining)}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-2xl text-xs transition shadow-[0_0_20px_rgba(245,158,11,0.45)] active:scale-95 flex items-center justify-center gap-2"
                  >
                    🏁 Завершить тренировку и оценить участников
                  </button>
                ) : pendingRatings(selectedTraining).length > 0 ? (
                  <button
                    onClick={() => { setSelectedTraining(null); setRatingTraining(selectedTraining); }}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-2xl text-xs transition shadow-[0_0_20px_rgba(245,158,11,0.45)] active:scale-95"
                  >
                    ⭐️ Оценить участников ({pendingRatings(selectedTraining).length})
                  </button>
                ) : (
                  <p className="w-full text-center py-3 bg-slate-950 border border-emerald-500/40 text-emerald-400 font-bold rounded-2xl text-xs">
                    ✅ Тренировка завершена, все подтвердившие участие оценены
                  </p>
                )}
                <button
                  onClick={() => shareContent(
                    `Приглашение в тренировку: ${selectedTraining.title}`,
                    `Привет! Присоединяйся к тренировке по ${selectedTraining.sport} в SportBuddy! Место: ${selectedTraining.locationName} (${selectedTraining.dateLabel}).`,
                    `${window.location.origin}/#training=${selectedTraining.id}`
                  )}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-4 h-4" /> Поделиться
                </button>
              </div>
            ) : selectedTraining.isCompleted ? (
            <div className="w-full space-y-2">
              {(() => {
                const checkedIn = Boolean(getMyCheckIn(selectedTraining.id, CURRENT_USER_ID)?.verified);
                const pendingSurvey = pendingOrganizerRatings(selectedTraining).includes(CURRENT_USER_ID);
                if (checkedIn && pendingSurvey) {
                  return (
                    <button
                      onClick={() => { setSelectedTraining(null); setOrganizerRatingTraining(selectedTraining); }}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-black rounded-2xl text-xs shadow-[0_0_20px_rgba(16,185,129,0.45)] active:scale-95"
                    >
                      ⭐ Как прошла тренировка? Оценить организатора
                    </button>
                  );
                }
                return (
                  <p className="w-full text-center py-3 bg-slate-950 border border-slate-700 text-slate-400 font-bold rounded-2xl text-xs">
                    {checkedIn ? '✅ Участие подтверждено, опрос уже заполнен' : '🏁 Тренировка завершена — GPS-присутствие не подтверждено'}
                  </p>
                );
              })()}
              <button
                onClick={() => shareContent(
                  `Тренировка SportBuddy: ${selectedTraining.title}`,
                  `${selectedTraining.title} • ${selectedTraining.locationName}`,
                  `${window.location.origin}/#training=${selectedTraining.id}`
                )}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-4 h-4" /> Поделиться
              </button>
            </div>
            ) : (
            <div className="flex gap-2 w-full">
              <button
                onClick={() => shareContent(
                  `Приглашение в тренировку: ${selectedTraining.title}`,
                  `Привет! Присоединяйся к тренировке по ${selectedTraining.sport} в SportBuddy! Место: ${selectedTraining.locationName} (${selectedTraining.dateLabel}).`,
                  `${window.location.origin}/#training=${selectedTraining.id}`
                )}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-4 h-4" /> Поделиться
              </button>
              
              <button
                onClick={() => handleJoinTraining(selectedTraining)}
                disabled={selectedTraining.isCompleted || (!selectedTraining.participantIds.includes(CURRENT_USER_ID) && Boolean(trainingGenderError(selectedTraining, currentUser)))}
                className={`flex-1 font-black py-2.5 rounded-xl text-xs transition shadow flex items-center justify-center gap-1.5 ${
                  selectedTraining.isCompleted
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : selectedTraining.participantIds.includes(CURRENT_USER_ID)
                    ? 'bg-rose-500 text-white hover:bg-rose-600 shadow'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                }`}
              >
                {selectedTraining.isCompleted
                  ? 'Тренировка завершена 🏁'
                  : selectedTraining.participantIds.includes(CURRENT_USER_ID)
                  ? 'Отменить запись ❌'
                  : trainingGenderError(selectedTraining, currentUser) || 'Записаться на тренировку 🏃‍♂️'}
              </button>
            </div>
            )
          )
        }
      >
        {selectedTraining && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-300">Кто может записаться: {trainingGenderLabel(selectedTraining.participantGender)}</p>
            <div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {selectedTraining.sport} • {selectedTraining.level.toUpperCase()}
              </span>
              <h3 className="text-lg font-black text-white mt-2 leading-snug">{selectedTraining.title}</h3>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-slate-200">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Время: <b>{selectedTraining.dateLabel}</b> ({selectedTraining.time})</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Место: <b>{selectedTraining.locationName}</b> ({selectedTraining.address}){districtLabel(selectedTraining.districtId) && <span className="block mt-1 text-emerald-300">{districtLabel(selectedTraining.districtId)}</span>}</span>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-slate-400 mb-1">Организатор и описание</h5>
              <p className="text-slate-200 leading-relaxed bg-slate-950 p-3 rounded-2xl border border-slate-800">
                "{selectedTraining.description}"
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-bold text-slate-400">Участники группы ({selectedTraining.participantIds.length} / {selectedTraining.participantsMax})</h5>
              </div>
              <div className="space-y-1.5">
                {selectedTraining.participantIds.map(uid => {
                  const u = allUsers.find(user => user.id === uid);
                  const arrived = (selectedTraining.checkedInUserIds || []).includes(uid);
                  const isSelf = uid === CURRENT_USER_ID;
                  const isCreator = uid === selectedTraining.createdBy;
                  const iAmCreator = selectedTraining.createdBy === CURRENT_USER_ID;
                  const iAttended = (selectedTraining.checkedInUserIds || []).includes(CURRENT_USER_ID);
                  // Creator and attendees can add each other as friends.
                  const canBeFriend =
                    !isSelf && (isCreator || arrived) && (iAmCreator || iAttended);
                  const status = getFriendStatus(currentUser!, uid);
                  return (
                    <div key={uid} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${
                      arrived ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-950 border-slate-800'
                    }`}>
                      <AvatarImage src={avatarUrl(u?.avatar, 28) || AVATAR_FALLBACK} alt="" width={28} height={28} loading="lazy" decoding="async" className="w-7 h-7 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white truncate text-xs flex items-center gap-1">
                          {u?.name || (isSelf ? 'Вы' : 'Участник')}
                          {isCreator && <span className="text-[9px] text-amber-400 font-black">организатор</span>}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {arrived ? '📍 был(а) на тренировке' : 'записан(а)'}
                        </p>
                      </div>
                      {canBeFriend && status === 'none' && (
                        <button
                          onClick={() => void handleFriendAction({id: uid})}
                          className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1.5 text-[10px] font-black text-slate-950 active:scale-95 transition"
                        >
                          <UserPlus className="w-3 h-3" /> В друзья
                        </button>
                      )}
                      {canBeFriend && status === 'sent' && (
                        <span className="text-[10px] font-bold text-slate-500">Заявка отправлена</span>
                      )}
                      {canBeFriend && status === 'received' && (
                        <button
                          onClick={() => void handleFriendAction({id: uid})}
                          className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1.5 text-[10px] font-black text-slate-950 active:scale-95 transition"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Принять
                        </button>
                      )}
                      {canBeFriend && status === 'friends' && (
                        <span className="text-[10px] font-bold text-emerald-400">✓ Друзья</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GPS arrival check-in */}
            {currentUser && (
              <CheckInPanel
                training={selectedTraining}
                currentUser={currentUser}
                allUsers={allUsers}
                isOrganizer={selectedTraining.createdBy === CURRENT_USER_ID}
                onCheckedIn={handleCheckedIn}
                onMessageParticipant={handleMessageParticipant}
              />
            )}

            {/* Minimap preview */}
            <div className="pt-2">
              <Suspense fallback={<MapFallback height="200px" />}>
                <LeafletMap
                  center={{ lat: selectedTraining.lat, lng: selectedTraining.lng }}
                  zoom={14}
                  trainings={[selectedTraining]}
                  height="200px"
                />
              </Suspense>
            </div>
          </div>
        )}
      </Modal>

      {editingFeedPhoto && <PhotoEditor file={editingFeedPhoto} onClose={()=>setEditingFeedPhoto(null)} onSave={file=>{setEditingFeedPhoto(null);openCaptionDialog(file);}}/>}

      {/* MODAL 6: CREATE POST */}
      <Modal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        title="Новая публикация"
        subtitle="Поделитесь достижением с сообществом"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Спортивная дисциплина</label>
            <select
              value={postSportTag}
              onChange={e => setPostSportTag(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-emerald-500 font-semibold"
            >
              {SPORT_TAGS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Текст публикации</label>
            <textarea
              rows={4}
              placeholder="Сколько километров преодолели сегодня, какой темп и впечатления..."
              value={postContent}
              onChange={e => setPostContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">URL фото или видео к посту (опционально)</label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/photo-..."
              value={postMediaUrl}
              onChange={e => setPostMediaUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => setIsCreatePostOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl transition"
            >
              Отмена
            </button>
            <button
              onClick={handleCreatePost}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-95"
            >
              Опубликовать в ленту
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 7: NOTIFICATIONS (PUSH NOTIFICATIONS DEMO FOR PROMPT 3) */}
      <Modal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        title="Уведомления и мэтчи 🔔"
        subtitle="Ваши сообщения, друзья и спорт рядом"
      >
        <div className="space-y-3">
          {currentUser && <NotificationSettings key={currentUser.id}/>}
          {notificationsOffline && <p role="status" className="text-xs text-amber-300">Связь с уведомлениями потеряна. Пробуем восстановить…</p>}
          {!notifications.length && <p className="text-xs text-slate-400 py-3">Пока тихо. Новые сообщения, заявки и приглашения появятся здесь.</p>}

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Входящие ({notifications.length}):</span>
            {unreadNotifCount > 0 && (
              <button
                onClick={() => {
                  triggerHapticImpact('light');
                  setLocalNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  void readNotifications(serverNotifications.filter(n=>!n.read).map(n=>n.id)).catch(()=>notify('Не удалось отметить уведомления','err'));
                }}
                className="text-emerald-400 font-bold hover:underline"
              >
                Отметить все как прочитанные
              </button>
            )}
          </div>

          <div className="space-y-2">
            {notifications.map(n => (
              <div
                key={n.id}
                onClick={() => {
                  triggerHapticImpact('light');
                  setLocalNotifications(prev => prev.map(i => i.id === n.id ? { ...i, read: true } : i));
                  void readNotifications([n.id]).catch(()=>notify('Не удалось отметить уведомление','err'));
                  if(n.link){setIsNotifModalOpen(false);setPendingNotificationLink(n.link);}

                }}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                  n.read ? 'bg-slate-950 border-slate-800/80 text-slate-300' : 'bg-slate-900 border-emerald-500/50 text-white shadow'
                }`}
              >
                <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-slate-700' : 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h5 className="font-extrabold text-xs text-white truncate">{n.title}</h5>
                    <span className="text-[10px] text-slate-500 shrink-0">{n.time}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{n.message}</p>
                  {n.link && <span className="text-[10px] text-emerald-400 font-semibold underline block mt-1">Открыть &rarr;</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-center">
            <p className="text-[10px] text-slate-500">
              Серверная история: до 100 уведомлений за 30 дней. Push зависят от разрешений и доступности сети.
            </p>
          </div>
        </div>
      </Modal>

      {/* Подпись к медиа перед публикацией — заменяет window.prompt */}
      <Modal
        isOpen={!!pendingMedia}
        onClose={() => { if (uploadProgress === null) { setPendingMedia(null); setPendingCaption(''); } }}
        title={pendingMedia?.isVideo ? 'Публикация видео' : 'Публикация фото'}
        subtitle="Добавьте подпись — её увидит сообщество"
        footer={
          <div className="flex w-full gap-2">
            <button
              onClick={() => { setPendingMedia(null); setPendingCaption(''); }}
              disabled={uploadProgress !== null}
              className="px-4 py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl text-xs transition disabled:opacity-40"
            >
              Отмена
            </button>
            <button
              onClick={publishPendingMedia}
              disabled={uploadProgress !== null}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs transition shadow-[0_0_20px_rgba(16,185,129,0.45)] active:scale-95 disabled:opacity-60"
            >
              {uploadProgress !== null ? `Загрузка ${uploadProgress}%` : 'Опубликовать'}
            </button>
          </div>
        }
      >
        {pendingMedia && (
          <div className="space-y-3">
            {pendingPreview && (
              pendingMedia.isVideo ? (
                <video
                  src={pendingPreview}
                  controls playsInline preload="metadata"
                  className="w-full max-h-56 rounded-2xl border border-slate-800 bg-black"
                />
              ) : (
                <img
                  src={pendingPreview}
                  alt="Предпросмотр публикации"
                  className="w-full max-h-56 object-cover rounded-2xl border border-slate-800"
                />
              )
            )}
            <p className="text-[10px] text-slate-500 font-mono">
              {(pendingMedia.file.size / 1048576).toFixed(1)} МБ • {pendingMedia.file.type || 'unknown'}
            </p>
            <textarea
              rows={3}
              value={pendingCaption}
              onChange={(e) => setPendingCaption(e.target.value)}
              maxLength={500}
              placeholder="Подпись к публикации..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {uploadProgress !== null && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                  role="progressbar"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Неблокирующие уведомления вместо alert() */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            role="status"
            aria-live="polite"
            className={`fixed bottom-28 left-1/2 z-[60] -translate-x-1/2 max-w-[88vw] rounded-2xl px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur ${
              toast.kind === 'ok'
                ? 'bg-emerald-500/95 text-slate-950'
                : 'bg-rose-500/95 text-white'
            }`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Глобальный индикатор загрузки медиа (аватар вне модалки) */}
      <AnimatePresence>
        {uploadProgress !== null && !pendingMedia && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-emerald-500/50 bg-slate-900/95 px-4 py-2.5 shadow-2xl backdrop-blur"
          >
            <p className="text-[11px] font-bold text-emerald-300">
              Загрузка фото… {uploadProgress}%
            </p>
            <div className="mt-1.5 h-1 w-40 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 8: REWARD CELEBRATION & SPORTBUDDY BOX DETAILS */}
      <Modal
        isOpen={!!rewardModal}
        onClose={() => setRewardModal(null)}
        title={rewardModal?.title || 'Награда SportBuddy'}
        subtitle={rewardModal?.subtitle}
        footer={
          <button
            onClick={() => {
              triggerHapticImpact('light');
              setRewardModal(null);
            }}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-2xl text-sm transition shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-95"
          >
            Отлично, спасибо! 🥳
          </button>
        }
      >
        {rewardModal?.content}
      </Modal>
    </div>
  );
}
