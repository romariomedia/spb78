import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Camera, Plus, Trash2, Eye, EyeOff, Save, Cake,
  AlertTriangle, ImagePlus, ShieldCheck, Sparkles
} from 'lucide-react';
import { UserProfile, MAX_PORTFOLIO_PHOTOS } from '../lib/types';
import {
  calculateAge, validateBirthDate, canAddPhoto, addPortfolioPhoto,
  removePortfolioPhoto, profileCompleteness, hasPersonalPhoto, hoursUntilDeletion,
  PORTFOLIO_QUALITY_NOTE
} from '../services/profile';
import { takeAvatarPhoto, pickPhotoFromGallery, triggerHapticImpact, triggerHapticNotification } from '../services/native';
import { updateProfile } from '../services/repository';
import { syncVerification, getVerificationState } from '../services/verification';
import { uploadToCloudinary, photoUrl } from '../services/cloudinary';
import { ProgressBar } from './ProgressBar';
import { SPORTS as SPORT_OPTIONS } from '../lib/types';

interface ProfileEditorProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({ user, onUpdateUser }) => {
  const [bio, setBio] = useState(user.bio);
  const [birthDate, setBirthDate] = useState(user.birthDate || '');
  const [hideBirthDate, setHideBirthDate] = useState(!!user.hideBirthDate);
  const [locationName, setLocationName] = useState(user.locationName);
  const [sports, setSports] = useState<string[]>(user.sports || []);
  const [activeLooking, setActiveLooking] = useState(user.activeLooking);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<'avatar' | 'portfolio' | null>(null);
  const [photoProgress, setPhotoProgress] = useState<number | null>(null);

  const portfolio = user.photoPortfolio || [];
  const photoOk = hasPersonalPhoto(user);
  const verification = getVerificationState(user);
  const completeness = profileCompleteness(user);
  const age = calculateAge(birthDate);

  const toggleSport = (sport: string) => {
    triggerHapticImpact('light');
    setSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  };

