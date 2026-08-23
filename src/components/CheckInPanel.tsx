import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, CheckCircle2, AlertCircle, MessageCircle, Radar } from 'lucide-react';
import { Training, UserProfile, ARRIVAL_NOTES, CHECKIN_RADIUS_METERS } from '../lib/types';
import {
  checkInToTraining, getCheckInsFor, getMyCheckIn, formatDistance
} from '../services/checkin';
import { triggerHapticImpact } from '../services/native';

interface CheckInPanelProps {
  training: Training;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  isOrganizer: boolean;
  onCheckedIn: (training: Training) => void;
  onMessageParticipant: (user: UserProfile) => void;
}

export const CheckInPanel: React.FC<CheckInPanelProps> = ({
  training, currentUser, allUsers, isOrganizer, onCheckedIn, onMessageParticipant
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string>(ARRIVAL_NOTES[0]);
  const [showNotes, setShowNotes] = useState(false);

  const checkIns = getCheckInsFor(training.id);
  const myCheckIn = getMyCheckIn(training.id, currentUser.id);
  const canCheckIn = training.participantIds.includes(currentUser.id) || isOrganizer;

  const handleCheckIn = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await checkInToTraining(training, currentUser, note);
      if (!result.ok || !result.training) {
        setError(result.error || 'Не удалось отметиться');
        return;
      }
      onCheckedIn(result.training);
      setShowNotes(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-xs font-black text-white flex items-center gap-1.5">
          <Radar className="w-4 h-4 text-emerald-400" /> Отметки о прибытии
        </h5>
        <span className="text-[10px] font-black bg-slate-900 text-emerald-400 px-2 py-1 rounded-lg border border-slate-700 shrink-0">
          {checkIns.length} / {training.participantIds.length}
        </span>
      </div>

      {/* Participant check-in action */}
      {canCheckIn && !training.isCompleted && (
        myCheckIn ? (
          <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-3 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-black text-emerald-300">
                Вы отметились в {myCheckIn.arrivedAt}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {formatDistance(myCheckIn.distanceMeters)} от точки сбора
                {myCheckIn.note ? ` • ${myCheckIn.note}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {showNotes && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-[10px] font-bold text-slate-400 mb-1.5">Сообщение организатору:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ARRIVAL_NOTES.map((n) => (
                      <button
                        key={n}
                        onClick={() => { triggerHapticImpact('light'); setNote(n); }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition ${
                          note === n
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => {
                if (!showNotes) {
                  triggerHapticImpact('light');
                  setShowNotes(true);
                } else {
                  handleCheckIn();
                }
              }}
              disabled={busy}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow-[0_0_18px_rgba(16,185,129,0.45)] active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Navigation className={`w-4 h-4 ${busy ? 'animate-pulse' : ''}`} />
              {busy ? 'Определяем геолокацию…' : showNotes ? '📍 Отметиться о прибытии' : '📍 Я прибыл на место'}
            </button>

            <p className="text-[10px] text-slate-500 text-center">
              Нужен включённый GPS. Радиус проверки — {CHECKIN_RADIUS_METERS} м от точки сбора.
            </p>
          </div>
        )
      )}

      {error && (
        <p className="text-[11px] text-rose-300 font-semibold bg-rose-500/10 border border-rose-500/40 p-2.5 rounded-xl flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      )}

      {/* Arrived list — organizer sees contact buttons */}
      {checkIns.length === 0 ? (
        <p className="text-[10px] text-slate-500">
          {isOrganizer
            ? 'Пока никто не отметился. Уведомление придёт, как только участник прибудет.'
            : 'Никто ещё не отметился на месте.'}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-52 overflow-y-auto no-scrollbar">
          {checkIns.map((c) => {
            const participant = allUsers.find((u) => u.id === c.userId);
            return (
              <div
                key={c.id}
                className="bg-slate-900 border border-emerald-500/30 rounded-xl p-2.5 flex items-center gap-2.5"
              >
                <div className="relative shrink-0">
                  <img
                    src={c.userAvatar}
                    alt={c.userName}
                    loading="lazy"
                    className="w-8 h-8 rounded-full object-cover border border-emerald-500"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-slate-900 rounded-full" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-extrabold text-white truncate">
                    {c.userId === currentUser.id ? 'Вы' : c.userName}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    {c.arrivedAt} • {formatDistance(c.distanceMeters)}
                  </p>
                  {c.note && (
                    <p className="text-[10px] text-emerald-400/90 truncate">«{c.note}»</p>
                  )}
                </div>

                {isOrganizer && participant && c.userId !== currentUser.id && (
                  <button
                    onClick={() => onMessageParticipant(participant)}
                    className="p-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 rounded-lg active:scale-90 transition shrink-0"
                    aria-label="Написать участнику"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
