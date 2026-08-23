import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Clock, Flame, CalendarDays, Info, ClipboardCheck } from 'lucide-react';
import { UserProfile } from '../lib/types';
import {
  isCreditedToday, getTodayCredit, msUntilNextCredit,
  formatCooldown, getWeekMap, getWorkoutStreak, getMonthCount,
  DAILY_LIMIT_NOTE
} from '../services/workoutLog';

interface WorkoutProgressProps { user: UserProfile; }

const WorkoutProgressInner: React.FC<WorkoutProgressProps> = ({ user }) => {
  const [tick, setTick] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  const credited = isCreditedToday(user.id);
  const todayCredit = getTodayCredit(user.id);
  const week = getWeekMap(user.id);
  const streak = getWorkoutStreak(user.id);
  const monthCount = getMonthCount(user.id);
  const cooldown = msUntilNextCredit();

  // Refresh the countdown once a minute
  useEffect(() => {
    if (!credited) return;
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, [credited]);

  return (
    <div
      key={tick}
      className={`rounded-3xl p-4 space-y-3.5 shadow-xl border-2 ${
        credited
          ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/50'
          : 'bg-gradient-to-r from-emerald-900/30 via-slate-900 to-emerald-900/30 border-emerald-500/50'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-black text-white flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            Прогресс тренировок
          </h4>
          <p className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
            1 тренировка в сутки — защита от накрутки
          </p>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1.5 text-slate-500 hover:text-slate-300 transition shrink-0"
          aria-label="Правила зачёта"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden text-[10px] text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-2.5 leading-relaxed"
          >
            {DAILY_LIMIT_NOTE}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { v: user.totalWorkouts, l: 'всего', i: '🏋️' },
          { v: streak, l: 'дней подряд', i: '🔥' },
          { v: monthCount, l: 'за 30 дней', i: '📅' }
        ].map((s) => (
          <div key={s.l} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
            <span className="text-sm block leading-none">{s.i}</span>
            <span className="block text-sm font-black text-white mt-1">{s.v}</span>
            <span className="text-[9px] text-slate-500">{s.l}</span>
          </div>
        ))}
      </div>

      {/* Week strip */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <CalendarDays className="w-3 h-3" /> Последние 7 дней
          </span>
          {streak > 0 && (
            <span className="text-[10px] font-black text-amber-400 flex items-center gap-1">
              <Flame className="w-3 h-3 fill-amber-400" /> {streak}
            </span>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {week.map((d, i) => (
            <div
              key={d.dayKey}
              className={`h-11 rounded-xl border flex flex-col items-center justify-center transition ${
                d.done
                  ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 border-emerald-300 text-slate-950'
                  : 'bg-slate-900 border-slate-800 text-slate-600'
              } ${i === 6 && !d.done ? 'border-dashed border-emerald-500/50' : ''}`}
            >
              <span className="text-xs leading-none">{d.done ? '✓' : '·'}</span>
              <span className="text-[9px] font-bold mt-0.5">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      {credited ? (
        <div className="bg-slate-950 border border-emerald-500/50 rounded-2xl p-3 space-y-1.5">
          <p className="text-[11px] font-black text-emerald-300 flex items-center gap-1.5">
            ✅ Тренировка на сегодня засчитана
          </p>
          {todayCredit?.trainingTitle && (
            <p className="text-[10px] text-slate-400 truncate">
              {todayCredit.sport} • {todayCredit.trainingTitle}
            </p>
          )}
          <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3 h-3 shrink-0" />
            Следующая через {formatCooldown(cooldown)}
          </p>
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-start gap-2.5">
          <ClipboardCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Зачёт появится автоматически после завершения реальной тренировки:
            отметьтесь на месте по GPS и оцените организатора.
          </p>
        </div>
      )}

    </div>
  );
};

/** Memoised: re-renders only when the user's workout total or identity changes */
export const WorkoutProgress = React.memo(
  WorkoutProgressInner,
  (prev, next) =>
    prev.user.id === next.user.id &&
    prev.user.totalWorkouts === next.user.totalWorkouts
);
