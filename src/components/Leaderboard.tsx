import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, TrendingUp, Users as UsersIcon } from 'lucide-react';
import { UserProfile, LeaderboardMetric } from '../lib/types';
import { MEDAL_TIERS } from '../lib/medals';
import {
  LEADERBOARD_METRICS, buildLeaderboard, getRankBadge, getCommunityStats
} from '../services/leaderboard';
import { triggerHapticImpact } from '../services/native';
import { CollapsibleCard } from './CollapsibleCard';

interface LeaderboardProps {
  allUsers: UserProfile[];
  currentUserId: string;
  onSelectUser: (user: UserProfile) => void;
}

const LeaderboardInner: React.FC<LeaderboardProps> = ({
  allUsers, currentUserId, onSelectUser
}) => {
  const [metric, setMetric] = useState<LeaderboardMetric>('workouts');
  const [expanded, setExpanded] = useState(false);

  const entries = useMemo(() => buildLeaderboard(allUsers, metric), [allUsers, metric]);
  const stats = useMemo(() => getCommunityStats(allUsers), [allUsers]);
  const config = LEADERBOARD_METRICS.find((m) => m.id === metric)!;

  const myEntry = entries.find((e) => e.user.id === currentUserId);
  const visible = expanded ? entries : entries.slice(0, 5);
  const maxValue = Math.max(1, entries[0]?.value ?? 1);

  return (
    <CollapsibleCard
      storageKey="sportbuddy_leaderboard_open_v1"
      className="bg-slate-900 border border-slate-800"
      icon={
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.35)]">
          <Trophy className="w-5 h-5 text-slate-950" />
        </div>
      }
      title="Таблица лидеров СПб"
      subtitle={config.description}
      collapsedSummary={
        myEntry
          ? `Ваше место: ${getRankBadge(myEntry.rank)} • ${stats.athletes} атлетов`
          : `${stats.athletes} атлетов в рейтинге`
      }
      badge={
        myEntry ? (
          <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-500/40">
            {getRankBadge(myEntry.rank)}
          </span>
        ) : undefined
      }
    >
      {/* Community totals */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { icon: '👥', value: stats.athletes, label: 'атлетов' },
          { icon: '🏋️', value: stats.workouts, label: 'трен.' },
          { icon: '🥇', value: stats.medals, label: 'медалей' },
          { icon: '🎁', value: stats.boxes, label: 'боксов' }
        ].map((s) => (
          <div key={s.label} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
            <span className="text-sm block leading-none">{s.icon}</span>
            <span className="block text-xs font-black text-white mt-1">{s.value}</span>
            <span className="text-[9px] text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Metric switcher */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {LEADERBOARD_METRICS.map((m) => (
          <button
            key={m.id}
            onClick={() => { triggerHapticImpact('light'); setMetric(m.id); }}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition ${
              metric === m.id
                ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            {m.icon} {m.shortLabel}
          </button>
        ))}
      </div>

      {/* Ranking rows */}
      <div className="space-y-1.5">
        {visible.map((entry) => {
          const isTop3 = entry.rank <= 3;
          const pct = Math.round((entry.value / maxValue) * 100);

          return (
            <motion.button
              key={entry.user.id}
              layout
              onClick={() => { triggerHapticImpact('light'); onSelectUser(entry.user); }}
              className={`sb-hover-lift relative w-full overflow-hidden text-left p-2.5 rounded-2xl border transition active:scale-[0.99] flex items-center gap-2.5 ${
                entry.isCurrentUser
                  ? 'bg-emerald-500/10 border-emerald-500/60'
                  : isTop3
                  ? 'bg-gradient-to-r from-amber-950/30 to-slate-950 border-amber-500/30'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Progress fill */}
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 pointer-events-none ${
                  entry.isCurrentUser ? 'bg-emerald-500/10' : 'bg-slate-800/40'
                }`}
                style={{ width: `${pct}%` }}
              />

              <span className={`relative z-10 w-8 text-center font-black shrink-0 ${
                isTop3 ? 'text-base' : 'text-[11px] text-slate-500'
              }`}>
                {getRankBadge(entry.rank)}
              </span>

              <img
                src={entry.user.avatar}
                alt={entry.user.name}
                loading="lazy"
                className={`relative z-10 w-9 h-9 rounded-full object-cover border-2 shrink-0 ${
                  isTop3 ? 'border-amber-400' : 'border-slate-700'
                }`}
              />

              <div className="relative z-10 flex-1 min-w-0">
                <h4 className="text-xs font-extrabold text-white truncate flex items-center gap-1">
                  {entry.isCurrentUser ? 'Вы' : entry.user.name}
                  <span className="shrink-0" title={MEDAL_TIERS[entry.user.medalTier || 'bronze'].name}>
                    {MEDAL_TIERS[entry.user.medalTier || 'bronze'].emoji}
                  </span>
                  {entry.user.subscriptionPlan === 'premium' && (
                    <Crown className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                  )}
                </h4>
                <p className="text-[10px] text-slate-500 truncate">{entry.user.locationName}</p>
              </div>

              <div className="relative z-10 text-right shrink-0">
                <span className="sb-score block text-sm font-black text-emerald-400 leading-none">
                  {entry.value}
                </span>
                <span className="text-[9px] text-slate-500">{config.unit}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {entries.length > 5 && (
        <button
          onClick={() => { triggerHapticImpact('light'); setExpanded(!expanded); }}
          className="w-full py-2.5 bg-slate-950 border border-slate-800 text-slate-300 font-bold rounded-2xl text-[11px] transition active:scale-95 flex items-center justify-center gap-1.5"
        >
          {expanded ? (
            <>Свернуть рейтинг</>
          ) : (
            <>
              <UsersIcon className="w-3.5 h-3.5" /> Показать всех ({entries.length})
            </>
          )}
        </button>
      )}

      {myEntry && myEntry.rank > 3 && (
        <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          До топ-3 осталось {Math.max(0, (entries[2]?.value ?? 0) - myEntry.value + 1)} {config.unit}
        </p>
      )}
    </CollapsibleCard>
  );
};

/** Memoised: the leaderboard only re-renders when the athlete list changes */
export const Leaderboard = React.memo(
  LeaderboardInner,
  (prev, next) =>
    prev.allUsers === next.allUsers && prev.currentUserId === next.currentUserId
);