  const handleSave = async () => {
    setError(null);
    const dobError = validateBirthDate(birthDate);
    if (dobError) {
      setError(dobError);
      return;
    }
    const updates: Partial<UserProfile> = {
      bio: bio.trim(),
      birthDate: birthDate || undefined,
      hideBirthDate,
      locationName: locationName.trim(),
      sports,
      activeLooking,
      ...(age !== null ? { age } : {})
    };

    try {
      const next = { ...user, ...updates };
      await updateProfile(updates);
      onUpdateUser(next);
      const verified = await syncVerification(next);
      onUpdateUser(verified);
      triggerHapticNotification('success');
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch {
      setError('Не удалось сохранить изменения. Проверьте соединение и повторите.');
    }
  };

  const handleSetAvatar = async () => {
    let file: File | null = null;
    try {
      file = await takeAvatarPhoto();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Камера недоступна');
      return;
    }
    if (!file) return;
    setPhotoBusy('avatar');
    setError(null);
    setPhotoProgress(0);
    try {
      const uploaded = await uploadToCloudinary(file, {
        folder: 'sportbuddy/avatars',
        tags: ['avatar', user.id],
        onProgress: setPhotoProgress
      });
      const next: UserProfile = { ...user, avatar: uploaded, hasRealPhoto: true };
      onUpdateUser(next);
      await updateProfile({ avatar: uploaded, hasRealPhoto: true });
      const verified = await syncVerification(next);
      onUpdateUser(verified);
      triggerHapticNotification('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить личное фото');
    } finally {
      setPhotoBusy(null);
      setPhotoProgress(null);
    }
  };

  const handleAddPortfolio = async () => {
    if (!canAddPhoto(user)) return;
    triggerHapticImpact('medium');
    let file: File | null = null;
    try {
      file = await pickPhotoFromGallery();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Галерея недоступна');
      return;
    }
    if (!file) return;
    setPhotoBusy('portfolio');
    setError(null);
    setPhotoProgress(0);
    try {
      const uploaded = await uploadToCloudinary(file, {
        folder: 'sportbuddy/portfolio',
        tags: ['portfolio', user.id],
        onProgress: setPhotoProgress
      });
      const next = addPortfolioPhoto(user, uploaded);
      onUpdateUser(next);
      await updateProfile({ photoPortfolio: next.photoPortfolio });
      const verified = await syncVerification(next);
      onUpdateUser(verified);
      triggerHapticNotification('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить фото в портфолио');
    } finally {
      setPhotoBusy(null);
      setPhotoProgress(null);
    }
  };

  const handleRemovePortfolio = async (idx: number) => {
    triggerHapticImpact('light');
    const next = removePortfolioPhoto(user, idx);
    try {
      await updateProfile({ photoPortfolio: next.photoPortfolio });
      onUpdateUser(next);
    } catch {
      setError('Не удалось удалить фото. Проверьте соединение и повторите.');
    }
  };

  return (
    <div className="space-y-5">
      {/* ---------- Anti-fraud photo warning (24h deletion policy) ---------- */}
      {!verification.isVerified && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-rose-950/60 via-slate-900 to-rose-950/60 border-2 border-rose-500/60 rounded-3xl p-4 space-y-3 shadow-xl"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 animate-pulse" />
            <div>
              <h4 className="text-xs font-black text-white">
                Завершите верификацию — осталось {verification.hoursLeft || hoursUntilDeletion(user)} ч
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Для сохранения аккаунта нужны <b className="text-rose-400">личная фотография и минимум одно фото в портфолио</b>
                в течение 24 часов с момента регистрации. Это защищает спортсменов Санкт-Петербурга от мошенников
                и фейковых анкет.
              </p>
            </div>
          </div>
          <button
            onClick={photoOk ? handleAddPortfolio : handleSetAvatar}
            disabled={photoBusy !== null}
            className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-2xl text-xs transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Camera className={`w-4 h-4 ${photoBusy ? 'animate-pulse' : ''}`} /> {photoBusy ? (photoProgress !== null ? `Загрузка ${photoProgress}%` : 'Загрузка фото…') : photoOk ? 'Добавить фото в портфолио' : 'Загрузить личную фотографию'}
          </button>
        </motion.div>
      )}

      {/* ---------- Completeness ---------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-2.5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Заполненность анкеты
          </h3>
          {verification.isVerified && (
            <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/40 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Верифицирован
            </span>
          )}
        </div>
        <ProgressBar
          percentage={completeness}
          label="Профиль заполнен"
          subLabel={completeness === 100 ? 'Отлично!' : 'Добавьте больше данных'}
          color={completeness < 50 ? 'rose' : completeness < 85 ? 'amber' : 'emerald'}
          showPercentage
        />
        <p className="text-[10px] text-slate-500">
          Полные анкеты получают в 3 раза больше симпатий от спортсменов СПб.
        </p>
      </div>

      {/* ---------- About me ---------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-extrabold text-white">✏️ Информация о себе</h3>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Имя</label>
          <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-300 flex items-center justify-between gap-3">
            <span className="truncate">{user.name}</span>
            <span className="shrink-0 text-[10px] font-bold text-slate-600">🔒 задано при регистрации</span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Имя нельзя менять после регистрации — это защита доверия в спортивном сообществе.</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-300">О себе и целях</label>
            <span className={`text-[10px] font-mono ${bio.length > 500 ? 'text-rose-400' : 'text-slate-500'}`}>
              {bio.length}/500
            </span>
          </div>
          <textarea
            rows={4}
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Расскажите о своём спортивном опыте, темпе, любимых площадках Санкт-Петербурга..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Район Санкт-Петербурга</label>
          <input
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Крестовский остров, СПб"
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Birth date with privacy toggle */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Cake className="w-4 h-4 text-amber-400" /> Дата рождения
            </label>
            {age !== null && (
              <span className="text-[10px] font-black bg-slate-900 text-emerald-400 px-2 py-1 rounded-lg border border-slate-700">
                {age} лет
              </span>
            )}
          </div>

          <input
            type="date"
            value={birthDate}
            onChange={(e) => { setBirthDate(e.target.value); setError(null); }}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition"
          />

          <button
            onClick={() => { triggerHapticImpact('light'); setHideBirthDate(!hideBirthDate); }}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition ${
              hideBirthDate
                ? 'bg-slate-900 border-slate-700 text-slate-300'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <span className="flex items-center gap-2">
              {hideBirthDate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {hideBirthDate ? 'Дата скрыта от других' : 'Дату видят другие спортсмены'}
            </span>
            <span className={`w-9 h-5 rounded-full relative transition-colors ${hideBirthDate ? 'bg-slate-700' : 'bg-emerald-500'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${hideBirthDate ? 'left-0.5' : 'left-4.5 right-0.5'}`} />
            </span>
          </button>
          <p className="text-[10px] text-slate-500">
            Если дата скрыта, в анкете отображается только возраст. Сервис доступен с 18 лет (436-ФЗ).
          </p>
        </div>

        {/* Sports */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-2">Виды спорта</label>
          <div className="flex flex-wrap gap-1.5">
            {SPORT_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => toggleSport(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  sports.includes(s)
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Looking toggle */}
        <button
          onClick={() => { triggerHapticImpact('light'); setActiveLooking(!activeLooking); }}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-xs font-bold transition ${
            activeLooking
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}
        >
          <span>{activeLooking ? '🔍 Активно ищу напарников' : '💤 Анкета скрыта из поиска'}</span>
          <span className={`w-9 h-5 rounded-full relative transition-colors ${activeLooking ? 'bg-emerald-500' : 'bg-slate-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${activeLooking ? 'right-0.5' : 'left-0.5'}`} />
          </span>
        </button>

        {error && (
          <p className="text-xs text-rose-400 font-semibold flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/40 p-3 rounded-2xl">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}

        <button
          onClick={handleSave}
          className={`w-full py-3.5 font-black rounded-2xl text-xs transition active:scale-95 flex items-center justify-center gap-2 ${
            saved
              ? 'bg-emerald-600 text-white'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.45)]'
          }`}
        >
          <Save className="w-4 h-4" /> {saved ? 'Изменения сохранены ✓' : 'Сохранить изменения'}
        </button>
      </div>

      {/* ---------- Photo portfolio (max 5) ---------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-emerald-400" /> Портфолио фотографий
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Спортивные снимки — до {MAX_PORTFOLIO_PHOTOS} шт.
            </p>
          </div>
          <span className="text-[10px] font-black bg-slate-950 text-emerald-400 px-2.5 py-1 rounded-xl border border-slate-700">
            {portfolio.length} / {MAX_PORTFOLIO_PHOTOS}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {portfolio.map((url, idx) => (
            <motion.div
              key={`${url}-${idx}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-square rounded-2xl overflow-hidden border border-slate-800 group"
            >
              <img src={photoUrl(url, 320)} alt={`Спортивное фото ${idx + 1}`} width={160} height={160} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              <button
                onClick={() => handleRemovePortfolio(idx)}
                className="absolute top-1.5 right-1.5 p-1.5 bg-slate-950/90 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg border border-slate-700 transition active:scale-90"
                aria-label="Удалить фото"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <span className="absolute bottom-1.5 left-1.5 text-[9px] font-black bg-slate-950/80 text-slate-300 px-1.5 py-0.5 rounded">
                {idx + 1}
              </span>
            </motion.div>
          ))}

          {canAddPhoto(user) && (
            <button
              onClick={handleAddPortfolio}
              disabled={photoBusy !== null}
              className="aspect-square rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-emerald-400 transition active:scale-95 disabled:opacity-50"
            >
              <Plus className={`w-6 h-6 ${photoBusy ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-bold">{photoBusy === 'portfolio' ? (photoProgress !== null ? `${photoProgress}%` : 'Загрузка…') : 'Добавить'}</span>
            </button>
          )}
        </div>

        {portfolio.length === 0 && (
        <p className="text-[11px] text-slate-500 bg-slate-950 p-3 rounded-2xl border border-slate-800 leading-relaxed">
          {PORTFOLIO_QUALITY_NOTE} Добавьте фото с забегов, матчей и тренировок — так напарники быстрее поймут ваш уровень и стиль.
          </p>
        )}
      </div>
    </div>
  );
};
