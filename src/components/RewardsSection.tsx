import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Award, Flame, Crown, CheckCircle2, ShieldCheck,
  MapPin, Clock, Trophy, Tag
} from 'lucide-react';
import { UserProfile } from '../lib/types';
import { 
  SPORTBUDDY_BOX_TIERS, claimDailyMedal, openSportBuddyBox, 
  verifyAndProcessStreak, getTodayDateString 
} from '../services/rewards';
import { CollapsibleCard } from './CollapsibleCard';
import { triggerHapticImpact, launchMatchConfetti } from '../services/native';

interface RewardsSectionProps {
  user: UserProfile;
  onUpdateUser: (newUser: UserProfile) => void;
  onOpenModal: (title: string, subtitle: string, content: React.ReactNode) => void;
}

const RewardsSectionInner: React.FC<RewardsSectionProps> = ({
  user,
  onUpdateUser,
  onOpenModal
}) => {
  const [claimingMedal, setClaimingMedal] = useState(false);
  const [openingBoxIdx, setOpeningBoxIdx] = useState<number | null>(null);

  const todayStr = getTodayDateString();
  const isMedalClaimedToday = user.lastClaimedDate === todayStr;
  const claimedTiers = user.claimedBoxTiers || [];
  const inventory = user.rewardItems || [];

  // Handle claiming today's medal
  const handleClaimMedal = async () => {
    if (claimingMedal || isMedalClaimedToday) return;
    setClaimingMedal(true);
    try {
      const result = await claimDailyMedal(user);
      onUpdateUser(result.updatedUser);
      if (result.unlockedPremium) {
        launchMatchConfetti();
      }
      onOpenModal(
        result.unlockedPremium ? '👑 ДОСТИЖЕНИЕ РАЗБЛОКИРОВАНО!' : '🥇 ЗОЛОТАЯ МЕДАЛЬ ПОЛУЧЕНА!',
        'Ежедневная награда SportBuddy',
        <div className="text-center space-y-4 py-2">
          <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-yellow-300 rounded-full flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(245,158,11,0.6)] mx-auto border-4 border-white animate-bounce">
            {result.unlockedPremium ? '👑' : '🥇'}
          </div>
          <p className="text-sm font-extrabold text-white leading-relaxed">{result.message}</p>

          {result.promo && (
            <div className="bg-gradient-to-b from-emerald-950/50 to-slate-950 p-4 rounded-2xl border-2 border-emerald-500/60 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                🎟 Ваш подарочный промокод (+{result.promo.days} дней Premium)
              </p>
              <p className="text-lg font-mono font-black tracking-widest text-white">{result.promo.code}</p>
              <p className="text-[10px] text-slate-400">Активируйте его в разделе «Промокод» в профиле</p>
            </div>
          )}

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs text-slate-300 text-left space-y-1">
            <p className="font-semibold text-amber-400">Правила ежедневных наград:</p>
            <p>• 1 вход каждый день = +1 Золотая медаль в копилку.</p>
            <p>• Каждые 7 медалей подряд дают <b>промокод на 7 дней Premium</b>.</p>
            <p className="text-rose-400 font-semibold">⚠️ Внимание: если не заходить в приложение 24 часа, ваша серия медалей сгорает до нуля!</p>
          </div>
        </div>
      );
    } finally {
      setClaimingMedal(false);
    }
  };

  // Handle opening a SportBuddy BOX (7, 14, 28 workouts)
  const handleOpenBox = async (tierIdx: number) => {
    if (openingBoxIdx !== null) return;
    setOpeningBoxIdx(tierIdx);
    try {
      const result = await openSportBuddyBox(user, tierIdx);
      if (result.error) {
        onOpenModal(
          'Уведомление SportBuddy BOX',
          'Статус разблокировки',
          <div className="space-y-3 text-center py-2">
            <div className="w-16 h-16 rounded-3xl bg-slate-800 border border-slate-700 text-amber-400 flex items-center justify-center text-3xl mx-auto">
              🔒
            </div>
            <p className="text-sm text-slate-200 font-semibold">{result.error}</p>
            <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
              💡 Тренируйтесь регулярно, приглашайте напарников и открывайте Секретные Боксы со спортивным инвентарем и билетами на топовые спортивные события Санкт-Петербурга!
            </p>
          </div>
        );
        return;
      }

      onUpdateUser(result.updatedUser);
      launchMatchConfetti();
      const won = result.wonItem;

      onOpenModal(
        '🎉 ПРИЗ SPORTBUDDY BOX РАЗБЛОКИРОВАН!',
        `Награда за ${SPORTBUDDY_BOX_TIERS[tierIdx]?.requiredWorkouts} тренировок в Санкт-Петербурге`,
        <div className="space-y-4 py-2">
          <div className="bg-gradient-to-b from-amber-500/20 via-slate-950 to-slate-950 p-4 rounded-3xl border border-amber-500/50 text-center shadow-xl relative overflow-hidden">
            <span className="text-5xl inline-block mb-2 animate-bounce">{won.icon}</span>
            <span className="inline-block text-[10px] font-black uppercase px-2.5 py-0.5 rounded bg-emerald-500 text-slate-950 mb-1.5 shadow">
              {won.category === 'ticket' ? '🎟 Билет на мероприятие СПб' : won.category === 'gear' ? '🏋️‍♂️ Спортивный инвентарь' : '🎁 Бонус СПб'}
            </span>
            <h3 className="text-base font-black text-white leading-tight">{won.title}</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800">
              {won.description}
            </p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/80 text-xs">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <MapPin className="w-3.5 h-3.5" /> {won.location}
              </span>
              <span className="bg-slate-900 px-2.5 py-1 rounded-xl text-amber-400 font-mono font-black border border-slate-700">
                Код: {won.code}
              </span>
            </div>
          </div>
          {result.promo && (
            <div className="bg-gradient-to-b from-emerald-950/50 to-slate-950 p-4 rounded-2xl border-2 border-emerald-500/60 text-center space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                🎟 Бонус бокса: промокод на +{result.promo.days} дней Premium
              </p>
              <p className="text-lg font-mono font-black tracking-widest text-white">{result.promo.code}</p>
              <p className="text-[10px] text-slate-400">Активируйте его в разделе «Промокод» в профиле</p>
            </div>
          )}

          <p className="text-xs text-slate-400 text-center">
            ✅ Приз добавлен в ваш раздел «Мой спортивный инвентарь и билеты СПб» ниже!
          </p>
        </div>
      );
    } finally {
      setOpeningBoxIdx(null);
    }
  };

  // Demo helper: verify 24 hour burn status
  const handleCheckBurnStatus = async () => {
    triggerHapticImpact('light');
    const checked = await verifyAndProcessStreak(user);
    if (checked.streakBurned) {
      onUpdateUser(checked.updatedUser);
      onOpenModal(
        'Серия медалей завершена',
        'Активность за 24 часа',
        <p className="py-2 text-center text-sm leading-relaxed text-slate-300">
          💔 Серия медалей сгорела, так как прошло более 24 часов без входа.
          Вернитесь завтра, чтобы начать новую честную серию.
        </p>
      );
    } else {
      alert(`✅ Ваша серия активна! Если не зайдете в течение ${checked.hoursUntilExpiration} ч, серия медалей сгорит.`);
    }
  };

  // Calculate overall milestone target for motivational bar
  const currentWorkouts = user.totalWorkouts || 0;
  const nextTier = SPORTBUDDY_BOX_TIERS.find(t => currentWorkouts < t.requiredWorkouts) || SPORTBUDDY_BOX_TIERS[SPORTBUDDY_BOX_TIERS.length - 1];
  const targetWorkouts = nextTier?.requiredWorkouts || 28;
  const progressPerc = Math.min(100, Math.round((currentWorkouts / targetWorkouts) * 100));

  return (
    <div className="space-y-6">
      {/* 1. SECTION: THREE-TIER MEDALS — rendered by MedalsSection in App */}
      <div className="hidden">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-1">
              Награда для каждого пользователя
            </span>
            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-1.5">
              🥇 Ежедневная Медаль SportBuddy
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              За 7 медалей подряд — подарок: <b>7 дней Premium-подписки бесплатно</b>!
            </p>
          </div>

          <div className="bg-slate-950/90 border border-amber-500/50 p-2.5 rounded-2xl text-center min-w-[75px] shrink-0">
            <span className="text-xs text-slate-400 block font-medium">Серия</span>
            <span className="text-lg font-black text-amber-400 flex items-center justify-center gap-0.5">
              <Flame className="w-4 h-4 fill-amber-400" /> {user.dailyMedalStreak} дн.
            </span>
          </div>
        </div>

        {/* Visual 7-day checkmarks timeline */}
        <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/90 space-y-2">
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-300">
            <span>Прогресс до бесплатного Premium:</span>
            <span className="text-amber-400">{user.dailyMedalStreak % 7} / 7 дней</span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const stepInStreak = (user.dailyMedalStreak % 7) || (user.dailyMedalStreak > 0 ? 7 : 0);
              const isPassed = day <= stepInStreak && user.dailyMedalStreak > 0;
              const isDaySeven = day === 7;

              return (
                <div
                  key={day}
                  className={`h-11 rounded-xl flex flex-col items-center justify-center transition-all border ${
                    isPassed
                      ? 'bg-gradient-to-t from-amber-500 to-yellow-400 text-slate-950 font-extrabold border-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                      : isDaySeven
                      ? 'bg-slate-900 border-dashed border-amber-500/50 text-amber-400'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  <span className="text-sm leading-none mb-0.5">{isDaySeven ? '👑' : isPassed ? '✓' : '🥇'}</span>
                  <span className="text-[9px] font-mono font-bold">{day}д</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800 text-slate-400">
            <span className="flex items-center gap-1 text-rose-400 font-medium">
              <Clock className="w-3.5 h-3.5 shrink-0" /> При обрыве более 24ч серия сгорит!
            </span>
            <button
              onClick={handleCheckBurnStatus}
              className="text-[10px] text-slate-400 underline hover:text-white"
            >
              Проверить таймер
            </button>
          </div>
        </div>

        {/* Claim Today's Medal Button */}
        <button
          onClick={handleClaimMedal}
          disabled={isMedalClaimedToday || claimingMedal}
          className={`w-full py-3.5 rounded-2xl text-xs font-black transition-all shadow-xl flex items-center justify-center gap-2 ${
            isMedalClaimedToday
              ? 'bg-slate-800 border border-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.5)] active:scale-95'
          }`}
        >
          <Award className={`w-5 h-5 ${isMedalClaimedToday ? '' : 'fill-slate-950 animate-bounce'}`} />
          {isMedalClaimedToday ? '✅ Медаль за сегодня получена (Вернитесь завтра!)' : '🎖 ПОЛУЧИТЬ МЕДАЛЬ SPORTBUDDY СЕГОДНЯ (+1 к серии)'}
        </button>

      </div>

      {/* 2. SECTION: PREMIUM WORKOUT REWARDS (SPORTBUDDY BOX) */}
      <CollapsibleCard
        storageKey="sportbuddy_profile_boxes_open_v1"
        className="bg-slate-900 border border-slate-800"
        defaultOpen={false}
        icon={
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-[0_0_16px_rgba(16,185,129,0.35)]">
            <Trophy className="w-5 h-5 text-slate-950" />
          </div>
        }
        title="SportBuddy BOX"
        subtitle="Призы за тренировки — 7 / 14 / 28"
        collapsedSummary={`${currentWorkouts} тренировок • открыто ${(user.claimedBoxTiers || []).length} из 3`}
        badge={
          <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-500/40">
            {(user.claimedBoxTiers || []).length}/3
          </span>
        }
      >
      <div className="space-y-5 relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Эксклюзив для Premium
              </span>
              {user.subscriptionPlan === 'premium' ? (
                <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <Crown className="w-3 h-3 fill-slate-950" /> PRO активен
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                  🔒 Требуется Premium
                </span>
              )}
            </div>
            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-1.5 mt-1.5">
              🎁 Призовые SportBuddy BOX
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-snug">
              Тренируйтесь с напарниками и получайте <b>Секретные Боксы со спортивным инвентарем и билетами</b> на топовые матчи и марафоны в <b>Санкт-Петербурге</b>!
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)] shrink-0">
            📦
          </div>
        </div>

        {/* Motivational Roadmap Progress Scale (Шкала мотивации до призов) */}
        <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800/90 space-y-4">
          <div>
            <div className="flex justify-between items-center text-xs font-black mb-2">
              <span className="text-slate-200 flex items-center gap-1">
                <Trophy className="w-4 h-4 text-amber-400" /> Шкала мотивации: <b>{currentWorkouts} тренировок</b>
              </span>
              <span className="text-emerald-400 font-bold">{progressPerc}% до {nextTier ? nextTier.boxName : 'Элиты'}</span>
            </div>
            
            {/* Visual Milestone Bar */}
            <div className="relative w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700/80">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPerc}%` }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.7)]"
              />
            </div>
          </div>

          {/* 3 Milestone Tier Cards (7, 14, 28) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SPORTBUDDY_BOX_TIERS.map((tier, idx) => {
              const isUnlocked = currentWorkouts >= tier.requiredWorkouts;
              const isAlreadyClaimed = claimedTiers.includes(tier.requiredWorkouts);
              const isOpening = openingBoxIdx === idx;
              const workoutsNeeded = Math.max(0, tier.requiredWorkouts - currentWorkouts);

              return (
                <div
                  key={tier.requiredWorkouts}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                    isAlreadyClaimed
                      ? 'bg-slate-900/40 border-slate-800/80 text-slate-400'
                      : isUnlocked
                      ? 'bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                      : 'bg-slate-900/80 border-slate-800/80 text-slate-300'
                  }`}
                >
                  {isAlreadyClaimed && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-md">
                      ПОЛУЧЕНО ✓
                    </div>
                  )}
                  {isUnlocked && !isAlreadyClaimed && (
                    <div className="absolute top-2 right-2 bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-md animate-pulse">
                      ДОСТУПНО!
                    </div>
                  )}

                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-1 text-xs font-black text-white">
                      <span>{tier.badge}</span>
                    </div>
                    <h4 className="text-sm font-extrabold text-emerald-400">{tier.boxName}</h4>
                    
                    {/* Preview of St. Petersburg prizes inside */}
                    <div className="text-[11px] text-slate-300 space-y-1 bg-slate-950/80 p-2 rounded-xl border border-slate-800/60">
                      <p className="font-semibold text-slate-400 text-[10px]">🎁 Внутри случайная награда СПб:</p>
                      {tier.possibleRewards.map((r, rIdx) => (
                        <p key={rIdx} className="truncate text-[11px] flex items-center gap-1 text-slate-200">
                          <span>{r.icon}</span> <span>{r.title}</span>
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Button to open or status */}
                  <button
                    onClick={() => handleOpenBox(idx)}
                    disabled={isAlreadyClaimed || !isUnlocked || isOpening}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition shadow flex items-center justify-center gap-1.5 ${
                      isAlreadyClaimed
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-default'
                        : isUnlocked
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 hover:from-emerald-400 hover:to-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)] active:scale-95'
                        : 'bg-slate-800/90 text-slate-400 border border-slate-700/80 cursor-not-allowed'
                    }`}
                  >
                    {isAlreadyClaimed ? (
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Открыто</span>
                    ) : isUnlocked ? (
                      <span className="flex items-center gap-1">🎁 ОТКРЫТЬ БОКС</span>
                    ) : (
                      <span>Осталось {workoutsNeeded} трен.</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Anti-fraud rule explanation */}
          <div className="flex items-start gap-2 pt-2 border-t border-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              В прогресс боксов засчитывается <b className="text-emerald-400">одна тренировка в сутки</b>.
              Отметка о прибытии по GPS подтверждает участие автоматически — фиктивные
              занятия не влияют на награды.
            </p>
          </div>
        </div>
      </div>
      </CollapsibleCard>

      {/* 3. SECTION: MY INVENTORY OF ST. PETERSBURG REWARDS (МОЙ ИНВЕНТАРЬ И БИЛЕТЫ СПБ) */}
      <CollapsibleCard
        storageKey="sportbuddy_profile_inventory_open_v1"
        className="bg-slate-900 border border-slate-800"
        defaultOpen={false}
        icon={<span className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center text-2xl">🎒</span>}
        title="Мой инвентарь и билеты СПб"
        subtitle={`Выигранные подарки из SportBuddy BOX (${inventory.length} шт.)`}
        collapsedSummary={inventory.length > 0 ? `${inventory.length} призов получено` : 'Призов пока нет'}
        badge={
          <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-2 py-1 rounded-lg border border-amber-500/40">
            {inventory.length}
          </span>
        }
      >
        {inventory.length === 0 ? (
          <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800/80 text-center text-slate-500 space-y-2">
            <Tag className="w-8 h-8 mx-auto opacity-50 text-slate-600" />
            <p className="text-xs font-medium">У вас пока нет разблокированных призов в Санкт-Петербурге.</p>
            <p className="text-[11px]">Участвуйте в тренировках, откройте SportBuddy BOX 1 за 7 тренировок и заберите первый приз!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1 no-scrollbar">
            {inventory.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onOpenModal(
                    `Билет / Ваучер: ${item.title}`,
                    `Действует в Санкт-Петербурге`,
                    <div className="text-center space-y-3 py-2">
                      <div className="text-5xl">{item.icon}</div>
                      <h4 className="text-base font-black text-white">{item.title}</h4>
                      <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                        {item.description}
                      </p>
                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl text-xs">
                        <p className="text-emerald-400 font-bold mb-1">📍 Место проведения / получения:</p>
                        <p className="text-white font-semibold">{item.location}</p>
                        <div className="mt-3 bg-slate-950 py-2 px-4 rounded-xl inline-block border border-emerald-500">
                          <span className="text-xs text-slate-400 block font-mono">ШТРИХ-КОД ПОЛУЧЕНИЯ</span>
                          <span className="text-lg font-mono font-black text-amber-400 tracking-wider">{item.code}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
                className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer flex items-center gap-3 shadow group"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700 shrink-0">
                      {item.category === 'ticket' ? '🎟 Билет СПб' : item.category === 'gear' ? '🏋️‍♂️ Инвентарь' : '🏷 Купон'}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate">Получено: {item.dateEarned}</span>
                  </div>
                  <h4 className="font-extrabold text-xs text-white truncate mt-1 group-hover:text-emerald-400 transition">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 text-emerald-400 shrink-0" /> {item.location}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-black text-amber-400 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 block">
                    {item.code}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold underline block mt-1">Открыть →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleCard>
    </div>
  );
};

/** Memoised: re-renders only when workout/box/reward data actually changes */
export const RewardsSection = React.memo(
  RewardsSectionInner,
  (prev, next) =>
    prev.user.id === next.user.id &&
    prev.user.totalWorkouts === next.user.totalWorkouts &&
    JSON.stringify(prev.user.claimedBoxTiers) === JSON.stringify(next.user.claimedBoxTiers) &&
    (prev.user.rewardItems?.length || 0) === (next.user.rewardItems?.length || 0) &&
    prev.onUpdateUser === next.onUpdateUser &&
    prev.onOpenModal === next.onOpenModal
);
