import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, Calendar, MapPin, Trophy, Users as UsersIcon, Ticket, Shield } from 'lucide-react';
import { OfficialEvent, UserProfile } from '../lib/types';
import { getEvents, refreshEvents, getCategoryConfig, eventFillPercent, isRegistered } from '../services/events';
import { triggerHapticImpact } from '../services/native';
import { CollapsibleCard } from './CollapsibleCard';

interface OfficialEventsProps {
  currentUser: UserProfile;
  onOpenEvent: (event: OfficialEvent) => void;
  isAdminUser: boolean;
  onOpenAdmin: () => void;
  refreshKey?: number;
}

export const OfficialEvents: React.FC<OfficialEventsProps> = ({
  currentUser, onOpenEvent, isAdminUser, onOpenAdmin, refreshKey
}) => {
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [events, setEvents] = useState(() => getEvents());
  useEffect(() => { void refreshEvents().then(setEvents).catch(() => {}); }, [refreshKey]);

  const visible = filter === 'mine'
    ? events.filter((e) => isRegistered(e, currentUser.id))
    : events;

  const myCount = events.filter((e) => isRegistered(e, currentUser.id)).length;

  return (
    <div key={refreshKey}>
    <CollapsibleCard
      storageKey="sportbuddy_events_open_v1"
      className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border-2 border-emerald-500/40"
      icon={
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-[0_0_16px_rgba(16,185,129,0.4)]">
          <BadgeCheck className="w-5 h-5 text-slate-950" />
        </div>
      }
      title="Мероприятия SportBuddy"
      subtitle="Официальные события платформы в СПб"
      collapsedSummary={`${events.length} событий${myCount > 0 ? ` • вы участвуете в ${myCount}` : ''}`}
      badge={
        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-500/40">
          {events.length}
        </span>
      }
      action={
        isAdminUser ? (
          <button
            onClick={() => { triggerHapticImpact('medium'); onOpenAdmin(); }}
            className="px-3 py-2 bg-amber-500 text-slate-950 font-black rounded-xl text-[10px] transition active:scale-95 flex items-center gap-1"
          >
            <Shield className="w-3.5 h-3.5" /> Админ
          </button>
        ) : undefined
      }
    >
      {/* Filter */}
      <div className="flex gap-1.5">
        {([
          { id: 'all' as const, label: 'Все события', count: events.length },
          { id: 'mine' as const, label: 'Я участвую', count: events.filter(e => isRegistered(e, currentUser.id)).length }
        ]).map((f) => (
          <button
            key={f.id}
            onClick={() => { triggerHapticImpact('light'); setFilter(f.id); }}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 ${
              filter === f.id
                ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            {f.label}
            <span className={`text-[9px] px-1.5 rounded ${filter === f.id ? 'bg-slate-950/20' : 'bg-slate-800'}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Event cards */}
      {visible.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-1.5">
          <Trophy className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs font-bold text-slate-300">
            {filter === 'mine' ? 'Вы пока не записаны на события' : 'Скоро появятся новые мероприятия'}
          </p>
          <p className="text-[11px] text-slate-500">
            Официальные соревнования и конкурсы от команды SportBuddy
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((event) => {
            const cfg = getCategoryConfig(event.category);
            const fill = eventFillPercent(event);
            const registered = isRegistered(event, currentUser.id);
            const isFull = event.participantIds.length >= event.participantsMax;

            return (
              <motion.button
                key={event.id}
                layout
                onClick={() => { triggerHapticImpact('light'); onOpenEvent(event); }}
                className="w-full text-left bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-2xl overflow-hidden transition active:scale-[0.99] shadow-lg"
              >
                {/* Cover */}
                {event.coverUrl && (
                  <div className="relative h-28 overflow-hidden bg-slate-900">
                    <img
                      src={event.coverUrl}
                      alt={event.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                    <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 px-2 py-1 rounded-lg flex items-center gap-1 shadow">
                      <BadgeCheck className="w-3 h-3" /> Официально
                    </span>
                    {registered && (
                      <span className="absolute top-2 right-2 text-[9px] font-black bg-slate-950/90 text-emerald-400 border border-emerald-500/60 px-2 py-1 rounded-lg">
                        ✓ Вы участвуете
                      </span>
                    )}
                    {event.videoUrl && (
                      <span className="absolute bottom-2 right-2 text-[9px] font-black bg-slate-950/80 text-white px-2 py-1 rounded-lg border border-slate-700">
                        ▶ Видео-анонс
                      </span>
                    )}
                  </div>
                )}

                <div className="p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {cfg.icon} {cfg.label}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{event.sport}</span>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-white leading-snug">{event.title}</h4>
                    <p className="text-[11px] text-emerald-400/90 mt-0.5">{event.tagline}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-300">
                    <span className="flex items-center gap-1 bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800 truncate">
                      <Calendar className="w-3 h-3 text-emerald-400 shrink-0" />
                      {event.dateLabel}
                    </span>
                    <span className="flex items-center gap-1 bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800 truncate">
                      <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                      {event.locationName}
                    </span>
                  </div>

                  {event.prizePool && (
                    <p className="text-[10px] text-amber-300 font-bold flex items-center gap-1">
                      <Trophy className="w-3 h-3 shrink-0" /> {event.prizePool}
                    </p>
                  )}

                  {/* Capacity */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-400 flex items-center gap-1">
                        <UsersIcon className="w-3 h-3" />
                        {event.participantIds.length} / {event.participantsMax}
                      </span>
                      <span className={isFull ? 'text-rose-400' : 'text-emerald-400'}>
                        {isFull ? 'Мест нет' : `Свободно ${event.participantsMax - event.participantIds.length}`}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full ${fill > 85 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${fill}%` }}
                      />
                    </div>
                  </div>

                  {event.entryFee && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Ticket className="w-3 h-3 shrink-0" /> Участие: {event.entryFee}
                    </p>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </CollapsibleCard>
    </div>
  );
};
