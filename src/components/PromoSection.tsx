import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Ticket, Crown, Copy, Check, Gift, Sparkles, Fingerprint,
  LogOut, CalendarClock, AlertCircle
} from 'lucide-react';
import { UserProfile, PromoCode } from '../lib/types';
import {
  redeemPromoCode, getMyPromoCodes, premiumDaysLeft,
  isPremiumActive, isTrialActive, formatDate
} from '../services/promo';
import {
  enrollBiometric, disableBiometric, isBiometricEnabled,
  getSessionAccount, logout
} from '../services/auth';
import { triggerHapticImpact } from '../services/native';
import { ProgressBar } from './ProgressBar';
import { CollapsibleCard } from './CollapsibleCard';

interface PromoSectionProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onLogout: () => void;
}

export const PromoSection: React.FC<PromoSectionProps> = ({ user, onUpdateUser, onLogout }) => {
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [bioOn, setBioOn] = useState(isBiometricEnabled());
  const [bioError, setBioError] = useState<string | null>(null);

  const myPromos: PromoCode[] = getMyPromoCodes(user.id);
  const unusedPromos = myPromos.filter((p) => !p.usedAt);
  const daysLeft = premiumDaysLeft(user);
  const active = isPremiumActive(user);
  const trial = isTrialActive(user);

  const handleRedeem = () => {
    triggerHapticImpact('medium');
    const result = redeemPromoCode(user, code);
    if (!result.ok || !result.user) {
      setFeedback({ ok: false, text: result.error || 'Ошибка активации' });
      return;
    }
    onUpdateUser(result.user);
    setFeedback({
      ok: true,
      text: `🎉 «${result.title}» активирован! Начислено ${result.days} дней Premium.`
    });
    setCode('');
  };

  const handleCopy = async (value: string) => {
    triggerHapticImpact('light');
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCode(value);
      setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleToggleBiometric = async () => {
    setBioError(null);
    const account = getSessionAccount();
    if (!account) {
      setBioError('Сессия не найдена, войдите заново');
      return;
    }
    if (bioOn) {
      disableBiometric();
      setBioOn(false);
      return;
    }
    const result = await enrollBiometric(account);
    if (!result.ok) {
      setBioError(result.error || 'Не удалось включить биометрию');
      return;
    }
    setBioOn(true);
    onUpdateUser({ ...user, biometricEnabled: true });
  };

  return (
    <div className="space-y-5">
      {/* ---------------- Subscription status ---------------- */}
      <div
        className={`rounded-3xl p-5 shadow-2xl border-2 space-y-4 ${
          active
            ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/50'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Ваш тариф
            </span>
            <h3 className="text-lg font-black text-white flex items-center gap-1.5 mt-0.5">
              {active ? (
                <>
                  <Crown className="w-5 h-5 fill-amber-400 text-amber-400" /> Premium
                </>
              ) : (
                <>🆓 Бесплатный</>
              )}
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              {active
                ? trial
                  ? `Пробный период • до ${formatDate(user.premiumUntil)}`
                  : `Действует до ${formatDate(user.premiumUntil)}`
                : 'Активируйте промокод, чтобы открыть все возможности'}
            </p>
          </div>

          <div
            className={`px-3 py-2 rounded-2xl text-center shrink-0 border ${
              active
                ? 'bg-slate-950/80 border-amber-500/50'
                : 'bg-slate-950 border-slate-800'
            }`}
          >
            <span className="block text-xl font-black text-amber-400 leading-none">{daysLeft}</span>
            <span className="text-[10px] text-slate-400 font-medium">дней</span>
          </div>
        </div>

        {active && (
          <ProgressBar
            percentage={Math.min(100, (daysLeft / 30) * 100)}
            label="Остаток Premium-доступа"
            subLabel={`${daysLeft} дн.`}
            color={daysLeft <= 5 ? 'rose' : daysLeft <= 12 ? 'amber' : 'emerald'}
            height="sm"
          />
        )}

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {[
            { label: 'Чаты с мэтчами', on: active },
            { label: 'Посты в ленте', on: active },
            { label: 'SportBuddy BOX', on: active },
            { label: 'Знакомства и карта', on: true }
          ].map((f) => (
            <div
              key={f.label}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border ${
                f.on
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <span>{f.on ? '✓' : '🔒'}</span>
              <span className="font-semibold truncate">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- Promo code redemption ---------------- */}
      <CollapsibleCard
        storageKey="sportbuddy_profile_promo_open_v1"
        className="bg-slate-900 border border-slate-800"
        defaultOpen={false}
        icon={
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-emerald-400" />
          </div>
        }
        title="Промокоды"
        subtitle="Подарочные дни Premium из боксов и медалей"
        collapsedSummary={
          unusedPromos.length > 0
            ? `Доступно ${unusedPromos.length} неиспользованных кодов`
            : 'Активировать подарочный код'
        }
        badge={
          unusedPromos.length > 0 ? (
            <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-500/40">
              {unusedPromos.length}
            </span>
          ) : undefined
        }
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setFeedback(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem(); }}
            placeholder="BOX-XXXX-XXXX"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-mono font-bold tracking-wider text-emerald-300 placeholder-slate-600 uppercase focus:outline-none focus:border-emerald-500 transition"
          />
          <button
            onClick={handleRedeem}
            disabled={!code.trim()}
            className={`px-5 rounded-2xl font-black text-xs transition shrink-0 ${
              code.trim()
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_18px_rgba(16,185,129,0.5)] active:scale-95'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            Применить
          </button>
        </div>

        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-xs font-semibold p-3 rounded-2xl border flex items-start gap-2 ${
              feedback.ok
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/50 text-rose-300'
            }`}
          >
            {feedback.ok ? <Sparkles className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{feedback.text}</span>
          </motion.div>
        )}

        {/* My gift codes */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-amber-400" /> Мои подарочные коды
            </h4>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-lg border border-slate-700">
              доступно: {unusedPromos.length}
            </span>
          </div>

          {myPromos.length === 0 ? (
            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-950 p-3 rounded-2xl border border-slate-800">
              Промокоды появятся здесь автоматически: за <b className="text-amber-400">7 золотых медалей подряд</b> и при открытии <b className="text-emerald-400">SportBuddy BOX</b>.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              {myPromos.map((p) => (
                <div
                  key={p.code}
                  className={`p-3 rounded-2xl border flex items-center gap-3 ${
                    p.usedAt
                      ? 'bg-slate-950/60 border-slate-800/70 opacity-60'
                      : 'bg-slate-950 border-emerald-500/40'
                  }`}
                >
                  <span className="text-xl shrink-0">{p.source === 'streak' ? '🥇' : '🎁'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black font-mono tracking-wider text-emerald-300 truncate">
                      {p.code}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {p.title} • +{p.days} дн. Premium
                    </p>
                  </div>
                  {p.usedAt ? (
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">использован</span>
                  ) : (
                    <button
                      onClick={() => handleCopy(p.code)}
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 transition active:scale-90 shrink-0"
                      aria-label="Скопировать код"
                    >
                      {copiedCode === p.code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <CalendarClock className="w-3 h-3 shrink-0" />
            Партнёрские коды СПб: SPB-ZENIT-2026, SPB-PADEL-CLUB, SPB-BELIENOCHI
          </p>
        </div>
      </CollapsibleCard>

      {/* ---------------- Security & biometrics ---------------- */}
      <CollapsibleCard
        storageKey="sportbuddy_profile_security_open_v1"
        className="bg-slate-900 border border-slate-800"
        defaultOpen={false}
        icon={
          <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-emerald-400" />
          </div>
        }
        title="Безопасность и вход"
        subtitle={user.email || 'Управление аккаунтом'}
        collapsedSummary={bioOn ? 'Отпечаток пальца включён' : 'Вход по паролю'}
        badge={
          <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${
            bioOn
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {bioOn ? '👆 ON' : 'OFF'}
          </span>
        }
      >

        <div className="flex items-center justify-between gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-200">Вход по отпечатку пальца</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              Touch ID / Face ID вместо ввода пароля
            </p>
            {user.email && (
              <p className="text-[10px] text-slate-600 mt-1 truncate">Аккаунт: {user.email}</p>
            )}
          </div>
          <button
            onClick={handleToggleBiometric}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${
              bioOn ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
            aria-label="Переключить биометрию"
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center ${
                bioOn ? 'right-1' : 'left-1'
              }`}
            >
              <Fingerprint className={`w-3.5 h-3.5 ${bioOn ? 'text-emerald-600' : 'text-slate-400'}`} />
            </motion.span>
          </button>
        </div>

        {bioError && (
          <p className="text-[11px] text-rose-400 font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {bioError}
          </p>
        )}

        <button
          onClick={() => {
            triggerHapticImpact('medium');
            logout();
            onLogout();
          }}
          className="w-full py-3 bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/50 text-rose-400 font-bold rounded-2xl text-xs transition active:scale-95 flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Выйти из аккаунта
        </button>
      </CollapsibleCard>
    </div>
  );
};
