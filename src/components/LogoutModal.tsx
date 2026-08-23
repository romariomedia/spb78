import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, AlertCircle } from 'lucide-react';
import { triggerHapticNotification, triggerHapticImpact } from '../services/native';
import { Modal } from './Modal';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName?: string;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({ isOpen, onClose, onConfirm, userName = 'Спортсмен' }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    triggerHapticImpact('medium');
    
    // Небольшая задержка для UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    triggerHapticNotification('success');
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🚪 Выход из аккаунта"
      subtitle={`Вы: ${userName}`}
    >
      <div className="space-y-4">
        {/* Warning */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <p className="text-xs font-bold text-amber-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>После выхода вам нужно будет войти снова. Ваши данные сохранены на сервере.</span>
          </p>
        </div>

        {/* Info */}
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">СТАТУС АККАУНТА</span>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Активен
            </span>
          </div>
          
          <div className="space-y-2 text-[11px] text-slate-400">
            <p>✓ Ваши тренировки в безопасности</p>
            <p>✓ Рейтинг и достижения сохранены</p>
            <p>✓ Друзья остаются в списке</p>
            <p>✓ История видна после входа</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={isLoggingOut}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold rounded-2xl text-sm transition"
          >
            Отмена
          </button>
          
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex-1 px-4 py-3 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 disabled:opacity-50 text-rose-400 font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            {isLoggingOut ? 'Выход...' : '🚪 Выйти'}
          </button>
        </div>

        {/* Loading indicator */}
        <AnimatePresence>
          {isLoggingOut && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl text-center"
            >
              <p className="text-xs font-bold text-slate-400">Выход из системы...</p>
              <div className="flex justify-center gap-1 mt-2">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
};
