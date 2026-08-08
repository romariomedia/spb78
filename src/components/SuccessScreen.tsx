import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Crown, LoaderCircle } from 'lucide-react';

interface SuccessScreenProps {
  onContinue: () => void;
}

/** Return page after YooKassa redirect. Premium is activated only by webhook. */
export function SuccessScreen({ onContinue }: SuccessScreenProps) {
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          clearInterval(timer);
          onContinue();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onContinue]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 pt-safe pb-safe flex items-center justify-center text-white">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-sm rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/35 to-slate-900 p-7 text-center shadow-2xl"
      >
        <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 className="h-11 w-11" />
          <Crown className="absolute -right-3 -top-3 h-6 w-6 fill-amber-400 text-amber-400" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Оплата прошла успешно!</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Premium-доступ активируется автоматически после подтверждения платежа ЮKassa.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-xs text-slate-400">
          <LoaderCircle className="h-4 w-4 animate-spin text-emerald-400" />
          Возвращаем в профиль через {seconds} с
        </div>
        <button
          onClick={onContinue}
          className="mt-5 w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-black text-slate-950 active:scale-[0.98]"
        >
          Перейти в профиль
        </button>
      </motion.div>
    </div>
  );
}