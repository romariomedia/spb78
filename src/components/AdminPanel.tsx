import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Plus, Trash2, MapPin, ImagePlus, Video, X,
  AlertCircle, Eye, EyeOff, Lock, LayoutDashboard, Pencil
} from 'lucide-react';
import {
  OfficialEvent, EventCategory, EventStatus, UserProfile,
  EVENT_CATEGORIES, EVENT_MIN_PARTICIPANTS, EVENT_MAX_PARTICIPANTS, ADMIN_EMAIL
} from '../lib/types';
import {
  getEvents, createEvent, removeEvent, updateEvent,
  validateEventDraft, getAdminStats, EventDraft, getCategoryConfig
} from '../services/events';
import { DEFAULT_COORDS, Coords } from '../services/geolocation';
import { GeocodeResult } from '../services/geocoding';
import { LeafletMap } from './LeafletMap';
import { Modal } from './Modal';
import { triggerHapticImpact } from '../services/native';
import { uploadMedia, photoUrl, videoPoster } from '../services/cloudinary';
import { hasAdminSession } from '../services/adminAuth';
import { compressImage } from '../services/media';

import { SPORT_TAGS as SPORTS } from '../lib/types';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  authorized: boolean;
  onEventsChanged: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen, onClose, currentUser, authorized, onEventsChanged
}) => {
  const admin = authorized;

  const [creating, setCreating] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  // Form state
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState<EventCategory>('competition');
  const [sport, setSport] = useState('Бег');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [coords, setCoords] = useState<Coords>(DEFAULT_COORDS);
  const [locationName, setLocationName] = useState('Крестовский остров');
  const [address, setAddress] = useState('Санкт-Петербург');
  const [dateLabel, setDateLabel] = useState('Суббота, 16 августа');
  const [time, setTime] = useState('11:00');
  const [participantsMax, setParticipantsMax] = useState(30);
  const [prizePool, setPrizePool] = useState('');
  const [entryFee, setEntryFee] = useState('Бесплатно');
  const [status, setStatus] = useState<EventStatus>('published');
  const [uploading, setUploading] = useState<'cover' | 'video' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const events = getEvents(true);
  const stats = getAdminStats();

  const resetForm = () => {
    setTitle(''); setTagline(''); setDescription('');
    setCoverUrl(''); setVideoUrl(''); setPrizePool('');
    setParticipantsMax(30); setError(null); setEditingEventId(null);
  };

  const beginEdit = (event: OfficialEvent) => {
    triggerHapticImpact('medium');
    setEditingEventId(event.id);
    setCreating(true);
    setError(null);
    setTitle(event.title);
    setTagline(event.tagline);
    setCategory(event.category);
    setSport(event.sport);
    setDescription(event.description);
    setCoverUrl(event.coverUrl || '');
    setVideoUrl(event.videoUrl || '');
    setCoords({ lat: event.lat, lng: event.lng });
    setLocationName(event.locationName);
    setAddress(event.address);
    setDateLabel(event.dateLabel);
    setTime(event.time);
    setParticipantsMax(event.participantsMax);
    setPrizePool(event.prizePool || '');
    setEntryFee(event.entryFee || 'Бесплатно');
    setStatus(event.status);
  };

  const handleMedia = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'cover' | 'video') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setUploading(kind);
    setUploadProgress(0);
    try {
      // Гвард переехал сюда из удалённого eventMedia.ts
      if (!hasAdminSession()) throw new Error('admin-otp-required');
      if (!currentUser.id) throw new Error('firebase-auth-required');
      const isVideo = kind === 'video';
      const payload = isVideo ? file : await compressImage(file, 1920, 0.85);
      const uploaded = await uploadMedia(payload, {
        folder: isVideo ? 'sportbuddy/events/video' : 'sportbuddy/events/cover',
        resourceType: isVideo ? 'video' : 'image',
        tags: ['event', kind],
        onProgress: setUploadProgress
      });
      const url = uploaded.secureUrl;
      if (kind === 'cover') setCoverUrl(url);
      else setVideoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить медиа');
    } finally {
      setUploading(null);
      setUploadProgress(0);
    }
  };

  const handleCreate = () => {
    const draft: EventDraft = {
      title, tagline, category, sport, description,
      coverUrl: coverUrl || undefined,
      videoUrl: videoUrl || undefined,
      locationName, address,
      lat: coords.lat, lng: coords.lng,
      dateLabel, time, participantsMax,
      prizePool: prizePool || undefined,
      entryFee: entryFee || undefined,
      status
    };

    const validationError = validateEventDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      if (editingEventId) {
        if (!updateEvent(editingEventId, draft)) {
          setError('Мероприятие не найдено. Обновите список и повторите.');
          return;
        }
      } else {
        createEvent(draft, currentUser.id);
      }
      resetForm();
      setCreating(false);
      setRefresh(r => r + 1);
      onEventsChanged();
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'admin-otp-required'
          ? 'Сессия администратора истекла. Запросите новый код входа.'
          : 'Не удалось создать мероприятие.'
      );
    }
  };

  /* ------------------------------ access denied ----------------------------- */
  if (!admin) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Кабинет администратора">
        <div className="text-center space-y-3 py-4">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border-2 border-rose-500/50 mx-auto flex items-center justify-center">
            <Lock className="w-7 h-7 text-rose-400" />
          </div>
          <h3 className="text-base font-black text-white">Доступ запрещён</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Создавать официальные мероприятия SportBuddy может только администратор платформы.
          </p>
          <p className="text-[11px] text-slate-500 bg-slate-950 border border-slate-800 p-3 rounded-2xl font-mono">
            Требуется вход с {ADMIN_EMAIL}
          </p>
        </div>
      </Modal>
    );
  }

  /* -------------------------------- admin UI -------------------------------- */
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Кабинет администратора"
        subtitle={ADMIN_EMAIL}
        maxWidth="lg"
      >
        <div className="space-y-4" key={refresh}>
          {/* Dashboard */}
          <div className="bg-gradient-to-r from-amber-950/50 via-slate-950 to-amber-950/50 border border-amber-500/50 rounded-2xl p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black text-white">Панель управления</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { v: stats.total, l: 'всего', i: '📋' },
                { v: stats.published, l: 'опубл.', i: '✅' },
                { v: stats.drafts, l: 'черновик', i: '📝' },
                { v: stats.registrations, l: 'записей', i: '👥' }
              ].map((s) => (
                <div key={s.l} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
                  <span className="text-sm block leading-none">{s.i}</span>
                  <span className="block text-xs font-black text-white mt-1">{s.v}</span>
                  <span className="text-[9px] text-slate-500">{s.l}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              triggerHapticImpact('medium');
              if (creating) {
                setCreating(false);
                resetForm();
              } else {
                setCreating(true);
                setError(null);
              }
            }}
            className={`w-full py-3 font-black rounded-2xl text-xs transition active:scale-95 flex items-center justify-center gap-2 ${
              creating
                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.45)]'
            }`}
          >
            {creating ? <><X className="w-4 h-4" /> Отменить</> : <><Plus className="w-4 h-4 stroke-[3]" /> Создать мероприятие</>}
          </button>

          {/* Creation form */}
          <AnimatePresence>
            {creating && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
                  {/* Category */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">Тип мероприятия</label>
                    <div className="flex flex-wrap gap-1.5">
                      {EVENT_CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setCategory(c.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition ${
                            category === c.id
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}
                        >
                          {c.icon} {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Название *</label>
                    <input
                      type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                      placeholder="Кубок SportBuddy СПб по Падел"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Слоган *</label>
                    <input
                      type="text" value={tagline} onChange={(e) => setTagline(e.target.value)}
                      placeholder="Первый официальный турнир платформы"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Вид спорта</label>
                      <select
                        value={sport} onChange={(e) => setSport(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                      >
                        {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Статус</label>
                      <select
                        value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                      >
                        <option value="published">Опубликовано</option>
                        <option value="draft">Черновик</option>
                        <option value="finished">Завершено</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Описание *</label>
                    <textarea
                      rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="Формат, регламент, что взять с собой..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  {/* Media */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <ImagePlus className="w-4 h-4 text-emerald-400" /> Фото и видео анонс
                    </span>

                    {coverUrl && (
                      <div className="relative h-24 rounded-xl overflow-hidden border border-slate-700">
                        <img src={photoUrl(coverUrl, 640)} alt="Обложка мероприятия" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setCoverUrl('')}
                          className="absolute top-1.5 right-1.5 p-1.5 bg-slate-950/90 text-rose-400 rounded-lg border border-slate-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {videoUrl && (
                      <div className="relative rounded-xl overflow-hidden border border-slate-700">
                        <video src={videoUrl} poster={videoPoster(videoUrl)} preload="metadata" controls playsInline className="w-full max-h-32 bg-black" />
                        <button
                          onClick={() => setVideoUrl('')}
                          className="absolute top-1.5 right-1.5 p-1.5 bg-slate-950/90 text-rose-400 rounded-lg border border-slate-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploading !== null}
                        className="py-2 bg-slate-950 border border-slate-700 text-emerald-400 font-bold rounded-xl text-[11px] active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <ImagePlus className="w-3.5 h-3.5" /> {uploading === 'cover' ? `Загрузка ${uploadProgress}%` : 'Обложка'}
                      </button>
                      <button
                        onClick={() => videoInputRef.current?.click()}
                        disabled={uploading !== null}
                        className="py-2 bg-slate-950 border border-slate-700 text-emerald-400 font-bold rounded-xl text-[11px] active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Video className="w-3.5 h-3.5" /> {uploading === 'video' ? `Загрузка ${uploadProgress}%` : 'Видео'}
                      </button>
                    </div>
                    <input
                      type="text" value={coverUrl.startsWith('data:') ? '' : coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="или вставьте URL изображения"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[11px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => handleMedia(e, 'cover')} className="hidden" />
                    <input ref={videoInputRef} type="file" accept="video/*" onChange={(e) => handleMedia(e, 'video')} className="hidden" />
                  </div>

                  {/* Location */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-emerald-400" /> Место проведения
                      </span>
                      <button
                        onClick={() => setMapOpen(true)}
                        className="text-[11px] bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1 rounded-lg border border-emerald-500/40"
                      >
                        📍 На карте
                      </button>
                    </div>
                    <input
                      type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)}
                      placeholder="Название площадки"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[11px] text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 font-mono">
                      {address} • {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Дата</label>
                      <input
                        type="text" value={dateLabel} onChange={(e) => setDateLabel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Время</label>
                      <input
                        type="time" value={time} onChange={(e) => setTime(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Participants slider 10..100 */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300">Количество участников</span>
                      <span className="text-sm font-black text-emerald-400">{participantsMax}</span>
                    </div>
                    <input
                      type="range"
                      min={EVENT_MIN_PARTICIPANTS}
                      max={EVENT_MAX_PARTICIPANTS}
                      step={5}
                      value={participantsMax}
                      onChange={(e) => setParticipantsMax(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>{EVENT_MIN_PARTICIPANTS} мин.</span>
                      <span>{EVENT_MAX_PARTICIPANTS} макс.</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Призовой фонд</label>
                      <input
                        type="text" value={prizePool} onChange={(e) => setPrizePool(e.target.value)}
                        placeholder="50 000 ₽"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Взнос</label>
                      <input
                        type="text" value={entryFee} onChange={(e) => setEntryFee(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-[11px] text-rose-300 font-semibold bg-rose-500/10 border border-rose-500/40 p-2.5 rounded-xl flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
                    </p>
                  )}

                  <button
                    onClick={handleCreate}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-2xl text-xs transition shadow-[0_0_20px_rgba(245,158,11,0.45)] active:scale-95"
                  >
                    {editingEventId ? '💾 Сохранить изменения' : '🚀 Опубликовать мероприятие'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Existing events management */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5" /> Мои мероприятия ({events.length})
            </h4>
            {events.map((ev: OfficialEvent) => {
              const cfg = getCategoryConfig(ev.category);
              return (
                <div key={ev.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center gap-2.5">
                  <span className="text-lg shrink-0">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[11px] font-extrabold text-white truncate">{ev.title}</h5>
                    <p className="text-[10px] text-slate-500 truncate">
                      {ev.dateLabel} • {ev.participantIds.length}/{ev.participantsMax} участн.
                    </p>
                  </div>
                  <button
                    onClick={() => beginEdit(ev)}
                    className="p-2 bg-slate-900 text-sky-400 hover:text-sky-300 border border-slate-800 rounded-lg shrink-0 transition active:scale-90"
                    aria-label="Редактировать"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      try {
                        updateEvent(ev.id, { status: ev.status === 'published' ? 'draft' : 'published' });
                        setRefresh(r => r + 1);
                        onEventsChanged();
                      } catch {
                        setError('Сессия администратора истекла. Запросите новый код входа.');
                      }
                    }}
                    className={`p-2 rounded-lg border shrink-0 transition active:scale-90 ${
                      ev.status === 'published'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                        : 'bg-slate-900 text-slate-500 border-slate-700'
                    }`}
                    aria-label="Публикация"
                  >
                    {ev.status === 'published' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Удалить «${ev.title}»?`)) {
                        try {
                          removeEvent(ev.id);
                          setRefresh(r => r + 1);
                          onEventsChanged();
                        } catch {
                          setError('Сессия администратора истекла. Запросите новый код входа.');
                        }
                      }
                    }}
                    className="p-2 bg-slate-900 text-slate-500 hover:text-rose-400 border border-slate-800 rounded-lg shrink-0 transition active:scale-90"
                    aria-label="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Map picker */}
      <Modal
        isOpen={mapOpen}
        onClose={() => setMapOpen(false)}
        title="Место проведения"
        subtitle="Кликните на карте Санкт-Петербурга"
        maxWidth="lg"
        footer={
          <button
            onClick={() => setMapOpen(false)}
            className="w-full py-3 bg-emerald-500 text-slate-950 font-black rounded-2xl text-xs active:scale-95 transition"
          >
            Подтвердить локацию
          </button>
        }
      >
        <LeafletMap
          center={coords}
          zoom={12}
          interactiveSelect
          selectedCoords={coords}
          onSelectPoint={(c: Coords, addr: GeocodeResult) => {
            setCoords(c);
            setAddress(addr.shortAddress);
            setLocationName(addr.shortAddress);
          }}
          height="380px"
        />
      </Modal>
    </>
  );
};
