import React, { useState } from 'react';
import { CheckCircle2, MapPin, Trophy } from 'lucide-react';
import { Training, UserProfile, ORGANIZER_RATING_TAGS } from '../lib/types';
import { Modal } from './Modal';
import { StarRating } from './StarRating';
import { submitOrganizerRating, starsLabel } from '../services/ratings';

interface RateOrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  training: Training | null;
  participant: UserProfile | null;
  organizer: UserProfile | null;
  onSubmitted: (training: Training, organizer: UserProfile) => void;
}

export const RateOrganizerModal: React.FC<RateOrganizerModalProps> = ({
  isOpen, onClose, training, participant, organizer, onSubmitted
}) => {
  const [stars, setStars] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const submit = async () => {
    if (!training || !participant || !organizer) return;
    setSaving(true);
    setError('');
    try {
      const result = await submitOrganizerRating(training, participant, organizer, stars, tags, comment);
      onSubmitted(result.training, result.organizer);
      onClose();
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      const message: Record<string, string> = {
        'training-not-completed': 'Тренировка ещё не завершена организатором.',
        'not-registered': 'Опрос доступен только записанным участникам.',
        'not-checked-in': 'Сначала отметьтесь на месте по GPS.',
        'already-rated': 'Вы уже оценили этого организатора.'
      };
      setError(message[code] || 'Не удалось сохранить оценку. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Как прошла тренировка?"
      subtitle={training?.title}
      footer={
        <div className="flex gap-2 w-full">
          <button onClick={onClose} className="px-4 py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl text-xs">
            Позже
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-black rounded-2xl text-xs shadow-[0_0_20px_rgba(16,185,129,0.45)] disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : `Оценить ${stars} ★ и подтвердить участие`}
          </button>
        </div>
      }
    >
      {training && participant && organizer ? (
        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-3 flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-200 leading-relaxed">
              GPS-присутствие подтверждено. После оценки организатора тренировка будет
              учтена в вашем прогрессе, если сегодня ещё не было зачёта.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <img src={organizer.avatar} alt={organizer.name} className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Организатор</p>
              <h4 className="text-sm font-black text-white truncate">{organizer.name}</h4>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-400" /> {organizer.locationName}
              </p>
              <p className="text-[10px] text-amber-400 font-bold mt-0.5">★ {organizer.rating.toFixed(1)} • {organizer.ratingCount || 0} оценок</p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center space-y-2">
            <p className="text-xs font-bold text-slate-300">Как организатор провёл тренировку?</p>
            <div className="flex justify-center"><StarRating value={stars} onChange={setStars} size="lg" /></div>
            <p className="text-sm font-black text-emerald-400">{starsLabel(stars)}</p>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-300 mb-2">Что понравилось?</p>
            <div className="flex flex-wrap gap-1.5">
              {ORGANIZER_RATING_TAGS.map((tag) => {
                const negative = tag === 'Опоздал с началом' || tag === 'Тренировка не состоялась';
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition ${
                      active ? (negative ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-950') : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >{tag}</button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Комментарий (необязательно)</label>
            <textarea rows={2} maxLength={200} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: отличный маршрут и понятные упражнения"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none" />
          </div>

          {error && <p className="text-[11px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/40 p-2.5 rounded-xl">{error}</p>}
          <p className="text-[10px] text-slate-500 text-center flex justify-center gap-1"><Trophy className="w-3 h-3" /> Одна завершённая тренировка в сутки идёт в прогресс</p>
        </div>
      ) : null}
    </Modal>
  );
};