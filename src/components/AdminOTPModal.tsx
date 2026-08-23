import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, CheckCircle2, AlertCircle, Clock, LogOut } from 'lucide-react';
import { sendAdminOTP, verifyAdminOTP, isAdminSessionValid, getAdminSessionTimeRemaining, logoutAdmin } from '../services/adminAuth';
import { triggerHapticNotification, triggerHapticImpact } from '../services/native';
import { Modal } from './Modal';

interface AdminOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminOTPModal: React.FC<AdminOTPModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'request' | 'verify' | 'active'>('request');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [otpSentTime, setOtpSentTime] = useState<Date | null>(null);

  // Проверяем, активна ли уже сессия при открытии модалки
  useEffect(() => {
    if (isOpen && isAdminSessionValid()) {
      setStep('active');
      const remaining = getAdminSessionTimeRemaining();
      setTimeRemaining(remaining);
    } else if (isOpen) {
      setStep('request');
    }
  }, [isOpen]);

  // Обновляем оставшееся время каждую минуту
  useEffect(() => {
    if (step !== 'active') return;

    const interval = setInterval(() => {
      const remaining = getAdminSessionTimeRemaining();
      if (remaining <= 0) {
        setStep('request');
        setOtp('');
      } else {
        setTimeRemaining(remaining);
      }
    }, 30000); // каждые 30 секунд

    return () => clearInterval(interval);
  }, [step]);

  const handleRequestOTP = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    triggerHapticImpact('medium');

    const result = await sendAdminOTP();
    if (result.success) {
      setOtpSentTime(new Date());
      setStep('verify');
      setMessage(result.message);
      triggerHapticNotification('success');
    } else {
      setError(result.message);
      triggerHapticNotification('warning');
    }

    setBusy(false);
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }

    setBusy(true);
    setError('');
    triggerHapticImpact('medium');

    const result = await verifyAdminOTP(otp);
    if (result.success) {
      setStep('active');
      const remaining = getAdminSessionTimeRemaining();
      setTimeRemaining(remaining);
      triggerHapticNotification('success');
      setMessage('Авторизация успешна!');
      onSuccess();
    } else {
      setError(result.message);
      triggerHapticNotification('warning');
    }

    setBusy(false);
  };

  const handleLogout = () => {
    logoutAdmin();
    setStep('request');
    setOtp('');
    setError('');
    setMessage('Вы вышли из кабинета');
    triggerHapticNotification('success');
  };

  const handleResendOTP = () => {
    setStep('request');
    setOtp('');
    setOtpSentTime(null);
  };

  const canResendOTP = otpSentTime
    ? (Date.now() - otpSentTime.getTime()) > 60000 // можно переотправить через 60 сек
    : false;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🔐 Кабинет администратора"
      subtitle={
        step === 'active'
          ? `Сессия активна (осталось ${timeRemaining} мин)`
          : 'Одноразовая авторизация по коду'
      }
    >
      <div className="space-y-4">
        {/* Шаг 1: Запрос кода */}
        {step === 'request' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <p className="text-xs text-slate-300 flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                Код будет отправлен на почту:
              </p>
              <p className="text-sm font-bold text-white mt-1">support@sportbuddy78.ru</p>
            </div>

            <button
              onClick={handleRequestOTP}
              disabled={busy}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-sm transition shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              {busy ? 'Отправка...' : '📧 Отправить код'}
            </button>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </motion.div>
        )}

        {/* Шаг 2: Ввод кода */}
        {step === 'verify' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
              <p className="text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Код отправлен!
              </p>
              <p className="text-[11px] text-emerald-400/80 mt-1">
                Действителен {Math.max(1, Math.ceil(OTP_VALIDITY_MINUTES))} минут
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                Введите 6-значный код
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setOtp(val);
                  setError('');
                }}
                placeholder="000000"
                className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-800 rounded-2xl text-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono tracking-widest text-center"
                autoFocus
              />
            </div>

            <button
              onClick={handleVerifyOTP}
              disabled={busy || otp.length !== 6}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-sm transition"
            >
              {busy ? 'Проверка...' : '✓ Подтвердить'}
            </button>

            <button
              onClick={handleResendOTP}
              disabled={!canResendOTP}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-bold rounded-xl text-xs transition"
            >
              {canResendOTP ? 'Отправить новый код' : 'Подождите...'}
            </button>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </motion.div>
        )}

        {/* Шаг 3: Активная сессия */}
        {step === 'active' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="p-4 bg-emerald-500/15 border border-emerald-500/50 rounded-2xl">
              <p className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Вы авторизованы
              </p>
              <p className="text-xs text-emerald-400/80 mt-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Оставшееся время: <span className="font-bold">{timeRemaining} мин</span>
              </p>
            </div>

            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">📋 Доступные функции:</p>
              <ul className="space-y-1.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  Управление мероприятиями
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  Модерация контента
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  Просмотр аналитики
                </li>
              </ul>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-3 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 font-black rounded-2xl text-sm transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Выйти из кабинета
            </button>

            {message && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-300">
                {message}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </Modal>
  );
};

// Константа для валидности OTP
const OTP_VALIDITY_MINUTES = 15;
