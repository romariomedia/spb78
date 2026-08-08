import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { triggerHapticImpact } from '../services/native';

interface CollapsibleCardProps {
  /** Stable key used to remember the open/closed state between sessions */
  storageKey: string;
  icon: React.ReactNode;
  title: string;
  /** Shown under the title when expanded */
  subtitle: string;
  /** Shown under the title when collapsed (usually a compact summary) */
  collapsedSummary?: string;
  /** Small pill on the right of the header (e.g. counter) */
  badge?: React.ReactNode;
  /** Action rendered next to the chevron (e.g. admin button) */
  action?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  storageKey, icon, title, subtitle, collapsedSummary,
  badge, action, defaultOpen = true, className = '', children
}) => {
  const [open, setOpenState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === null ? defaultOpen : saved === '1';
    } catch {
      return defaultOpen;
    }
  });

  const toggle = () => {
    triggerHapticImpact('light');
    const next = !open;
    setOpenState(next);
    try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* ignore */ }
  };

  return (
    <div className={`rounded-3xl shadow-xl transition-all ${open ? 'p-4' : 'p-2.5'} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={toggle}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left active:scale-[0.98] transition"
        >
          <div className={`shrink-0 transition-all ${open ? 'scale-100' : 'scale-90'}`}>
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-extrabold text-white truncate">{title}</h3>
            <p className="text-[11px] text-slate-400 truncate">
              {open ? subtitle : (collapsedSummary ?? subtitle)}
            </p>
          </div>

          {badge && <span className="shrink-0">{badge}</span>}

          <motion.span animate={{ rotate: open ? 180 : 0 }} className="shrink-0 text-slate-500">
            <ChevronDown className="w-4 h-4" />
          </motion.span>
        </button>

        {action && <span className="shrink-0">{action}</span>}
      </div>

      {/* Body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="pt-3.5 space-y-3.5">
              {children}
              <button
                onClick={toggle}
                className="w-full py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition active:scale-[0.98] flex items-center justify-center gap-1"
              >
                <ChevronDown className="w-3 h-3 rotate-180" /> Свернуть
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
