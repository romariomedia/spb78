import { trainingGenderError, trainingGenderLabel } from '../lib/trainingEligibility';
import React from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { Training, UserProfile } from '../lib/types';
import { ProgressBar } from './ProgressBar';
import { getCheckInsFor } from '../services/checkin';
import { calculateDistanceKm, Coords } from '../services/geolocation';

interface TrainingCardProps {
  training: Training;
  creator?: UserProfile;
  currentUserId: string;
  currentUser?: UserProfile | null;
  userCoords: Coords;
  onSelect: (training: Training) => void;
  onJoin: (training: Training) => void;
}

const TrainingCardInner: React.FC<TrainingCardProps> = ({
  training: tr, creator, currentUserId, currentUser, userCoords, onSelect, onJoin
}) => {
  const isJoined = tr.participantIds.includes(currentUserId);
  const genderError = !isJoined ? trainingGenderError(tr, currentUser) : null;
  const isFull = tr.participantIds.length >= tr.participantsMax;
  const distance = calculateDistanceKm(userCoords.lat, userCoords.lng, tr.lat, tr.lng);
  const fillPerc = (tr.participantIds.length / tr.participantsMax) * 100;
  const arrivedCount = getCheckInsFor(tr.id).length;

  return (
    <div
      onClick={() => onSelect(tr)}
      onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(tr); } }}
      tabIndex={0}
      role="group"
      aria-label={`Тренировка: ${tr.title}`}
      className="sb-training-card sb-hover-lift bg-slate-900 border border-slate-800 rounded-3xl p-4 hover:border-emerald-500/50 transition cursor-pointer shadow-lg relative overflow-hidden group"
    >
      {tr.isCompleted ? (
        <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow">
          🏁 Завершена
        </div>
      ) : isJoined && (
        <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow">
          Вы записаны
        </div>
      )}

      <p className="text-xs text-slate-300 mb-2">{trainingGenderLabel(tr.participantGender)}</p>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
          {tr.sport}
        </span>
        <span className="text-xs text-slate-400 font-medium">
          • {tr.level === 'pro' ? 'Профи' : tr.level === 'semi-pro' ? 'Любители+' : 'Начинающие'}
        </span>
      </div>

      <h3 className="text-base font-black text-white leading-snug group-hover:text-emerald-400 transition">
        {tr.title}
      </h3>

      <div className="grid grid-cols-2 gap-2 my-3 text-xs text-slate-300">
        <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800/80">
          <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold truncate">{tr.dateLabel} ({tr.time})</span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800/80">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{tr.locationName} (~{distance}км)</span>
        </div>
        {arrivedCount > 0 && (
          <div className="col-span-2 flex items-center gap-1.5 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/40">
            <span className="text-sm">📍</span>
            <span className="text-emerald-300 font-bold truncate">
              На месте: {arrivedCount} из {tr.participantIds.length}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <ProgressBar
          percentage={fillPerc}
          label={`Участники: ${tr.participantIds.length} / ${tr.participantsMax}`}
          subLabel={isFull ? '🔥 Аншлаг' : 'Места есть'}
          color={fillPerc > 85 ? 'amber' : 'emerald'}
          height="sm"
        />

        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <img
              src={creator?.avatar || '/avatar-placeholder.svg'}
              alt=""
              loading="lazy"
              className="w-6 h-6 rounded-full object-cover border border-slate-600"
            />
            <span className="text-xs text-slate-400">
              Организатор: <b className="text-slate-200">{creator?.name.split(' ')[0] || 'Атлет'}</b>
            </span>
          </div>

          <button
            title={genderError || undefined}
            disabled={Boolean(genderError) || tr.isCompleted || (isFull && !isJoined) || tr.createdBy === currentUserId}
            onClick={(e) => { e.stopPropagation(); onJoin(tr); }}
            className={`text-xs font-black px-3 py-1.5 rounded-xl transition ${
              isJoined
                ? 'bg-slate-800 text-rose-400 hover:bg-rose-500/20 border border-slate-700'
                : isFull
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow'
            }`}
          >
            {tr.isCompleted ? 'Завершена' : tr.createdBy === currentUserId ? 'Вы организатор' : isJoined ? 'Отменить' : genderError ? 'Запись недоступна' : isFull ? 'Заполнено' : 'Участвовать ↗'}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Memoised: only re-renders when this specific training changes */
export const TrainingCard = React.memo(
  TrainingCardInner,
  (prev, next) =>
    prev.currentUser === next.currentUser &&
    prev.currentUserId === next.currentUserId &&
    prev.training === next.training &&
    prev.creator === next.creator &&
    prev.userCoords === next.userCoords &&
    prev.onSelect === next.onSelect &&
    prev.onJoin === next.onJoin
);
