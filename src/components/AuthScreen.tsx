import { isBetaActive } from '../lib/release';
import { useEffect, useRef, useState } from 'react';
import * as VKID from '@vkid/sdk';
import { motion } from 'framer-motion';
import {
  Fingerprint, AlertCircle, Dumbbell, Landmark, MapPin, MoveRight,
  Mail, Lock, User as UserIcon, Eye, EyeOff, ChevronDown
} from 'lucide-react';
import type { AuthAccount } from '../lib/types';
import {
  loginWithVK, authenticateBiometric, isBiometricEnabled, TRIAL_DAYS,
  registerAccount, loginWithPassword, requestPasswordRecovery
} from '../services/auth';
import {
  getHighQualityVKAvatar,
  VKID_WEB_APP_ID,
  VKID_WEB_REDIRECT_URL,
  VKID_ANDROID_REDIRECT_URL
} from '../services/vkid';
import { triggerHapticImpact } from '../services/native';
import { isNativeApp } from '../services/media';

// This screen uses the VK ID Web SDK (OAuthList) in both the browser and
// the Capacitor WebView. The Android VK ID app (54714060) is for the native
// VK ID Android SDK and must not be passed to the Web SDK: doing so opens
// id.vk.ru but VK cannot load the authorization page.
//
// Android still gets its own callback URL so the HTTPS App Link can return
// the OAuth result to the APK. The existing web app (54699979) must have
// https://sportbuddy78.pro/vk-callback in its trusted redirect URLs.
const VK_APP_ID = VKID_WEB_APP_ID;
const VK_REDIRECT_URL = isNativeApp ? VKID_ANDROID_REDIRECT_URL : VKID_WEB_REDIRECT_URL;
const VK_PENDING_CALLBACK_KEY = 'sportbuddy_vk_pending_callback';

/** Pre-computed white-night particles — deterministic, no re-randomisation. */
const AUTH_PARTICLES = [
  { id: 1, left: 8,  bottom: 12, size: 3, duration: 11, delay: 0,   color: 'rgba(110, 231, 183, 0.55)' },
  { id: 2, left: 22, bottom: 4,  size: 2, duration: 13, delay: 1.5, color: 'rgba(56, 189, 248, 0.45)' },
  { id: 3, left: 38, bottom: 18, size: 4, duration: 10, delay: 0.8, color: 'rgba(110, 231, 183, 0.4)' },
  { id: 4, left: 55, bottom: 6,  size: 2, duration: 12, delay: 2.2, color: 'rgba(251, 191, 36, 0.4)' },
  { id: 5, left: 70, bottom: 14, size: 3, duration: 11, delay: 1.1, color: 'rgba(110, 231, 183, 0.5)' },
  { id: 6, left: 84, bottom: 8,  size: 2, duration: 14, delay: 0.4, color: 'rgba(56, 189, 248, 0.4)' },
  { id: 7, left: 48, bottom: 2,  size: 3, duration: 12, delay: 3,   color: 'rgba(110, 231, 183, 0.45)' },
  { id: 8, left: 15, bottom: 26, size: 2, duration: 13, delay: 2.6, color: 'rgba(251, 191, 36, 0.35)' }
];

interface Props {
  /** `vkAvatar` передаётся, когда вход выполнен через VK ID */
  onAuthenticated: (account: AuthAccount, isNewAccount: boolean, vkAvatar?: string) => void;
  /** Shown after a security-triggered logout, e.g. missed verification deadline. */
  initialNotice?: string;
}

