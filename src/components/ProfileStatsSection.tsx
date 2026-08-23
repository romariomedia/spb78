import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Dumbbell, Award, Flame, Gift, CalendarPlus,
  TrendingUp, Star, Target, Trophy
} from 'lucide-react';
import { UserProfile, Training, SPORT_ICONS } from '../lib/types';
import { getProgress, totalMedals } from '../services/medals';
import { getCredits, getWorkoutStreak } from '../services/workoutLog';
import { computeAverageRating } from '../services/ratings';
import { MEDAL_TIERS, TIER_ORDER } from '../lib/medals';
import { triggerHapticImpact } from '../services/native';

/* ------------------------------ count-up hook ------------------------------ */

function useCountUp(target: number, active: boolean, duration = 750): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return;

    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + delta * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);

  return active ? value : 0;
}

/* ------------------------------- svg widgets ------------------------------- */

const WeekBars: React.FC<{ credits: ReturnType<typeof getCredits> }> = ({ credits }) => {
  const days = useMemo(() => {
    const out: { label: string; count: number }[] = [];
    const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({
        label: labels[d.getDay()] ?? '',
        count: credits.filter((c) => c.dayKey === key).length
      });
    }
    return out;
  }, [credits]);

  const max = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="flex items-end justify-between gap-1.5 h-20">
      {days.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(6, (d.count / max) * 100)}%` }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 200, damping: 22 }}
            className={`w-full rounded-t-md ${
              d.count > 0
                ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                : 'bg-slate-800'
            }`}
          />
          <span className={`text-[8px] font-bold ${i === 6 ? 'text-emerald-400' : 'text-slate-600'}`}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
};

const ProgressRing: React.FC<{ percent: number; label: string; sub: string; color: string }> = ({
  percent, label, sub, color
}) => {
  const R = 30;
  const C = 2 * Math.PI * R;
  const [offset, setOffset] = useState(C);

  useEffect(() => {
    const t = setTimeout(() => setOffset(C - (C * Math.min(100, percent)) / 100), 60);
    return () => clearTimeout(t);
  }, [percent, C]);

  return (
    <div className="relative w-[76px] h-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
        <circle cx="38" cy="38" r={R} fill="none" stroke="#1e293b" strokeWidth="7" />
        <motion.circle
          cx="38" cy="38" r={R} fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[7px] text-slate-500 font-black uppercase tracking-wide">{label}</span>
        <span className="text-sm font-black text-white leading-none">{Math.round(percent)}%</span>
        <span className="text-[7px] text-slate-500 font-bold mt-0.5">{sub}</span>
      </div>
    </div>
  );
};

/* ------------------------------ stat tile ------------------------------ */

const StatTile: React.FC<{
  icon: React.ReactNode; label: string; value: number; suffix?: string;
  color: string; active: boolean; hint?: string;
}> = ({ icon, label, value, suffix, color, active, hint }) => {
  const n = useCountUp(value, active);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-1.5 relative overflow-hidden"
    >
      <div
        className="absolute -top-6 -right-6 w-16 h-16 rounded-full blur-2xl opacity-25 pointer-events-none"
        style={{ background: color }}
      />
      <div className="relative flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <p className="sb-score relative text-xl font-black text-white leading-none">
        {n}
        {suffix && <span className="text-[10px] text-slate-500 font-bold ml-1">{suffix}</span>}
      </p>
      {hint && <p className="relative text-[9px] text-slate-500 leading-tight">{hint}</p>}
    </motion.div>
  );
};

/* ------------------------------- main section ------------------------------ */

interface ProfileStatsSectionProps {
  user: UserProfile;
  trainings: Training[];
  /** Explicit account membership ledger; excludes any legacy participant ids. */
  joinedTrainingIds: ReadonlySet<string>;
}

const ProfileStatsInner: React.FC<ProfileStatsSectionProps> = ({ user, trainings, joinedTrainingIds }) => {
  const [expanded, setExpanded] = useState(false);

  const medals = useMemo(() => getProgress(user.id), [user.id, expanded]);
  const credits = useMemo(() => getCredits(user.id), [user.id, expanded]);
  const streak = useMemo(() => getWorkoutStreak(user.id), [user.id, expanded]);

  const attended = useMemo(
    () => trainings.filter((t) => joinedTrainingIds.has(t.id) && t.createdBy !== user.id).length,
    [trainings, joinedTrainingIds]
  );
  const created = useMemo(
    () => trainings.filter((t) => t.createdBy === user.id).length,
    [trainings, user.id]
  );

  const prizesCount = (user.rewardItems?.length || 0);
  const boxesOpened = (user.claimedBoxTiers?.length || 0);
  const rating = computeAverageRating(user);
  const level = Math.floor(user.totalWorkouts / 10) + 1;
  const levelPct = (user.totalWorkouts % 10) * 10;

  const cfg = MEDAL_TIERS[user.medalTier || 'bronze'];
  const tierCfg = MEDAL_TIERS[medals.tier];

  // Next box progress for the ring
  const boxTargets = [7, 14, 28];
  const nextBox = boxTargets.find((t) => user.totalWorkouts < t);
  const boxPct = nextBox
    ? (user.totalWorkouts / nextBox) * 100
    : 100;

  // Medal distribution for the segment bar
  const totalM = Math.max(1, totalMedals(medals));
  const segments = TIER_ORDER.map((t) => ({
    cfg: MEDAL_TIERS[t],
    share: (medals.totals[t] / totalM) * 100
  }));

  const medalTotal = useCountUp(totalMedals(medals), true);
  const streakN = useCountUp(medals.cycleDays, true);

  return (
    <div className="relative rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
      {/* Ambient glow tinted by current tier */}
      <div
        className="pointer-events-none absolute -top-20 -right-16 w-52 h-52 rounded-full blur-3xl opacity-20"
        style={{ background: tierCfg.accent }}
      />

      <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-4 space-y-3.5">
        {/* Compact row */}
        <div className="flex items-center gap-3">
          {/* Level ring */}
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#1e293b" strokeWidth="5" />
              <circle
                cx="32" cy="32" r="26" fill="none" stroke={cfg.accent}
                strokeWidth="5" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 26}
                strokeDashoffset={2 * Math.PI * 26 * (1 - levelPct / 100)}
                style={{ transition: 'stroke-dashoffset .8s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[8px] font-black text-slate-500 uppercase">ур.</span>
              <span className="text-lg font-black text-white leading-none">{level}</span>
            </div>
          </div>

          {/* Quick chips */}
          <div className="flex-1 grid grid-cols-3 gap-1.5">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-2 py-1.5 text-center">
              <span className="text-base leading-none block">{cfg.emoji}</span>
              <span className="text-sm font-black text-white leading-none mt-0.5 block">
                {medalTotal}
              </span>
              <span className="text-[8px] text-slate-500 font-bold">медалей</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-2 py-1.5 text-center">
              <Dumbbell className="w-4 h-4 text-emerald-400 mx-auto" />
              <span className="text-sm font-black text-white leading-none mt-0.5 block">
                {user.totalWorkouts}
              </span>
              <span className="text-[8px] text-slate-500 font-bold">трен.</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-2 py-1.5 text-center">
              <Flame className="w-4 h-4 text-rose-400 mx-auto" />
              <span className="text-sm font-black text-white leading-none mt-0.5 block">
                {streakN}
              </span>
              <span className="text-[8px] text-slate-500 font-bold">дней</span>
            </div>
          </div>
        </div>

        {/* Medal distribution bar */}
        <div className="space-y-1">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-950 border border-slate-800">
            {segments.map((s) => (
              <motion.div
                key={s.cfg.id}
                initial={{ width: 0 }}
                animate={{ width: `${s.share}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ background: s.cfg.accent }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[8px] font-bold">
            {TIER_ORDER.map((t) => (
              <span key={t} className="flex items-center gap-0.5" style={{ color: MEDAL_TIERS[t].accent }}>
                {MEDAL_TIERS[t].emoji} {medals.totals[t]}
              </span>
            ))}
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => {
            triggerHapticImpact('light');
            setExpanded((v) => !v);
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-black text-slate-300 hover:text-white transition active:scale-[0.98]"
        >
          {expanded ? 'Свернуть статистику' : 'Подробная статистика'}
          <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.span>
        </button>

        {/* Expanded details */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-1">
                {/* Tier banner */}
                <div
                  className={`rounded-2xl p-3 border-2 flex items-center gap-3 bg-gradient-to-r ${tierCfg.gradient} bg-opacity-10`}
                  style={{ borderColor: `${tierCfg.accent}88`, background: `${tierCfg.accent}14` }}
                >
                  <span className="text-2xl">{tierCfg.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white">
                      Текущий цикл: {tierCfg.name}
                    </p>
                    <p className="text-[10px] text-slate-300">
                      День {medals.cycleDays}/{tierCfg.daysRequired}
                      {tierCfg.workoutsRequired > 0 && ` • Тренировок ${medals.cycleWorkouts}/${tierCfg.workoutsRequired}`}
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 shrink-0" style={{ color: tierCfg.accent }} />
                </div>

                {/* Stat tiles */}
                <div className="grid grid-cols-2 gap-2">
                  <StatTile
                    icon={<Dumbbell className="w-3.5 h-3.5" />}
                    label="Как участник"
                    value={attended}
                    suffix="трен."
                    color="#34d399"
                    active={expanded}
                    hint="Засчитано в прогресс"
                  />
                  <StatTile
                    icon={<CalendarPlus className="w-3.5 h-3.5" />}
                    label="Организовано"
                    value={created}
                    suffix="трен."
                    color="#38bdf8"
                    active={expanded}
                    hint="Создано вами в СПб"
                  />
                  <StatTile
                    icon={<Gift className="w-3.5 h-3.5" />}
                    label="Призов SportBuddy"
                    value={prizesCount + boxesOpened}
                    color="#fbbf24"
                    active={expanded}
                    hint={`${boxesOpened} боксов открыто`}
                  />
                  <StatTile
                    icon={<Award className="w-3.5 h-3.5" />}
                    label="Серия входа"
                    value={streak}
                    suffix="дн."
                    color="#fb7185"
                    active={expanded}
                    hint={`Уровень: ${cfg.name}`}
                  />
                  <StatTile
                    icon={<Star className="w-3.5 h-3.5" />}
                    label="Рейтинг"
                    value={Math.round(rating * 10)}
                    color="#a78bfa"
                    active={expanded}
                    hint={`${rating.toFixed(1)} из 5 • ${user.ratingCount || 0} оценок`}
                  />
                  <StatTile
                    icon={<Trophy className="w-3.5 h-3.5" />}
                    label="Циклов пройдено"
                    value={medals.cyclesCompleted.bronze + medals.cyclesCompleted.silver + medals.cyclesCompleted.gold}
                    color="#fcd34d"
                    active={expanded}
                    hint="Завершённые серии наград"
                  />
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-[1fr_auto] gap-3 bg-slate-950 border border-slate-800 rounded-2xl p-3">
                  <div className="space-y-2 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Активность за неделю
                    </p>
                    <WeekBars credits={credits} />
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <ProgressRing
                      percent={boxPct}
                      label="BOX"
                      sub={nextBox ? `до ${nextBox}` : 'MAX'}
                      color={nextBox ? '#34d399' : '#fbbf24'}
                    />
                    <span className="text-[8px] font-bold text-slate-500 text-center">
                      SportBuddy<br />BOX
                    </span>
                  </div>
                </div>

                {/* Sports breakdown */}
                {(user.sports?.length || 0) > 0 && (
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Ваши дисциплины
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {user.sports.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1"
                        >
                          <span>{SPORT_ICONS[s] || '🏅'}</span> {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Target hint */}
                <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
                  <Target className="w-3 h-3 text-emerald-400" />
                  До уровня {level + 1}: {10 - (user.totalWorkouts % 10)} тренировок
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export const ProfileStatsSection = React.memo(
  ProfileStatsInner,
  (prev, next) =>
    prev.user.id === next.user.id &&
    prev.user.totalWorkouts === next.user.totalWorkouts &&
    prev.user.totalDailyMedals === next.user.totalDailyMedals &&
    prev.user.medalTier === next.user.medalTier &&
    prev.trainings === next.trainings &&
    prev.joinedTrainingIds === next.joinedTrainingIds
);
