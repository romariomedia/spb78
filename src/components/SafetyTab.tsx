import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Dumbbell, Flag, AlertTriangle } from 'lucide-react';
import { SAFETY_RULES } from '../legal/terms';
import { triggerHapticImpact } from '../services/native';

interface SafetyTabProps {
  /** Optional handler for the "Пожаловаться" button */
  onReport?: () => void;
}

export const SafetyTab: React.FC<SafetyTabProps> = ({ onReport }) => {
  const [hero, ...rest] = SAFETY_RULES;

  const handleReport = () => {
    triggerHapticImpact('medium');
    if (onReport) {
      onReport();
      return;
    }
    alert(
      'Опишите ситуацию в письме на support@sportbuddy78.ru или нажмите «Пожаловаться» ' +
        'в анкете собеседника. Обращения рассматриваются в течение 24 часов.'
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center gap-2.5 shadow-xl">
        <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-white">Меры безопасности</h3>
          <p className="text-[11px] text-slate-400">Знакомства только на тренировках</p>
        </div>
      </div>

      {/* ⭐ Highlighted main rule */}
      {hero && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-900 border-2 border-emerald-500/70 rounded-3xl p-5 shadow-[0_0_28px_rgba(16,185,129,0.2)]"
        >
          <span
            aria-hidden
            className="absolute -top-8 -right-8 text-[110px] leading-none opacity-[0.07] select-none pointer-events-none"
          >
            🏃‍♂️
          </span>

          <div className="relative z-10 space-y-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-lg shadow">
              <Dumbbell className="w-3 h-3" /> Главное правило платформы
            </span>

            <h4 className="text-base font-black text-white leading-snug flex items-start gap-2">
              <span className="text-xl shrink-0">{hero.icon}</span>
              {hero.heading}
            </h4>

            {hero.body.map((p, i) => (
              <p key={i} className="text-xs text-slate-200 leading-relaxed">
                {p}
              </p>
            ))}

            <button
              onClick={handleReport}
              className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-2xl text-xs transition active:scale-95 flex items-center justify-center gap-2"
            >
              <Flag className="w-4 h-4" /> Пожаловаться на собеседника
            </button>
          </div>
        </motion.div>
      )}

      {/* Remaining rule blocks */}
      <div className="space-y-3">
        {rest.map((block) => {
          const isDanger = block.heading.includes('небезопасного');
          return (
            <div
              key={block.heading}
              className={`rounded-3xl border p-4 space-y-2.5 shadow-xl ${
                isDanger
                  ? 'bg-rose-950/30 border-rose-500/40'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <h4 className="text-xs font-black text-white flex items-center gap-2">
                <span className="text-base">{block.icon}</span>
                {block.heading}
              </h4>
              <ul className="space-y-1.5">
                {block.body.map((line, i) => (
                  <li
                    key={i}
                    className="text-[11px] text-slate-300 leading-relaxed flex gap-2"
                  >
                    <span
                      className={`shrink-0 mt-1.5 w-1 h-1 rounded-full ${
                        isDanger ? 'bg-rose-400' : 'bg-emerald-400'
                      }`}
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-600 leading-relaxed text-center flex items-start gap-1.5 justify-center px-2">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
        SportBuddy не организует личные встречи вне тренировок и не несёт ответственности
        за договорённости, достигнутые в обход правил платформы.
      </p>
    </div>
  );
};