/** Official SportBuddy78 brand mark. */
function BrandMark() {
  return (
    <div className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[26px] border border-emerald-300/50 bg-black shadow-[0_0_34px_rgba(16,185,129,0.3)]">
      <img
        src="/sportbuddy78-logo.png.png"
        alt="SportBuddy78"
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}

export function AuthScreen({ onAuthenticated, initialNotice = '' }: Props) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialNotice);
  const [vkBusy, setVkBusy] = useState(false);

  // E-mail + password flow (Firebase Auth) alongside VK ID.
  const [showEmail, setShowEmail] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  // Gender is chosen once at registration and locked afterwards.
  const [regGender, setRegGender] = useState<'male' | 'female' | null>(null);

  const biometricAvailable = isBiometricEnabled();

  const oAuthContainerRef = useRef<HTMLDivElement>(null);

  // Shared tail of the VK ID flow: exchange code → profile → local account.
  const finishVkLogin = async (code: string, deviceId: string) => {
    setError('');
    setVkBusy(true);
    try {
      const tokens = await VKID.Auth.exchangeCode(code, deviceId);
      let u: Record<string, unknown> = {};
      try {
        const info = await VKID.Auth.userInfo(tokens.access_token);
        u = (info.user || {}) as Record<string, unknown>;
      } catch {
        /* некоторые провайдеры OAuthList не отдают профиль — используем токены */
      }

      const vkId = String(u.user_id ?? tokens.user_id ?? '');
      const fullName =
        `${(u.first_name as string) ?? ''} ${(u.last_name as string) ?? ''}`.trim() || 'Спортсмен VK';

      const result = await loginWithVK(
        vkId,
        (u.email as string) || `vk_${vkId}@sportbuddy78.pro`,
        fullName,
        getHighQualityVKAvatar((u.avatar as string) || ''),
        tokens.access_token
      );

      if (!result.ok || !result.account) {
        setError(result.error || 'Не удалось войти. Попробуйте позже.');
        return;
      }

      onAuthenticated(result.account, result.isNewAccount ?? false, getHighQualityVKAvatar((u.avatar as string) || ''));
    } catch {
      setError('Не удалось войти. Попробуйте позже.');
    } finally {
      setVkBusy(false);
    }
  };

  useEffect(() => {
    // Инициализация VK ID и рендер виджета OAuthList «3 в 1» (VK ID + Mail.ru + OK).
    // Важно: callback-listener НЕ должен завершать effect раньше рендера виджета.
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const consumePendingCallback = () => {
      try {
        const raw = sessionStorage.getItem(VK_PENDING_CALLBACK_KEY);
        if (!raw) return;
        sessionStorage.removeItem(VK_PENDING_CALLBACK_KEY);
        const pending = JSON.parse(raw) as { code?: string; device_id?: string };
        if (pending.code && pending.device_id) {
          void finishVkLogin(pending.code, pending.device_id);
        }
      } catch {
        // Ignore malformed/stale callback data.
      }
    };

    const consumeCurrentUrlCallback = () => {
      try {
        const url = new URL(window.location.href);
        if (!url.pathname.endsWith('/vk-callback')) return;
        const code = url.searchParams.get('code');
        const deviceId = url.searchParams.get('device_id');
        if (code && deviceId) {
          // This is also a fallback when Android App Links are not yet
          // verified and the callback opens in the browser/WebView.
          void finishVkLogin(code, deviceId);
          window.history.replaceState({}, document.title, '/');
        }
      } catch {
        // Ignore malformed callback URLs.
      }
    };

    const handleVkCallback = (e: Event) => {
      const customEvent = e as CustomEvent<{ code: string; device_id: string }>;
      const { code, device_id } = customEvent.detail || {};
      if (code && device_id) void finishVkLogin(code, device_id);
    };

    window.addEventListener('vk-oauth-callback', handleVkCallback);

    try {
      VKID.Config.init({
        app: VK_APP_ID,
        redirectUrl: VK_REDIRECT_URL,
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: 'email'
      });

      const container = oAuthContainerRef.current;
      if (container) {
        const oAuth = new VKID.OAuthList();
        oAuth
          .render({
            container,
            // «3 в 1»: VK ID + Mail.ru + OK в одном виджете
            oauthList: [VKID.OAuthName.VK, VKID.OAuthName.MAIL, VKID.OAuthName.OK],
            styles: { borderRadius: 16 }
          })
          .on(VKID.WidgetEvents.ERROR, () => {
            if (!disposed) setError('VK ID недоступен. Войдите по e-mail.');
          })
          .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, (payload: { code: string; device_id: string }) => {
            void finishVkLogin(payload.code, payload.device_id);
          });
        cleanup = () => {
          try { oAuth.close?.(); } catch { /* ignore */ }
        };
      }

      // A browser/App-Link callback can arrive before React finishes mounting.
      // Consume both the native bridge copy and a callback that landed directly
      // in the current WebView/browser URL.
      consumePendingCallback();
      consumeCurrentUrlCallback();
    } catch {
      setError('VK ID недоступен. Войдите по e-mail.');
    }

    return () => {
      disposed = true;
      cleanup?.();
      window.removeEventListener('vk-oauth-callback', handleVkCallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setNotice(initialNotice), [initialNotice]);

  const handleBiometric = async () => {
    triggerHapticImpact('medium');
    setError('');
    const result = await authenticateBiometric();
    if (!result.ok || !result.account) {
      setError(result.error || 'Отпечаток не распознан');
      return;
    }
    onAuthenticated(result.account, false);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailBusy(true);
    try {
      if (isRegister && !regGender) {
        setError('Выберите пол — он определяет подбор напарников и не меняется после регистрации');
        return;
      }
      const result = isRegister
        ? await registerAccount(name, email, password, regGender ?? undefined)
        : await loginWithPassword(email, password);

      if (!result.ok || !result.account) {
        setError(result.error || 'Ошибка входа');
        return;
      }
      onAuthenticated(result.account, result.isNewAccount ?? false);
    } finally {
      setEmailBusy(false);
    }
  };

  const handlePasswordRecovery = async () => {
    setError('');
    setEmailBusy(true);
    try {
      const result = await requestPasswordRecovery(email);
      if (!result.ok) {
        setError(result.error || 'Не удалось отправить письмо');
        return;
      }
      setRecoverySent(true);
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <div className="sb-auth-shell relative min-h-screen overflow-hidden px-5 pt-safe pb-safe text-slate-100">
      <div className="sb-auth-grid pointer-events-none absolute inset-0 opacity-80" />
      <div className="sb-auth-aurora pointer-events-none absolute -top-24 left-1/2 h-[440px] w-[440px] -translate-x-1/2 rounded-full" />

      {/* White-night sparks drifting upward */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {AUTH_PARTICLES.map((p) => (
          <span
            key={p.id}
            className="sb-particle"
            style={{
              left: `${p.left}%`,
              bottom: `${p.bottom}%`,
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              background: p.color
            }}
          />
        ))}
      </div>

      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1040px] flex-col justify-between py-6 sm:py-10 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
        {/* Brand / welcome composition */}
        <section className="mx-auto w-full max-w-[520px] pt-5 text-center lg:mx-0 lg:pt-0 lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="mb-6 flex items-center justify-center gap-3 lg:justify-start"
          >
            <BrandMark />
            <div className="text-left">
              <p className="sb-brand-wordmark text-[29px] font-extrabold leading-none text-white sm:text-[34px]">
                SportBuddy<span className="text-emerald-400">78</span>
              </p>
              <p className="mt-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <Landmark className="h-3 w-3 text-emerald-400" /> Санкт-Петербург
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.65, ease: 'easeOut' }}
          >
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
              <Dumbbell className="h-3 w-3" /> ТВОЙ ГОРОД · ТВОЙ ТЕМП
            </p>
            <h1 className="sb-brand-wordmark text-[31px] font-bold leading-[1.16] text-white sm:text-[40px] lg:text-[46px]">
              Культ спорта
              <span className="sb-auth-greeting mt-1 block bg-gradient-to-r from-emerald-300 via-emerald-400 to-sky-300 bg-clip-text text-transparent">
                и здоровых отношений
              </span>
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.65 }}
              className="mx-auto mt-4 max-w-[380px] text-sm leading-relaxed text-slate-400 lg:mx-0"
            >
              Находите людей своего темпа, встречайтесь на тренировках и открывайте город через движение.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.55 }}
            className="mx-auto mt-6 flex max-w-[420px] items-center justify-center gap-2 text-[11px] text-slate-400 lg:mx-0 lg:justify-start"
          >
            <span className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-1.5">
              <MapPin className="h-3 w-3 text-emerald-400" /> Крестовский
            </span>
            <MoveRight className="h-3 w-3 text-emerald-400/60" />
            <span className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-1.5">
              <MapPin className="h-3 w-3 text-sky-400" /> Новая Голландия
            </span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.65, ease: 'easeOut' }}
            className="mt-6 overflow-hidden rounded-[28px] border border-emerald-400/20 bg-slate-950 shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
          >
            <img
              src="/sportbuddy78-hero.png.png"
              alt="SportBuddy78 — найди своих, двигайся вместе"
              className="block aspect-video w-full object-cover"
              draggable={false}
            />
          </motion.div>
        </section>

        {/* Authentication panel */}
        <motion.section
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 180, damping: 22 }}
          className="sb-auth-card mx-auto mt-8 w-full max-w-[410px] rounded-[30px] border border-slate-700/70 p-5 backdrop-blur-xl sm:p-6 lg:mt-0 lg:mx-0"
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Вход в сообщество</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">Встречаемся в городе</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Войди, чтобы найти напарников и тренировки рядом.</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/10 text-sm">78</span>
          </div>

          <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] px-3.5 py-2.5">
            <p className="text-[11px] font-bold leading-relaxed text-amber-200">{isBetaActive() ? 'Premium бесплатно всем до 31 декабря 2026' : `${TRIAL_DAYS} дней Premium в подарок новым участникам`}</p>
          </div>

          {error && (
            <p className="mb-3 flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}
          {notice && (
            <p className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/[0.08] p-3 text-xs leading-relaxed text-amber-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> {notice}
            </p>
          )}

          {/* Виджет VK ID OAuthList «3 в 1»: VK ID + Mail.ru + OK */}
          <div className="relative">
            <div ref={oAuthContainerRef} className="w-full" />
            {vkBusy && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-950/70 backdrop-blur-sm">
                <span className="text-xs font-bold text-slate-200">Открываем VK ID…</span>
              </div>
            )}
          </div>

          {biometricAvailable && (
            <button
              onClick={handleBiometric}
              className="mt-2.5 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-emerald-400/45 bg-emerald-400/[0.07] py-3.5 text-sm font-bold text-emerald-300 transition active:scale-[0.98]"
            >
              <Fingerprint className="h-5 w-5" /> Войти по отпечатку
            </button>
          )}

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-800" />
            <span className="text-[10px] font-bold text-slate-600">или</span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          <button
            onClick={() => { triggerHapticImpact('light'); setShowEmail(!showEmail); setError(''); }}
            className="flex w-full items-center justify-center gap-1.5 py-1 text-[11px] font-bold text-slate-500 transition hover:text-slate-300"
          >
            {isRegister ? 'Регистрация по e-mail' : 'Войти по e-mail'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showEmail ? 'rotate-180' : ''}`} />
          </button>

          {showEmail && (
            <form onSubmit={handleEmailSubmit} className="mt-4 space-y-2.5 border-t border-slate-800 pt-4">
              {isRegister && (
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя и фамилия" autoComplete="name" className="w-full rounded-2xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none" />
                </div>
              )}
              {isRegister && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-slate-400">
                    Я — <span className="text-slate-200">это важно для подбора напарников</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegGender('male')}
                      className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold transition active:scale-[0.97] ${
                        regGender === 'male'
                          ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      🙋‍♂️ Мужчина
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegGender('female')}
                      className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold transition active:scale-[0.97] ${
                        regGender === 'female'
                          ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      🙋‍♀️ Женщина
                    </button>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
                    <Lock className="h-3 w-3" /> Пол нельзя изменить после регистрации
                  </p>
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" autoComplete="email" className="w-full rounded-2xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" autoComplete={isRegister ? 'new-password' : 'current-password'} className="w-full rounded-2xl border border-slate-800 bg-slate-950 pl-10 pr-11 py-3 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500" aria-label="Показать пароль">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button type="submit" disabled={emailBusy} className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-black text-slate-950 transition active:scale-[0.98] disabled:opacity-60">
                {emailBusy ? 'Подождите…' : isRegister ? 'Создать аккаунт' : 'Войти'}
              </button>
              {!isRegister && (
                <button
                  type="button"
                  disabled={emailBusy}
                  onClick={handlePasswordRecovery}
                  className="w-full py-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 disabled:text-slate-600"
                >
                  Забыли пароль? Восстановить по e-mail
                </button>
              )}
              <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); setRecoverySent(false); }} className="w-full py-1 text-[11px] font-bold text-slate-500 hover:text-slate-300">
                {isRegister ? 'У меня уже есть аккаунт' : 'Зарегистрироваться по e-mail'}
              </button>
              {recoverySent && (
                <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-center text-[11px] font-bold text-emerald-300">
                  Если аккаунт существует, письмо для восстановления уже отправлено.
                </p>
              )}
            </form>
          )}

          <p className="mt-5 text-center text-[10px] leading-relaxed text-slate-600">
            Входя в приложение, вы соглашаетесь с условиями SportBuddy78
            и политикой конфиденциальности.
          </p>
        </motion.section>
      </main>
    </div>
  );
}

export default AuthScreen;
