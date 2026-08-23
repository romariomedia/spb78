import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Mail, KeyRound, RefreshCw, AlertTriangle, LockKeyhole, Lock } from 'lucide-react';
import { Modal } from './Modal';
import { getAdminEmail } from '../services/events';
import { requestAdminOtp, verifyAdminOtp } from '../services/adminAuth';
import { triggerHapticNotification } from '../services/native';

interface AdminAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export const AdminAccessModal: React.FC<AdminAccessModalProps> = ({
  isOpen, onClose, onVerified
}) => {
  const [email, setEmail] = useState(getAdminEmail());
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [requested, setRequested] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEmail(getAdminEmail());
    setPassword('');
    setCode('');
    setError('');
    setRequested(false);
    setCooldown(0);
  }, [isOpen]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendCode = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Введите e-mail и пароль администратора');
      return;
    }
    setSending(true);
    try {
      const result = await requestAdminOtp(email.trim(), password);
      setRequested(true);
      setCooldown(result.retryAfterSeconds || 60);
      triggerHapticNotification('success');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (!/^\d{4}$/.test(code)) {
      setError('Введите 4 цифры из письма');
      return;
    }
    setError('');
    setVerifying(true);
    try {
      await verifyAdminOtp(email.trim(), code);
      triggerHapticNotification('success');
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Подтверждение администратора"
      subtitle="Двухэтапная защита доступа"
      footer={
        requested ? (
          <button
            onClick={verify}
            disabled={verifying || code.length !== 4}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 py-3.5 text-sm font-black text-slate-950 shadow-[0_0_20px_rgba(251,191,36,0.38)] disabled:opacity-50"
          >
            {verifying ? 'Проверяем код…' : 'Открыть кабинет администратора'}
          </button>
        ) : (
          <button
            onClick={sendCode}
            disabled={sending}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 py-3.5 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            {sending ? 'Отправляем код…' : 'Получить код на почту'}
          </button>
        )
      }
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border-2 border-amber-400/50 bg-amber-400/10 text-amber-400 shadow-[0_0_26px_rgba(251,191,36,0.16)]">
          <ShieldCheck className="h-8 w-8" />
        </div>

        {!requested ? (
          <>
            <div>
              <h3 className="text-base font-black text-white">Код для каждого нового входа</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Подтвердите e-mail и пароль администратора — на почту придёт одноразовый 4-значный код.
              </p>
            </div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="E-mail администратора"
                autoComplete="username"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-3 pl-11 pr-4 text-xs font-bold text-slate-100 placeholder:text-slate-600 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Пароль администратора"
                autoComplete="current-password"
                onKeyDown={(event) => { if (event.key === 'Enter') void sendCode(); }}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-3 pl-11 pr-4 text-xs font-bold text-slate-100 placeholder:text-slate-600 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="text-base font-black text-white">Введите код из письма</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Код действителен 10 минут и может быть использован только один раз.
              </p>
            </div>

            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-400" />
              <input
                ref={inputRef}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(event) => { if (event.key === 'Enter') void verify(); }}
                placeholder="0000"
                className="w-full rounded-2xl border border-amber-400/45 bg-slate-950 py-4 pl-12 pr-4 text-center font-mono text-2xl font-black tracking-[0.45em] text-amber-300 placeholder:tracking-[0.25em] placeholder:text-slate-700 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <button
              onClick={sendCode}
              disabled={sending || cooldown > 0}
              className="flex w-full items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400 transition hover:text-emerald-300 disabled:text-slate-600"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sending ? 'animate-spin' : ''}`} />
              {cooldown > 0 ? `Повторный код через ${cooldown} с` : 'Отправить код повторно'}
            </button>
          </>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-left text-[11px] font-bold text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <p className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
          <LockKeyhole className="h-3 w-3" /> Сессия администратора действует 8 часов
        </p>
      </div>
    </Modal>
  );
};