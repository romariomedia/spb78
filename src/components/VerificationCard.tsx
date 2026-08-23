import React from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, Clock, ChevronRight, ShieldAlert } from 'lucide-react';
import { UserProfile, VerificationStepId } from '../lib/types';
import { getVerificationState } from '../services/verification';
import { ProgressBar } from './ProgressBar';
import { triggerHapticImpact } from '../services/native';

interface VerificationCardProps {
  user: UserProfile;
  onStepAction: (step: VerificationStepId) => void;
  compact?: boolean;
}

export const VerificationCard: React.FC<VerificationCardProps> = ({
  user, onStepAction, compact = false
}) => {
  const state = getVerificationState(user);
  const percent = Math.round((state.requiredCompletedCount / state.requiredCount) * 100);

  /* ------------------------------- verified -------------------------------- */
  if (state.isVerified) {
    if (compact) return null;
    return (
      <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900 to-emerald-950/50 border-2 border-emerald-500/60 rounded-3xl p-4 flex items-center gap-3 shadow-xl">
        <div className="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(16,185,129,0.5)]">
          <BadgeCheck className="w-6 h-6 text-slate-950" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-black text-white flex items-center gap-1.5">
            Аккаунт верифицирован ✓
          </h4>
          <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
            Ваша анкета проверена и отображается в поиске рядом. Спортсмены СПб видят значок доверия.
          </p>
        </div>
      </div>
    );
  }

  /* ----------------------------- in progress ------------------------------- */
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl p-4 space-y-3 shadow-xl border-2 ${
        state.expired
          ? 'bg-rose-950/50 border-rose-500/60'
          : 'bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-900 border-amber-500/60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
          state.expired ? 'bg-rose-500/20 border border-rose-500' : 'bg-amber-500/20 border border-amber-500'
        }`}>
          {state.expired
            ? <ShieldAlert className="w-5 h-5 text-rose-400" />
            : <BadgeCheck className="w-5 h-5 text-amber-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-black text-white">
            {state.expired ? 'Срок верификации истёк' : 'Пройдите верификацию аккаунта'}
          </h4>
          <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
            {state.expired
              ? 'Аккаунт скрыт из поиска. Завершите проверку, чтобы восстановить доступ.'
              : 'Верифицированные анкеты участвуют в поиске людей рядом и вызывают больше доверия.'}
          </p>
        </div>
      </div>

      {!state.expired && (
        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2">
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-bold text-amber-300">
            Осталось {state.hoursLeft} ч с момента регистрации
          </span>
        </div>
      )}

      <ProgressBar
        percentage={percent}
        label={`Пройдено ${state.requiredCompletedCount} из ${state.requiredCount}`}
        subLabel={state.expired ? 'Просрочено' : 'В процессе'}
        color={state.expired ? 'rose' : percent >= 66 ? 'emerald' : 'amber'}
        height="sm"
      />

      <div className="space-y-1.5">
        {state.steps.map((step) => (
          <button
            key={step.id}
            onClick={() => { triggerHapticImpact('light'); onStepAction(step.id); }}
            disabled={step.done}
            className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition ${
              step.done
                ? 'bg-emerald-500/10 border-emerald-500/40 cursor-default'
                : 'bg-slate-950 border-slate-800 hover:border-amber-500/50 active:scale-[0.99]'
            }`}
          >
            <span className="text-base shrink-0">{step.done ? '✅' : step.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-extrabold truncate ${
                step.done ? 'text-emerald-300' : 'text-white'
              }`}>
                {step.label}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {step.description}{step.required === false ? ' • необязательно' : ''}
              </p>
            </div>
            {!step.done && <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
