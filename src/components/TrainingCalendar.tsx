import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays, X, ChevronDown } from 'lucide-react';
import { Training } from '../lib/types';
import {
  buildMonthGrid, toDayKey, fromDayKey, countByDay, isToday, isPastDay,
  WEEKDAYS_SHORT, MONTHS_RU, formatDayLabel, getTrainingDayKey
} from '../services/schedule';
import { triggerHapticImpact } from '../services/native';

type CalendarView = 'collapsed' | 'strip' | 'month';
const VIEW_KEY = 'sportbuddy_calendar_view_v1';

interface TrainingCalendarProps {
  trainings: Training[];
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
}

const TrainingCalendarInner: React.FC<TrainingCalendarProps> = ({
  trainings, selectedDay, onSelectDay
}) => {
  const [anchor, setAnchor] = useState(() =>
    selectedDay ? fromDayKey(selectedDay) : new Date()
  );

  // Remember the user's preferred density between sessions
  const [view, setViewState] = useState<CalendarView>(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY) as CalendarView | null;
      return saved === 'collapsed' || saved === 'strip' || saved === 'month' ? saved : 'strip';
    } catch {
      return 'strip';
    }
  });

  const setView = (v: CalendarView) => {
    triggerHapticImpact('light');
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  };

  const grid = useMemo(() => buildMonthGrid(anchor), [anchor]);
  const counts = useMemo(() => countByDay(trainings), [trainings]);

  // Next 14 days for the horizontal quick strip
  const strip = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push(toDayKey(d));
    }
    return out;
  }, []);

  const shiftMonth = (delta: number) => {
    triggerHapticImpact('light');
    setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1));
  };

  const pick = (key: string) => {
    triggerHapticImpact('light');
    onSelectDay(selectedDay === key ? null : key);
  };

  const totalOnSelected = selectedDay
    ? trainings.filter((t) => getTrainingDayKey(t) === selectedDay).length
    : 0;

  const isCollapsed = view === 'collapsed';

  return (
    <div
      className={`bg-slate-900 border rounded-3xl shadow-xl transition-colors ${
        selectedDay ? 'border-emerald-500/50' : 'border-slate-800'
      } ${isCollapsed ? 'p-2.5' : 'p-3.5 space-y-3'}`}
    >
      {/* Header — tap anywhere to collapse / expand */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setView(isCollapsed ? 'strip' : 'collapsed')}
          className="flex items-center gap-2 min-w-0 flex-1 text-left active:scale-[0.98] transition"
        >
          <div
            className={`rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0 ${
              isCollapsed ? 'w-8 h-8' : 'w-9 h-9'
            }`}
          >
            <CalendarDays className={isCollapsed ? 'w-3.5 h-3.5 text-emerald-400' : 'w-4 h-4 text-emerald-400'} />
          </div>

          <div className="min-w-0">
            <h3 className="text-xs font-extrabold text-white truncate">
              {isCollapsed && selectedDay
                ? `📅 ${formatDayLabel(selectedDay)}`
                : 'Календарь тренировок'}
            </h3>
            <p className="text-[10px] text-slate-400 truncate">
              {selectedDay
                ? `${totalOnSelected} событий${isCollapsed ? '' : ` • ${formatDayLabel(selectedDay)}`}`
                : isCollapsed
                ? 'Нажмите, чтобы выбрать дату'
                : 'Выберите дату для фильтра'}
            </p>
          </div>

          {/* Collapse chevron */}
          <motion.span
            animate={{ rotate: isCollapsed ? 0 : 180 }}
            className="ml-auto shrink-0 text-slate-500"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.span>
        </button>

        {/* Reset filter stays reachable even when collapsed */}
        {selectedDay && (
          <button
            onClick={() => { triggerHapticImpact('light'); onSelectDay(null); }}
            className="px-2 py-1.5 bg-slate-950 border border-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 active:scale-95 transition shrink-0"
          >
            <X className="w-3 h-3" /> Сброс
          </button>
        )}
      </div>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              {/* Density switcher */}
              <div className="flex gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl">
                {([
                  { id: 'strip' as CalendarView, label: '14 дней' },
                  { id: 'month' as CalendarView, label: 'Месяц' }
                ]).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setView(m.id)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition ${
                      view === m.id
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Horizontal 14-day strip */}
              {view === 'strip' && (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
                  {strip.map((key) => {
                    const d = fromDayKey(key);
                    const count = counts[key] || 0;
                    const active = selectedDay === key;
                    return (
                      <button
                        key={key}
                        onClick={() => pick(key)}
                        className={`shrink-0 w-[52px] rounded-2xl border py-2 flex flex-col items-center gap-0.5 transition active:scale-95 ${
                          active
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.45)]'
                            : isToday(key)
                            ? 'bg-slate-950 border-emerald-500/50 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className={`text-[9px] font-bold ${active ? 'text-slate-900' : 'text-slate-500'}`}>
                          {WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}
                        </span>
                        <span className="text-base font-black leading-none">{d.getDate()}</span>
                        <span className="h-2 flex items-center gap-0.5">
                          {count > 0 &&
                            Array.from({ length: Math.min(3, count) }).map((_, i) => (
                              <span
                                key={i}
                                className={`w-1 h-1 rounded-full ${active ? 'bg-slate-900' : 'bg-emerald-400'}`}
                              />
                            ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Full month grid */}
              {view === 'month' && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => shiftMonth(-1)}
                      className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 active:scale-90 transition"
                      aria-label="Предыдущий месяц"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-black text-white">
                      {MONTHS_RU[anchor.getMonth()]} {anchor.getFullYear()}
                    </span>
                    <button
                      onClick={() => shiftMonth(1)}
                      className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 active:scale-90 transition"
                      aria-label="Следующий месяц"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAYS_SHORT.map((w) => (
                      <span key={w} className="text-[9px] font-black text-slate-600 text-center py-0.5">
                        {w}
                      </span>
                    ))}
                    {grid.map((cell) => {
                      const count = counts[cell.key] || 0;
                      const active = selectedDay === cell.key;
                      const past = isPastDay(cell.key);
                      return (
                        <button
                          key={cell.key}
                          onClick={() => pick(cell.key)}
                          className={`aspect-square rounded-lg border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 transition active:scale-90 ${
                            active
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                              : isToday(cell.key)
                              ? 'bg-slate-900 border-emerald-500/60 text-emerald-400'
                              : cell.inMonth
                              ? `bg-slate-900 border-slate-800 ${past ? 'text-slate-600' : 'text-slate-200'}`
                              : 'bg-transparent border-transparent text-slate-700'
                          }`}
                        >
                          <span className="leading-none">{fromDayKey(cell.key).getDate()}</span>
                          {count > 0 && (
                            <span
                              className={`w-1 h-1 rounded-full ${
                                active ? 'bg-slate-900' : 'bg-emerald-400'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick collapse at the bottom for long month view */}
              <button
                onClick={() => setView('collapsed')}
                className="w-full py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition active:scale-[0.98] flex items-center justify-center gap-1"
              >
                <ChevronDown className="w-3 h-3 rotate-180" /> Свернуть календарь
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const TrainingCalendar = React.memo(
  TrainingCalendarInner,
  (p, n) => p.trainings === n.trainings && p.selectedDay === n.selectedDay
);
