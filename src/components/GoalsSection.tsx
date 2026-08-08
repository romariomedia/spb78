import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Plus, Trash2, TrendingUp, CalendarClock,
  CheckCircle2, Flame, X
} from 'lucide-react';
import { UserProfile, PersonalGoal, GoalType, GoalPeriod } from '../lib/types';
import {
  GOAL_TEMPLATES, GOAL_PERIODS, getGoals, getGoalStats, createGoal,
  addProgress, deleteGoal, goalProgress, daysLeft, requiredPace,
  isOnTrack, formatDeadline
} from '../services/goals';
import { triggerHapticImpact } from '../services/native';
import { ProgressBar } from './ProgressBar';
import { CollapsibleCard } from './CollapsibleCard';

interface GoalsSectionProps {
  user: UserProfile;
}

export const GoalsSection: React.FC<GoalsSectionProps> = ({ user }) => {
  const [goals, setGoals] = useState<PersonalGoal[]>(() => getGoals(user.id));
  const [creating, setCreating] = useState(false);
  const [tplIndex, setTplIndex] = useState(0);
  const [target, setTarget] = useState(GOAL_TEMPLATES[0]!.defaultTarget);
  const [period, setPeriod] = useState<GoalPeriod>('month');
  const [customTitle, setCustomTitle] = useState('');
  const [progressFor, setProgressFor] = useState<string | null>(null);
  const [progressValue, setProgressValue] = useState('');
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const stats = getGoalStats(user.id);
  const tpl = GOAL_TEMPLATES[tplIndex]!;

  const refresh = () => setGoals(getGoals(user.id));

  const handleCreate = () => {
    const title = tpl.type === 'custom' && customTitle.trim() ? customTitle.trim() : tpl.title;
    createGoal(user, tpl.type as GoalType, title, Number(target) || 1, tpl.unit, period);
    refresh();
    setCreating(false);
    setCustomTitle('');
  };

  const handleAddProgress = (goalId: string) => {
    const value = parseFloat(progressValue.replace(',', '.'));
    if (!value || isNaN(value)) return;
    const result = addProgress(goalId, value);
    refresh();
    setProgressValue('');
    setProgressFor(null);
    if (result?.justCompleted) {
      setCelebrate(result.goal.title);
      setTimeout(() => setCelebrate(null), 4000);
    }
  };

  return (
    <CollapsibleCard
      storageKey="sportbuddy_profile_goals_open_v1"
      className="bg-slate-900 border border-slate-800"
      defaultOpen={false}
      icon={
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-[0_0_16px_rgba(16,185,129,0.35)]">
          <Target className="w-5 h-5 text-slate-950" />
        </div>
      }
      title="Моя цель"
      subtitle="Личные достижения и прогресс"
      collapsedSummary={
        stats.active > 0
          ? `${stats.active} активных • прогресс ${stats.avgProgress}%`
          : 'Цель пока не поставлена'
      }
      badge={
        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-500/40">
          {stats.active > 0 ? `${stats.avgProgress}%` : '—'}
        </span>
      }
      action={
        <button
          onClick={() => { triggerHapticImpact('medium'); setCreating(!creating); }}
          className={`p-2.5 rounded-xl transition active:scale-90 ${
            creating
              ? 'bg-slate-800 text-slate-300 border border-slate-700'
              : 'bg-emerald-500 text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
          }`}
          aria-label="Новая цель"
        >
          {creating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[3]" />}
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { v: stats.active, l: 'активных', i: '🎯' },
          { v: stats.completed, l: 'достигнуто', i: '🏆' },
          { v: `${stats.avgProgress}%`, l: 'прогресс', i: '📈' },
          { v: stats.totalEntries, l: 'записей', i: '📝' }
        ].map((s) => (
          <div key={s.l} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
            <span className="text-sm block leading-none">{s.i}</span>
            <span className="block text-xs font-black text-white mt-1">{s.v}</span>
            <span className="text-[9px] text-slate-500">{s.l}</span>
          </div>
        ))}
      </div>

      {celebrate && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 border-2 border-amber-500/60 rounded-2xl p-3.5 text-center"
        >
          <p className="text-sm font-black text-white">🏆 Цель достигнута!</p>
          <p className="text-[11px] text-amber-300 mt-0.5">«{celebrate}»</p>
        </motion.div>
      )}

      {/* Create form */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-5 gap-1.5">
                {GOAL_TEMPLATES.map((t, i) => (
                  <button
                    key={t.type}
                    onClick={() => {
                      triggerHapticImpact('light');
                      setTplIndex(i);
                      setTarget(t.defaultTarget);
                    }}
                    className={`p-2 rounded-xl border text-center transition ${
                      tplIndex === i
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span className="text-base block leading-none">{t.icon}</span>
                  </button>
                ))}
              </div>

              <div>
                <p className="text-xs font-black text-white">{tpl.title}</p>
                <p className="text-[10px] text-slate-500">{tpl.hint}</p>
              </div>

              {tpl.type === 'custom' && (
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Например: 50 подтягиваний за подход"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              )}

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Цель</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      value={target}
                      onChange={(e) => setTarget(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                      {tpl.unit}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Срок</label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as GoalPeriod)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {GOAL_PERIODS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreate}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow-[0_0_16px_rgba(16,185,129,0.4)] active:scale-95"
              >
                🎯 Поставить цель
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals list */}
      {goals.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
          <Target className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs font-bold text-slate-300">Цель пока не поставлена</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Поставьте личную цель — например, 100 км бега по Санкт-Петербургу за месяц,
            и отслеживайте прогресс.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {goals.map((g) => {
            const pct = goalProgress(g);
            const left = daysLeft(g);
            const done = !!g.completedAt;
            const track = isOnTrack(g);
            const tplIcon = GOAL_TEMPLATES.find((t) => t.type === g.type)?.icon ?? '🎯';

            return (
              <motion.div
                key={g.id}
                layout
                className={`rounded-2xl border p-3.5 space-y-2.5 ${
                  done
                    ? 'bg-gradient-to-br from-emerald-950/40 to-slate-950 border-emerald-500/50'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-xl shrink-0">{done ? '🏆' : tplIcon}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-extrabold text-white truncate">{g.title}</h4>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <CalendarClock className="w-2.5 h-2.5 shrink-0" />
                      {done ? `Достигнута ${formatDeadline(g.completedAt!)}` : `Осталось ${left} дн. • до ${formatDeadline(g.deadline)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => { deleteGoal(g.id); refresh(); }}
                    className="p-1.5 text-slate-600 hover:text-rose-400 transition shrink-0"
                    aria-label="Удалить цель"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <ProgressBar
                  percentage={pct}
                  label={`${g.currentValue} / ${g.targetValue} ${g.unit}`}
                  subLabel={done ? 'Выполнено ✓' : track ? 'В графике' : 'Отстаёте'}
                  color={done ? 'emerald' : track ? 'emerald' : 'amber'}
                  showPercentage
                />

                {!done && (
                  <>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      {track ? (
                        <><TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" /> Отличный темп, продолжайте!</>
                      ) : (
                        <><Flame className="w-3 h-3 text-amber-400 shrink-0" /> Нужно ~{requiredPace(g)} {g.unit}/день</>
                      )}
                    </p>

                    {progressFor === g.id ? (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          autoFocus
                          value={progressValue}
                          onChange={(e) => setProgressValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddProgress(g.id); }}
                          placeholder={`Сколько ${g.unit}?`}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={() => handleAddProgress(g.id)}
                          className="px-4 bg-emerald-500 text-slate-950 font-black rounded-xl text-xs active:scale-95 transition"
                        >
                          ОК
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { triggerHapticImpact('light'); setProgressFor(g.id); }}
                        className="w-full py-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-emerald-400 font-bold rounded-xl text-[11px] transition active:scale-95"
                      >
                        + Добавить прогресс
                      </button>
                    )}
                  </>
                )}

                {/* Recent history */}
                {g.history.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-800/70">
                    {g.history.slice(0, 6).map((h) => (
                      <span
                        key={h.id}
                        className="text-[9px] font-bold bg-slate-900 text-slate-400 border border-slate-800 px-2 py-1 rounded-lg whitespace-nowrap shrink-0"
                      >
                        +{h.value} {g.unit} · {h.date}
                      </span>
                    ))}
                  </div>
                )}

                {done && (
                  <p className="text-[11px] font-black text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Цель достигнута — поздравляем!
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </CollapsibleCard>
  );
};
