import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, Bell, ChevronRight, CalendarCheck } from 'lucide-react';
import { Training, SPORT_ICONS } from '../lib/types';
import {
  getMyUpcoming, getCountdown, formatCountdown, formatFullDate, getTrainingDayKey
} from '../services/schedule';
import { triggerHapticImpact } from '../services/native';

interface UpcomingTrainingsProps {
  trainings: Training[];
  /** Account-scoped explicit memberships, never raw legacy participantIds */
  joinedTrainingIds: ReadonlySet<string>;
  userId: string;
  onOpenTraining: (t: Training) => void;
}

const UpcomingInner: React.FC<UpcomingTrainingsProps> = ({
  trainings, joinedTrainingIds, userId, onOpenTraining
}) => {
  const [, force] = useState(0);

  const upcoming = useMemo(
    () => getMyUpcoming(
      trainings.filter((training) => joinedTrainingIds.has(training.id)),
      userId
    ).slice(0, 4),
    [trainings, userId, joinedTrainingIds]
  );

  // Live ticking countdown (1s while something starts within an hour, else 30s)
  useEffect(() => {
    if (upcoming.length === 0) return;
    const nearest = getCountdown(upcoming[0]!);
    const interval = nearest.total < 3_600_000 ? 1000 : 30_000;
    const timer = setInterval(() => force((v) => v + 1), interval);
    return () => clearInterval(timer);
  }, [upcoming]);

  if (upcoming.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center space-y-2 shadow-xl">
        <CalendarCheck className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-xs font-bold text-slate-300">Нет предстоящих тренировок</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Запишитесь на тренировку — здесь появится таймер обратного отсчёта
          и напоминание за 2 часа до начала.
        </p>
      </div>
    );
  }

  const next = upcoming[0]!;
  const nextC = getCountdown(next);
  const rest = upcoming.slice(1);

  return (
    <div className="space-y-2.5">
      {/* Hero countdown */}
      <motion.button
        layout
        onClick={() => { triggerHapticImpact('light'); onOpenTraining(next); }}
        className={`w-full text-left rounded-3xl p-4 border-2 shadow-xl transition active:scale-[0.99] relative overflow-hidden ${
          nextC.started
            ? 'bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border-emerald-500/70'
            : nextC.soon
            ? 'bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-900 border-amber-500/70'
            : 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-700'
        }`}
      >
        {nextC.soon && !nextC.started && (
          <span className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[9px] font-black px-2.5 py-1 rounded-bl-xl flex items-center gap-1">
            <Bell className="w-2.5 h-2.5" /> СКОРО
          </span>
        )}

        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-xl">{SPORT_ICONS[next.sport] || '🏅'}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              Ближайшая тренировка
            </p>
            <h4 className="text-xs font-black text-white truncate">{next.title}</h4>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
        </div>

        {/* Countdown blocks */}
        {nextC.started ? (
          <p className="text-center text-sm font-black text-emerald-400 py-2">
            🏃 Тренировка началась — отметьтесь на месте!
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { v: nextC.days, l: 'дней' },
              { v: nextC.hours, l: 'часов' },
              { v: nextC.minutes, l: 'минут' },
              { v: nextC.seconds, l: 'секунд' }
            ].map((b) => (
              <div
                key={b.l}
                className="bg-slate-950/80 border border-slate-800 rounded-xl py-2 text-center"
              >
                <span
                  className={`block text-lg font-black leading-none tabular-nums ${
                    nextC.soon ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {String(b.v).padStart(2, '0')}
                </span>
                <span className="text-[8px] text-slate-500 font-bold">{b.l}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-2.5 text-[10px] text-slate-400">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 text-emerald-400 shrink-0" /> {next.locationName}
          </span>
          <span className="flex items-center gap-1 shrink-0 font-bold">
            <Clock className="w-3 h-3" /> {formatFullDate(getTrainingDayKey(next))}, {next.time}
          </span>
        </div>
      </motion.button>

      {/* Compact list of the rest */}
      {rest.map((t) => {
        const c = getCountdown(t);
        return (
          <button
            key={t.id}
            onClick={() => { triggerHapticImpact('light'); onOpenTraining(t); }}
            className="w-full text-left bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-3 flex items-center gap-2.5 transition active:scale-[0.99]"
          >
            <span className="text-base shrink-0">{SPORT_ICONS[t.sport] || '🏅'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-extrabold text-white truncate">{t.title}</p>
              <p className="text-[10px] text-slate-500 truncate">
                {formatFullDate(getTrainingDayKey(t))} • {t.time}
              </p>
            </div>
            <span
              className={`text-[10px] font-black shrink-0 tabular-nums ${
                c.soon ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {formatCountdown(c)}
            </span>
          </button>
        );
      })}

      <p className="text-[10px] text-slate-600 text-center flex items-center justify-center gap-1.5">
        <Bell className="w-3 h-3" /> Напоминание придёт за 2 часа до начала
      </p>
    </div>
  );
};

export const UpcomingTrainings = React.memo(
  UpcomingInner,
  (p, n) =>
    p.trainings === n.trainings &&
    p.userId === n.userId &&
    p.joinedTrainingIds === n.joinedTrainingIds
);
