import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Check, X, Zap, TrendingUp, BadgePercent } from 'lucide-react';
import { UserProfile } from '../lib/types';
import { premiumDaysLeft, isPremiumActive } from '../services/promo';
import { triggerHapticImpact } from '../services/native';
import { createPremiumPayment, redirectToPayment } from '../services/payments';

/** Promotional pricing valid until 31.12.2026, then the regular price applies */
export const PRICING = {
  monthly: { promo: 490, regular: 990, days: 30, label: 'Месяц' },
  yearly: { promo: 4900, regular: 9900, days: 365, label: 'Год' },
  promoUntil: '31.12.2026'
};

const FEATURES: { label: string; free: boolean }[] = [
  { label: 'Поиск напарников и карта СПб', free: true },
  { label: 'Запись на тренировки', free: true },
  { label: 'Ежедневные медали за вход', free: true },
  { label: 'Создание тренировок', free: false },
  { label: 'Чаты со взаимными симпатиями', free: false },
  { label: 'Публикации и онлайн-трансляции', free: false },
  { label: 'Призовые SportBuddy BOX', free: false },
  { label: 'Значок PRO и приоритет в поиске', free: false }
];

interface PricingSectionProps {
  user: UserProfile;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ user }) => {
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const active = isPremiumActive(user);
  const daysLeft = premiumDaysLeft(user);
  const selected = PRICING[plan];

  const monthlyEquivalent = Math.round(PRICING.yearly.promo / 12);
  const yearSavings = PRICING.monthly.promo * 12 - PRICING.yearly.promo;

  const handleSubscribe = async () => {
    triggerHapticImpact('medium');
    setProcessing(true);
    try {
      // Price and Premium activation are server-side YooKassa operations.
      const payment = await createPremiumPayment(plan);
      redirectToPayment(payment.confirmationUrl);
    } catch (error) {
      setDone(error instanceof Error ? error.message : 'Не удалось начать оплату.');
      setProcessing(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(245,158,11,0.4)]">
            <Crown className="w-5 h-5 text-slate-950 fill-slate-950" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white">Тариф</h3>
            <p className="text-[11px] text-slate-400">
              {active ? `Premium активен • ${daysLeft} дн.` : 'Бесплатный тариф'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-xl border border-emerald-500/40 flex items-center gap-1 shrink-0">
          <BadgePercent className="w-3 h-3" /> Акция
        </span>
      </div>

      {/* Feature comparison */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_58px_58px] gap-1 px-3 py-2 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider">
          <span className="text-slate-500">Возможности</span>
          <span className="text-slate-400 text-center">Free</span>
          <span className="text-amber-400 text-center">PRO</span>
        </div>
        {FEATURES.map((f) => (
          <div key={f.label} className="grid grid-cols-[1fr_58px_58px] gap-1 px-3 py-2 border-b border-slate-800/60 last:border-0 items-center">
            <span className="text-[11px] text-slate-300 leading-snug">{f.label}</span>
            <span className="flex justify-center">
              {f.free ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-slate-600" />}
            </span>
            <span className="flex justify-center">
              <Check className="w-3.5 h-3.5 text-amber-400" />
            </span>
          </div>
        ))}
      </div>

      {/* Plan selector */}
      <div className="grid grid-cols-2 gap-2.5">
        {(['monthly', 'yearly'] as const).map((key) => {
          const p = PRICING[key];
          const isSel = plan === key;
          return (
            <button
              key={key}
              onClick={() => { triggerHapticImpact('light'); setPlan(key); }}
              className={`relative p-3.5 rounded-2xl border-2 text-left transition-all ${
                isSel
                  ? 'bg-gradient-to-b from-amber-950/50 to-slate-950 border-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              {key === 'yearly' && (
                <span className="absolute -top-2 right-2 text-[9px] font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-md shadow">
                  ВЫГОДНО
                </span>
              )}
              <p className={`text-[11px] font-black uppercase tracking-wide ${isSel ? 'text-amber-400' : 'text-slate-400'}`}>
                {p.label}
              </p>
              <p className="text-xl font-black text-white mt-1 leading-none">
                {p.promo.toLocaleString('ru-RU')} ₽
              </p>
              <p className="text-[10px] text-slate-500 line-through mt-0.5">
                {p.regular.toLocaleString('ru-RU')} ₽
              </p>
              {key === 'yearly' && (
                <p className="text-[10px] text-emerald-400 font-bold mt-1">
                  ≈ {monthlyEquivalent} ₽/мес
                </p>
              )}
            </button>
          );
        })}
      </div>

      {plan === 'yearly' && (
        <p className="text-[11px] text-emerald-300 font-bold flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl">
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          Экономия {yearSavings.toLocaleString('ru-RU')} ₽ за год
        </p>
      )}

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
        <p className="text-[10px] text-slate-400 leading-relaxed">
          🔥 Акционные цены действуют до <b className="text-amber-400">{PRICING.promoUntil}</b>.
          После окончания акции стоимость составит {PRICING.monthly.regular} ₽ в месяц
          и {PRICING.yearly.regular.toLocaleString('ru-RU')} ₽ в год.
        </p>
      </div>

      {done && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/50 p-3 rounded-2xl text-center"
        >
          🎉 {done}
        </motion.p>
      )}

      <button
        onClick={handleSubscribe}
        disabled={processing}
        className="w-full py-4 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-slate-950 font-black rounded-2xl text-sm transition shadow-[0_0_25px_rgba(245,158,11,0.45)] active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
      >
        <Zap className="w-4 h-4 fill-slate-950" />
        {processing
          ? 'Переход к ЮKassa…'
          : active
          ? `Продлить за ${selected.promo.toLocaleString('ru-RU')} ₽`
          : `Оформить за ${selected.promo.toLocaleString('ru-RU')} ₽`}
      </button>

      <p className="text-[10px] text-slate-600 text-center leading-relaxed">
        Безопасная оплата проводится через ЮKassa. Premium активируется только после
        серверного подтверждения успешного платежа.
      </p>
    </div>
  );
};
