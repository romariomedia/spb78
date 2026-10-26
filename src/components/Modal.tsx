import { backLayers, useBackLayer } from '../hooks/useMobileNavigation';
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { triggerHapticImpact } from '../services/native';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'admin';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md'
}) => {
  useBackLayer(isOpen, onClose);
  useEffect(() => {
    if (!isOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        backLayers.closeTop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isAdminLayout = maxWidth === 'admin';
  const maxWClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    admin: 'max-w-none'
  }[maxWidth];

  const handleClose = () => {
    triggerHapticImpact('light');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 flex items-center justify-center overflow-y-auto ${isAdminLayout ? 'z-[100] p-0 sm:p-2 lg:p-3' : 'z-50 p-2 sm:p-4 lg:p-6'}`}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          {/* Dialog content */}
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            className={`relative w-full ${maxWClasses} bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden z-10 flex flex-col ${isAdminLayout ? 'h-[100dvh] max-h-[100dvh] rounded-none sm:h-[calc(100dvh-16px)] sm:max-h-[calc(100dvh-16px)] sm:rounded-3xl lg:h-[calc(100dvh-24px)] lg:max-h-[calc(100dvh-24px)] lg:rounded-2xl' : 'rounded-3xl max-h-[94dvh]'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between border-b border-slate-800/80 bg-slate-900/50 ${isAdminLayout ? 'p-4 sm:px-5 lg:px-6 lg:py-4' : 'p-5'}`}>
              <div>
                <h3 className="text-lg font-bold text-slate-100 tracking-tight">{title}</h3>
                {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={handleClose}
                className="min-h-11 min-w-11 p-2 text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors active:scale-90"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className={`overflow-y-auto no-scrollbar flex-1 space-y-4 text-slate-200 ${isAdminLayout ? 'p-3 sm:p-4 lg:p-5 xl:p-6' : 'p-3 sm:p-5 lg:p-6'}`}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
