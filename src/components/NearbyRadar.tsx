import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Radar, Crown, BadgeCheck, MapPin, RefreshCw, Lock, Wifi, Clock
} from 'lucide-react';
import { UserProfile, PresenceStatus, NEARBY_RADIUS_KM } from '../lib/types';
import { Coords } from '../services/geolocation';
import { findNearbyAthletes, countByPresence } from '../services/presence';
import { getVerificationState } from '../services/verification';
import { triggerHapticImpact } from '../services/native';

type PresenceFilter = 'all' | 'online' | 'recent';

interface NearbyRadarProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  myCoords: Coords;
  locationLabel: string;
  onSelectUser: (user: UserProfile) => void;
  onRefreshLocation: () => void;
  onFixVerification: () => void;
  isLocating?: boolean;
}

export const NearbyRadar: React.FC<NearbyRadarProps> = ({
  currentUser, allUsers, myCoords, locationLabel,
  onSelectUser, onRefreshLocation, onFixVerification, isLocating = false
}) => {
  const [radius, setRadius] = useState(NEARBY_RADIUS_KM);
  const [filter, setFilter] = useState<PresenceFilter>('all');

  const verification = getVerificationState(currentUser);
  const nearby = useMemo(
    () => findNearbyAthletes(allUsers, myCoords, currentUser.id, radius),
    [allUsers, myCoords, currentUser.id, radius]
  );
  const counts = countByPresence(nearby);

  const visible = filter === 'all'
    ? nearby
    : nearby.filter((n) => n.presence === filter);

  /* --------------------- verification gate --------------------- */
  if (!verification.isVerified) {
    return (
      <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-5 text-center space-y-3 shadow-xl">
        <div className="w-14 h-14 rounded-3xl bg-amber-500/15 border border-amber-500/50 mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6 text-amber-400" />
        </div>
        <h3 className="text-sm font-extrabold text-white">Поиск рядом доступен после верификации</h3>
        <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
          Чтобы видеть спортсменов в радиусе {NEARBY_RADIUS_KM} км, подтвердите личное фото,
          опубликуйте снимок в портфолио и разрешите геолокацию.
        </p>
        <p className="text-[11px] font-bold text-amber-300">
          Пройдено {verification.completedCount} из {verification.steps.length}
        </p>
        <button
          onClick={onFixVerification}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-2xl text-xs transition active:scale-95"
        >
          Завершить верификацию →
        </button>
      </div>
    );
  }

  const presenceDot: Record<PresenceStatus, string> = {
    online: 'bg-emerald-400',
    recent: 'bg-amber-400',
    offline: 'bg-slate-600'
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3.5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/50 flex items-center justify-center shrink-0">
            <Radar className={`w-5 h-5 text-emerald-400 ${isLocating ? 'animate-spin' : ''}`} />
            <span className="absolute inset-0 rounded-2xl border-2 border-emerald-400/40 animate-ping" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-white">Спортсмены рядом</h3>
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-400 shrink-0" /> {locationLabel}
            </p>
          </div>
        </div>
        <button
          onClick={() => { triggerHapticImpact('light'); onRefreshLocation(); }}
          className="p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl active:scale-90 transition shrink-0"
          aria-label="Обновить геолокацию"
        >
          <RefreshCw className={`w-4 h-4 ${isLocating ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Presence summary */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: 'all' as PresenceFilter, v: nearby.length, l: 'всего', c: 'text-white', i: '📡' },
          { id: 'online' as PresenceFilter, v: counts.online, l: 'в сети', c: 'text-emerald-400', i: '🟢' },
          { id: 'recent' as PresenceFilter, v: counts.recent, l: 'были рядом', c: 'text-amber-400', i: '🕐' }
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => { triggerHapticImpact('light'); setFilter(s.id); }}
            className={`rounded-xl p-2 text-center border transition ${
              filter === s.id
                ? 'bg-emerald-500/15 border-emerald-500/60'
                : 'bg-slate-950 border-slate-800'
            }`}
          >
            <span className="text-sm block leading-none">{s.i}</span>
            <span className={`block text-sm font-black mt-1 ${s.c}`}>{s.v}</span>
            <span className="text-[9px] text-slate-500">{s.l}</span>
          </button>
        ))}
      </div>

      {/* Radius slider */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-300">Радиус поиска</span>
          <span className="text-xs font-black text-emerald-400">{radius} км</span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>1 км</span>
          <span className="text-emerald-400">рекомендуем {NEARBY_RADIUS_KM} км</span>
          <span>20 км</span>
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-1.5">
          <Radar className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs font-bold text-slate-300">Рядом никого не найдено</p>
          <p className="text-[11px] text-slate-500">
            Увеличьте радиус поиска или обновите геолокацию
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
          {visible.map(({ user, distanceKm, presence, lastSeenLabel }) => (
            <motion.button
              key={user.id}
              layout
              onClick={() => { triggerHapticImpact('light'); onSelectUser(user); }}
              className={`w-full text-left rounded-2xl p-3 flex items-center gap-3 border transition active:scale-[0.99] ${
                presence === 'online'
                  ? 'bg-emerald-500/[0.07] border-emerald-500/40'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src={user.avatar}
                  alt={user.name}
                  loading="lazy"
                  className={`w-12 h-12 rounded-full object-cover border-2 ${
                    presence === 'online' ? 'border-emerald-500' : 'border-slate-700'
                  } ${presence === 'offline' ? 'grayscale-[0.6] opacity-80' : ''}`}
                />
                <span
                  className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${presenceDot[presence]}`}
                />
                {presence === 'online' && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-extrabold text-white truncate flex items-center gap-1">
                  {user.name}, {user.age}
                  {user.isVerified && <BadgeCheck className="w-3 h-3 text-emerald-400 shrink-0" />}
                  {user.subscriptionPlan === 'premium' && (
                    <Crown className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                  )}
                </h4>
                <p className={`text-[10px] truncate flex items-center gap-1 ${
                  presence === 'online' ? 'text-emerald-400 font-bold' : 'text-slate-500'
                }`}>
                  {presence === 'online'
                    ? <><Wifi className="w-2.5 h-2.5 shrink-0" /> В сети сейчас</>
                    : <><Clock className="w-2.5 h-2.5 shrink-0" /> {lastSeenLabel}</>}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user.sports.slice(0, 3).join(' • ')}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="block text-sm font-black text-emerald-400 leading-none">
                  {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} м` : `${distanceKm} км`}
                </span>
                <span className="text-[9px] text-slate-500">от вас</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-600 text-center leading-relaxed">
        Показаны верифицированные устройства, хотя бы раз использовавшие геолокацию.
        Точные координаты других пользователей не раскрываются.
      </p>
    </div>
  );
};
