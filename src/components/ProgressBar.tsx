import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  percentage: number; // 0 to 100
  label?: string;
  subLabel?: string;
  color?: 'emerald' | 'amber' | 'sky' | 'rose';
  height?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  label,
  subLabel,
  color = 'emerald',
  height = 'md',
  showPercentage = false
}) => {
  const safePercent = Math.min(100, Math.max(0, Math.round(percentage)));

  const bgMap = {
    emerald: 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]',
    amber: 'bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]',
    sky: 'bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.5)]',
    rose: 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]'
  };

  const heightMap = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5'
  };

  return (
    <div className="w-full">
      {(label || subLabel || showPercentage) && (
        <div className="flex justify-between items-center mb-1.5 text-xs font-semibold">
          <span className="text-slate-200 flex items-center gap-1.5">
            {label}
            {showPercentage && <span className="text-emerald-400 font-bold">({safePercent}%)</span>}
          </span>
          {subLabel && <span className="text-slate-400 text-[11px] font-medium">{subLabel}</span>}
        </div>
      )}

      <div className={`w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/60 ${heightMap[height]}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safePercent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${bgMap[color]}`}
        />
      </div>
    </div>
  );
};
