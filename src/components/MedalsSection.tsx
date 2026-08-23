import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Clock, Info, Gift, TrendingUp } from 'lucide-react';
import { UserProfile } from '../lib/types';
import { MEDAL_TIERS, TIER_ORDER } from '../lib/medals';
import {
  getProgress, claimDailyMedal, canClaimToday, totalMedals, ClaimResult
} from '../services/medals';

interface MedalsSectionProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onOpenModal: (title: string, subtitle: string, content: React.ReactNode) => void;
}

const MedalsSectionInner: React.FC<MedalsSectionProps> = ({
  user, onUpdateUser, onOpenModal
}) => {
  const [version, setVersion] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const progress = getProgress(user.id);
  const cfg = MEDAL_TIERS[progress.tier];
  const claimable = canClaimToday(user.id);
  const total = totalMedals(progress);

  const workoutsPct = cfg.workoutsRequired > 0
    ? Math.min(100, (progress.cycleWorkouts / cfg.workoutsRequired) * 100)
    : 100;

  const handleClaim = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result: ClaimResult = await claimDailyMedal(user);
      if (!result.ok) {
        setNotice(result.message);
        setTimeout(() => setNotice(null), 3500);
        return;
      }

      onUpdateUser({
        ...user,
        totalDailyMedals: totalMedals(result.progress),
        dailyMedalStreak: result.progress.cycleDays,
        medalTier: result.progress.tier
      });
      setVersion(v => v + 1);

      const earned = result.tierEarned ? MEDAL_TIERS[result.tierEarned] : cfg;
      onOpenModal(
        result.cycleCompleted ? '🎉 Цикл завершён!' : `${earned.emoji} Медаль получена`,
        result.cycleCompleted ? 'Награда разблокирована' : 'Ежедневная награда SportBuddy',
        <div className="text-center space-y-4 py-2">
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${earned.gradient} flex items-center justify-center text-4xl mx-auto border-4 border-white/20 shadow-2xl animate-bounce`}>
            {result.newTier ? MEDAL_TIERS[result.newTier].emoji : earned.emoji}
          </div>
          <p className="text-sm font-extrabold text-white leading-relaxed">{result.message}</p>

          {result.promo && (
            <div className="bg-gradient-to-b from-emerald-950/50 to-slate-950 p-4 rounded-2xl border-2 border-emerald-500/60 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                🎟 Промокод на {result.promo.days} дней Premium
              </p>
              <p className="text-lg font-mono font-black tracking-widest text-white">
                {result.promo.code}
              </p>
              <p className="text-[10px] text-slate-400">
                Активируйте в разделе «Промокод» в профиле
              </p>
            </div>
          )}

          {result.promoted && result.newTier && (
            <p className="text-xs font-black text-amber-300 bg-amber-500/15 border border-amber-500/50 p-3 rounded-2xl">
              ⬆️ Новый уровень: {MEDAL_TIERS[result.newTier].name} {MEDAL_TIERS[result.newTier].emoji}
              <span className="block text-[10px] font-semibold text-slate-300 mt-1">
                {MEDAL_TIERS[result.newTier].description}
              </span>
            </p>
          )}
        </div>
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div key={version} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-2xl shrink-0 shadow-lg`}>
            {cfg.emoji}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-white">
              Уровень: {cfg.name}
            </h3>
            <p className="text-[11px] text-slate-400">{cfg.description}</p>
          </div>
        </div>
        <button
          onClick={() => setShowRules(!showRules)}
          className="p-1.5 text-slate-500 hover:text-slate-300 transition shrink-0"
          aria-label="Правила медалей"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Tier ladder */}
      <div className="flex items-center gap-1.5">
        {TIER_ORDER.map((t, i) => {
          const tc = MEDAL_TIERS[t];
          const active = progress.tier === t;
          const passed = TIER_ORDER.indexOf(progress.tier) > i;
          return (
            <React.Fragment key={t}>
              <div
                className={`flex-1 rounded-2xl p-2 text-center border-2 transition ${
                  active
                    ? `bg-gradient-to-b ${tc.gradient} ${tc.border} shadow-lg`
                    : passed
                    ? 'bg-slate-950 border-slate-700 opacity-70'
                    : 'bg-slate-950 border-slate-800 opacity-45'
                }`}
              >
                <span className="text-lg block leading-none">{tc.emoji}</span>
                <span className={`text-[9px] font-black block mt-1 ${active ? 'text-slate-950' : 'text-slate-400'}`}>
                  {tc.name}
                </span>
                <span className={`text-[8px] block ${active ? 'text-slate-900/80' : 'text-slate-600'}`}>
                  {progress.totals[t]} шт.
                </span>
              </div>
              {i < TIER_ORDER.length - 1 && (
                <span className="text-slate-600 text-xs shrink-0">›</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <AnimatePresence>
        {showRules && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-1.5 text-[10px] text-slate-300 leading-relaxed">
              <p>🥉 <b>Бронза</b> — 7 дней подряд → промокод на <b>5 дней Premium</b>. После первой тренировки открывается Серебро.</p>
              <p>🥈 <b>Серебро</b> — 7 дней подряд + 3 тренировки → <b>7 дней Premium</b> и переход на Золото.</p>
              <p>🥇 <b>Золото</b> — 7 дней подряд + 5 тренировок → <b>30 дней Premium</b>.</p>
              <p className="text-rose-400 font-semibold">
                ⚠️ Пропуск 24 часов сжигает цикл и понижает уровень: Золото → Серебро → Бронза.
              </p>
              <p className="text-emerald-400 font-semibold">
                💚 Правила одинаковы для всех — и для бесплатных, и для Premium аккаунтов.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cycle progress */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
        {/* Days */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-slate-300 flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" /> Дни подряд
            </span>
            <span style={{ color: cfg.accent }}>{progress.cycleDays} / {cfg.daysRequired}</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: cfg.daysRequired }).map((_, i) => {
              const done = i < progress.cycleDays;
              return (
                <div
                  key={i}
                  className={`h-9 rounded-lg border flex items-center justify-center text-[10px] font-black transition ${
                    done
                      ? `bg-gradient-to-t ${cfg.gradient} border-white/20 text-slate-950`
                      : 'bg-slate-900 border-slate-800 text-slate-600'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* Workouts (silver / gold only) */}
        {cfg.workoutsRequired > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-slate-300 flex items-center gap-1">
                🏋️ Тренировки в цикле
              </span>
              <span style={{ color: cfg.accent }}>
                {progress.cycleWorkouts} / {cfg.workoutsRequired}
              </span>
            </div>
            <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${workoutsPct}%` }}
                className="h-full rounded-full"
                style={{ background: cfg.accent }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800">
          <span className="text-slate-500">
            Всего медалей: <b className="text-slate-300">{total}</b>
          </span>
          <span className="text-rose-400 font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3" /> Пропуск 24 ч — сгорание
          </span>
        </div>
      </div>

      {/* Reward hint */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-start gap-2.5">
        <Gift className="w-4 h-4 shrink-0 mt-0.5" style={{ color: cfg.accent }} />
        <p className="text-[10px] text-slate-300 leading-relaxed">
          Награда за цикл: <b style={{ color: cfg.accent }}>{cfg.rewardDays} дней Premium</b> промокодом.
          {' '}<span className="text-slate-500">{cfg.nextHint}</span>
        </p>
      </div>

      {notice && (
        <p className="text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/50 p-2.5 rounded-xl text-center">
          {notice}
        </p>
      )}

      {/* Claim */}
      <button
        onClick={handleClaim}
        disabled={!claimable || busy}
        className={`w-full py-3.5 rounded-2xl text-xs font-black transition active:scale-95 flex items-center justify-center gap-2 ${
          claimable
            ? `bg-gradient-to-r ${cfg.gradient} text-slate-950 shadow-xl`
            : 'bg-slate-800 border border-slate-700 text-slate-400 cursor-not-allowed'
        }`}
      >
        {claimable
          ? <>{cfg.emoji} Получить медаль «{cfg.name}» за сегодня</>
          : <>✅ Медаль получена — возвращайтесь завтра</>}
      </button>

      <p className="border-t border-slate-800/80 pt-2 text-[10px] text-slate-600 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" /> Тренировки засчитываются только после завершённого занятия и GPS-подтверждения.
      </p>
    </div>
  );
};

/** Memoised: only re-renders when the user's medal aggregates or identity change */
export const MedalsSection = React.memo(
  MedalsSectionInner,
  (prev, next) =>
    prev.user.id === next.user.id &&
    prev.user.totalDailyMedals === next.user.totalDailyMedals &&
    prev.user.dailyMedalStreak === next.user.dailyMedalStreak &&
    prev.user.medalTier === next.user.medalTier &&
    prev.onUpdateUser === next.onUpdateUser &&
    prev.onOpenModal === next.onOpenModal
);
