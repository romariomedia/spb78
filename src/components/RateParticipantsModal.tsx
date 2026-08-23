import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, MapPin, Trophy } from 'lucide-react';
import { Training, UserProfile, RATING_TAGS } from '../lib/types';
import { Modal } from './Modal';
import { StarRating } from './StarRating';
import { pendingRatings, submitRating, starsLabel } from '../services/ratings';

interface RateParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  training: Training | null;
  organizer: UserProfile | null;
  allUsers: UserProfile[];
  onRated: (training: Training, participant: UserProfile) => void;
}

export const RateParticipantsModal: React.FC<RateParticipantsModalProps> = ({
  isOpen, onClose, training, organizer, allUsers, onRated
}) => {
  const [stars, setStars] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [justRated, setJustRated] = useState<string | null>(null);

  const queue = useMemo(
    () => (training ? pendingRatings(training) : []),
    [training]
  );
  const current = queue[0] ? allUsers.find((u) => u.id === queue[0]) : undefined;

  const reset = () => {
    setStars(5);
    setTags([]);
    setComment('');
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmit = async () => {
    if (!training || !organizer || !current) return;
    setSaving(true);
    try {
      const result = await submitRating(training, organizer, current, stars, tags, comment);
      setJustRated(current.name);
      onRated(result.training, result.participant);
      reset();
      setTimeout(() => setJustRated(null), 2000);
    } finally {
      setSaving(false);
    }
  };

  const done = queue.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Оценка участников"
      subtitle={training ? training.title : undefined}
      footer={
        done ? (
          <button
            onClick={onClose}
            className="w-full py-3 bg-emerald-500 text-slate-950 font-black rounded-2xl text-sm active:scale-95 transition"
          >
            Готово 🎉
          </button>
        ) : (
          <div className="flex gap-2 w-full">
            <button
              onClick={onClose}
              className="px-4 py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl text-xs transition"
            >
              Позже
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-2xl text-xs transition shadow-[0_0_20px_rgba(245,158,11,0.45)] active:scale-95 disabled:opacity-60"
            >
              {saving ? 'Сохранение…' : `Поставить ${stars} ★`}
            </button>
          </div>
        )
      }
    >
      {done ? (
        <div className="text-center space-y-3 py-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 mx-auto flex items-center justify-center text-3xl">
            ✅
          </div>
          <h3 className="text-base font-black text-white">Все участники оценены!</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Спасибо! Ваши оценки формируют рейтинг спортсменов Санкт-Петербурга
            и помогают находить надёжных напарников.
          </p>
        </div>
      ) : current ? (
        <div className="space-y-4">
          <AnimatePresence>
            {justRated && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 text-xs font-bold p-2.5 rounded-2xl flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {justRated} — оценка сохранена
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" /> {training?.sport}
            </span>
            <span>Осталось оценить: {queue.length}</span>
          </div>

          {/* Participant card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <img
              src={current.avatar}
              alt={current.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shrink-0"
            />
            <div className="min-w-0">
              <h4 className="text-sm font-black text-white truncate">{current.name}</h4>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 text-emerald-400 shrink-0" /> {current.locationName}
              </p>
              <p className="text-[10px] text-amber-400 font-bold mt-0.5">
                ★ {current.rating.toFixed(1)} • {current.ratingCount || 0} оценок
              </p>
            </div>
          </div>

          {/* Stars */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center space-y-2">
            <p className="text-xs font-bold text-slate-300">Как проявил себя на тренировке?</p>
            <div className="flex justify-center">
              <StarRating value={stars} onChange={setStars} size="lg" />
            </div>
            <p className="text-sm font-black text-amber-400">{starsLabel(stars)}</p>
          </div>

          {/* Tags */}
          <div>
            <p className="text-xs font-bold text-slate-300 mb-2">Отметьте качества</p>
            <div className="flex flex-wrap gap-1.5">
              {RATING_TAGS.map((tag) => {
                const negative = tag === 'Опоздал' || tag === 'Не пришёл';
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition ${
                      active
                        ? negative
                          ? 'bg-rose-500 text-white'
                          : 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Комментарий (необязательно)
            </label>
            <textarea
              rows={2}
              maxLength={200}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Отличный темп, всегда приходит вовремя..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
