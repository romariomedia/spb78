import React from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  accentColor?: 'emerald' | 'amber' | 'sky' | 'purple' | 'rose';
  onClick?: () => void;
  highlight?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  subValue,
  accentColor = 'emerald',
  onClick,
  highlight = false
}) => {
  const colorMap = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:border-emerald-500/50',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20 group-hover:border-amber-500/50',
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20 group-hover:border-sky-500/50',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20 group-hover:border-purple-500/50',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20 group-hover:border-rose-500/50'
  };

  const badgeColorMap = {
    emerald: 'bg-emerald-500/20 text-emerald-300',
    amber: 'bg-amber-500/20 text-amber-300',
    sky: 'bg-sky-500/20 text-sky-300',
    purple: 'bg-purple-500/20 text-purple-300',
    rose: 'bg-rose-500/20 text-rose-300'
  };

  return (
    <motion.div
      whileHover={onClick ? { y: -3 } : undefined}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      onClick={onClick}
      className={`relative p-4 rounded-2xl border transition-all duration-200 group ${
        onClick ? 'cursor-pointer' : ''
      } ${
        highlight 
          ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-emerald-500/40 shadow-[0_4px_20px_rgba(16,185,129,0.15)]' 
          : 'bg-slate-900/90 border-slate-800/80 hover:bg-slate-800/60'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl border ${colorMap[accentColor]} transition-colors`}>
          {icon}
        </div>
        {subValue && (
          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${badgeColorMap[accentColor]}`}>
            {subValue}
          </span>
        )}
      </div>

      <div>
        <h4 className="text-2xl font-black text-slate-100 tracking-tight flex items-baseline gap-1">
          {value}
        </h4>
        <p className="text-xs text-slate-400 mt-1 font-medium group-hover:text-slate-300 transition-colors">
          {label}
        </p>
      </div>

      {highlight && (
        <span className="absolute top-2 right-2 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      )}
    </motion.div>
  );
};
