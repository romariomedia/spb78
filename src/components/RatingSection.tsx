import React from 'react';
import { Star, MessageSquareQuote } from 'lucide-react';
import { UserProfile } from '../lib/types';
import { getRatingsFor, getStarDistribution, computeAverageRating } from '../services/ratings';
import { StarRating } from './StarRating';
import { CollapsibleCard } from './CollapsibleCard';

interface RatingSectionProps {
  user: UserProfile;
  compact?: boolean;
}

export const RatingSection: React.FC<RatingSectionProps> = ({ user, compact = false }) => {
  const reviews = getRatingsFor(user.id);
  const dist = getStarDistribution(user.id);
  const average = computeAverageRating(user);
  const total = reviews.length;

  return (
    <CollapsibleCard
      storageKey="sportbuddy_profile_rating_open_v1"
      className="bg-slate-900 border border-slate-800"
      defaultOpen={false}
      icon={
        <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
          <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
        </div>
      }
      title="Репутация в тренировках"
      subtitle="Оценки участников и организаторов"
      collapsedSummary={`★ ${average.toFixed(1)} • ${total} оценок`}
      badge={
        <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-2 py-1 rounded-lg border border-amber-500/40">
          ★ {average.toFixed(1)}
        </span>
      }
    >
      {/* Score + histogram */}
      <div className="flex gap-4 bg-slate-950 border border-slate-800 rounded-2xl p-4">
        <div className="text-center shrink-0">
          <span className="block text-3xl font-black text-amber-400 leading-none">
            {average.toFixed(1)}
          </span>
          <div className="flex justify-center my-1.5">
            <StarRating value={Math.round(average)} size="sm" readOnly />
          </div>
          <span className="text-[10px] text-slate-500">{total} оценок</span>
        </div>

        <div className="flex-1 space-y-1 min-w-0">
          {[5, 4, 3, 2, 1].map((s) => {
            const count = dist[s] || 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 w-2">{s}</span>
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-slate-500 w-3 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews */}
      {total === 0 ? (
        <p className="text-[11px] text-slate-500 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 leading-relaxed">
          Оценок пока нет. После завершения реальной тренировки участники и
          организатор оценивают друг друга по шкале от 1 до 5 звёзд.
        </p>
      ) : (
        <div className={`space-y-2 ${compact ? 'max-h-64' : 'max-h-96'} overflow-y-auto no-scrollbar`}>
          {reviews.map((r) => (
            <div key={r.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
              <div className="flex items-center gap-2.5">
                <img
                  src={r.reviewerAvatar ?? r.organizerAvatar}
                  alt={r.reviewerName ?? r.organizerName}
                  loading="lazy"
                  className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                />
                <div className="flex-1 min-w-0">
                              <h5 className="text-[11px] font-extrabold text-white truncate">
                                {r.reviewerName ?? r.organizerName}
                              </h5>
                  <p className="text-[10px] text-slate-500 truncate">
                    {(r.kind === 'participant_to_organizer' ? 'Оценка участника' : 'Оценка организатора')} • {r.sport} • {r.trainingTitle}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <StarRating value={r.stars} size="sm" readOnly />
                  <span className="text-[9px] text-slate-500">{r.createdAt}</span>
                </div>
              </div>

              {r.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.tags.map((t) => {
                    const negative = t === 'Опоздал' || t === 'Не пришёл';
                    return (
                      <span
                        key={t}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                          negative
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {t}
                      </span>
                    );
                  })}
                </div>
              )}

              {r.comment && (
                <p className="text-[11px] text-slate-300 leading-snug flex gap-1.5">
                  <MessageSquareQuote className="w-3 h-3 text-slate-600 shrink-0 mt-0.5" />
                  «{r.comment}»
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
};
