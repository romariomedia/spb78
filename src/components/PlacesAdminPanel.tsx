import { validVenueCoordinates } from '../../shared/venue-location.js';
import { venueLocation } from '../lib/venueLocation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff,
  ImagePlus, Pencil, Plus, RefreshCw, Save, ShieldCheck, Trash2, X
} from 'lucide-react';
import { SportVenue, VENUE_SPORT_FILTERS } from '../lib/venues';
import { adminMutateVenue, refreshVenues, seedVenueCatalog } from '../services/venues';
import { uploadMedia } from '../services/cloudinary';
import { compressImage } from '../services/media';
import { triggerHapticImpact, triggerHapticNotification } from '../services/native';

const SPORT_OPTIONS = VENUE_SPORT_FILTERS.filter(item => item !== 'Все');

function emptyDraft(): SportVenue {
  return {
    id: '',
    name: '',
    sports: ['Футбол'],
    address: '',
    phone: '',
    hours: '',
    priceText: '',
    rating: undefined,
    reviews: undefined,
    website: '',
    status: 'needs_confirmation',
    note: '',
    photos: [],
    isVerified: false,
    isPublished: false,
    contactName: '',
    amenities: []
  };
}

function makeId(name: string): string {
  const cleaned = name
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return cleaned ? `${cleaned}-${Date.now().toString(36)}` : `venue-${Date.now().toString(36)}`;
}

export const PlacesAdminPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [venues, setVenues] = useState<SportVenue[]>([]);
  const [draft, setDraft] = useState<SportVenue>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = async () => {
    setBusy(true);
    setError('');
    try {
      setVenues(await refreshVenues(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить площадки');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (expanded) void reload();
  }, [expanded]);

  const counts = useMemo(() => ({
    total: venues.length,
    published: venues.filter(v => v.isPublished !== false).length,
    verified: venues.filter(v => v.isVerified).length,
    draft: venues.filter(v => v.isPublished === false).length
  }), [venues]);

  const beginCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormOpen(true);
    setError('');
  };

  const beginEdit = (venue: SportVenue) => {
    setEditingId(venue.id);
    setDraft({
      ...venue,
      coordinates: venueLocation(venue) ?? undefined,
      photos: venue.photos ? [...venue.photos] : [],
      amenities: venue.amenities ? [...venue.amenities] : []
    });
    setFormOpen(true);
    setError('');
  };

  const save = async () => {
    if (draft.name.trim().length < 2) return setError('Укажите название площадки');
    if (draft.address.trim().length < 3) return setError('Укажите адрес');
    if (draft.coordinates && !validVenueCoordinates(draft.coordinates)) return setError('Укажите корректные широту и долготу');
    if (!draft.sports.length) return setError('Выберите хотя бы один вид спорта');

    setBusy(true);
    setError('');
    try {
      if (editingId) {
        await adminMutateVenue({ operation: 'update', venueId: editingId, patch: draft });
      } else {
        const id = makeId(draft.name);
        await adminMutateVenue({ operation: 'create', venueId: id, venue: { ...draft, id } });
      }
      triggerHapticNotification('success');
      setFormOpen(false);
      setEditingId(null);
      setDraft(emptyDraft());
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить площадку');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (venue: SportVenue) => {
    if (!window.confirm(`Удалить площадку «${venue.name}» из SportBuddy Places?`)) return;
    setBusy(true);
    try {
      await adminMutateVenue({ operation: 'delete', venueId: venue.id });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить площадку');
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (venue: SportVenue) => {
    setBusy(true);
    try {
      await adminMutateVenue({
        operation: 'update',
        venueId: venue.id,
        patch: { ...venue, isPublished: venue.isPublished === false }
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить публикацию');
    } finally {
      setBusy(false);
    }
  };

  const seed = async () => {
    if (!window.confirm('Загрузить стартовую базу SportBuddy Places в Firestore? Существующие карточки с теми же ID будут обновлены.')) return;
    setBusy(true);
    setError('');
    try {
      await seedVenueCatalog();
      triggerHapticNotification('success');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить стартовую базу');
    } finally {
      setBusy(false);
    }
  };

  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || (draft.photos?.length ?? 0) >= 8) return;
    setUploading(true);
    setError('');
    try {
      const compressed = await compressImage(file, 1800, 0.84);
      const result = await uploadMedia(compressed, {
        folder: 'sportbuddy/venues',
        resourceType: 'image',
        tags: ['venue', editingId || 'new']
      });
      setDraft(prev => ({ ...prev, photos: [...(prev.photos || []), result.secureUrl].slice(0, 8) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => { triggerHapticImpact('light'); setExpanded(value => !value); }}
        className="w-full p-3.5 flex items-center gap-3 text-left"
      >
        <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white">SportBuddy Places</p>
          <p className="text-[10px] text-slate-400">Площадки, цены, фото, публикация и проверка</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-800 p-3.5 space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {[
              [counts.total, 'всего'],
              [counts.published, 'видно'],
              [counts.verified, 'проверено'],
              [counts.draft, 'черновик']
            ].map(([value, label]) => (
              <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-center">
                <p className="text-sm font-black text-white">{value}</p>
                <p className="text-[9px] text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={beginCreate} className="rounded-xl bg-emerald-500 text-slate-950 py-2.5 text-[11px] font-black flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Добавить
            </button>
            <button type="button" onClick={() => void reload()} disabled={busy} className="rounded-xl border border-slate-700 bg-slate-900 text-slate-200 py-2.5 text-[11px] font-black flex items-center justify-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Обновить
            </button>
            <button type="button" onClick={() => void seed()} disabled={busy} className="rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 py-2.5 text-[11px] font-black">
              База 50
            </button>
          </div>

          {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-[11px] text-rose-300">{error}</div>}

          {formOpen && (
            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-white">{editingId ? 'Редактирование площадки' : 'Новая площадка'}</p>
                <button type="button" onClick={() => setFormOpen(false)} className="p-1.5 text-slate-500"><X className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input value={draft.name} onChange={e => setDraft(v => ({...v, name:e.target.value}))} placeholder="Название *" className="col-span-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white" />
                <input value={draft.address} onChange={e => setDraft(v => ({...v, address:e.target.value, coordinates: null}))} placeholder="Адрес *" className="col-span-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white" />
                <label className="text-xs text-slate-400">Широта
                  <input type="number" step="any" min="-90" max="90" value={Number.isFinite(draft.coordinates?.lat) ? draft.coordinates!.lat : ''} onChange={e => setDraft(v => ({...v, coordinates: {...(v.coordinates ?? {lat:NaN,lng:NaN}), lat:e.target.value === '' ? NaN : Number(e.target.value)}}))} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-white" />
                </label>
                <label className="text-xs text-slate-400">Долгота
                  <input type="number" step="any" min="-180" max="180" value={Number.isFinite(draft.coordinates?.lng) ? draft.coordinates!.lng : ''} onChange={e => setDraft(v => ({...v, coordinates: {...(v.coordinates ?? {lat:NaN,lng:NaN}), lng:e.target.value === '' ? NaN : Number(e.target.value)}}))} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-white" />
                </label>
                <button type="button" onClick={() => setDraft(v => ({...v, coordinates: null}))} className="col-span-2 text-left text-xs text-slate-400">Очистить введённые координаты</button>
                <p className="col-span-2 text-[11px] text-slate-500">Координаты точки на карте. При смене адреса проверьте обе координаты.</p>
                <input value={draft.phone || ''} onChange={e => setDraft(v => ({...v, phone:e.target.value}))} placeholder="Телефон" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white" />
                <input value={draft.contactName || ''} onChange={e => setDraft(v => ({...v, contactName:e.target.value}))} placeholder="Контактное лицо" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white" />
                <input value={draft.priceText || ''} onChange={e => setDraft(v => ({...v, priceText:e.target.value}))} placeholder="Цена, напр. от 2500 ₽/ч" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white" />
                <input value={draft.hours || ''} onChange={e => setDraft(v => ({...v, hours:e.target.value}))} placeholder="Часы работы" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white" />
                <input value={draft.website || ''} onChange={e => setDraft(v => ({...v, website:e.target.value}))} placeholder="Официальный сайт" className="col-span-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white" />
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">Виды спорта</p>
                <div className="flex flex-wrap gap-1.5">
                  {SPORT_OPTIONS.map(item => {
                    const active = draft.sports.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setDraft(v => ({
                          ...v,
                          sports: active ? v.sports.filter(x => x !== item) : [...v.sports, item]
                        }))}
                        className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${active ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-slate-800 bg-slate-900 text-slate-500'}`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select value={draft.status} onChange={e => setDraft(v => ({...v, status:e.target.value as SportVenue['status']}))} className="rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-2.5 text-xs text-white">
                  <option value="curated">Отобрано</option>
                  <option value="needs_confirmation">Нужно подтвердить</option>
                  <option value="restricted">Аренду уточнить</option>
                </select>
                <input type="number" min="0" max="5" step="0.1" value={draft.rating ?? ''} onChange={e => setDraft(v => ({...v, rating:e.target.value ? Number(e.target.value) : undefined}))} placeholder="Рейтинг" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white" />
                <input type="number" min="0" value={draft.reviews ?? ''} onChange={e => setDraft(v => ({...v, reviews:e.target.value ? Number(e.target.value) : undefined}))} placeholder="Отзывы" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white" />
                <input value={(draft.amenities || []).join(', ')} onChange={e => setDraft(v => ({...v, amenities:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))} placeholder="Душ, парковка…" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white" />
              </div>

              <textarea value={draft.note || ''} onChange={e => setDraft(v => ({...v, note:e.target.value}))} rows={3} placeholder="Комментарий / условия аренды" className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white resize-none" />

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-300">Фото ({draft.photos?.length || 0}/8)</p>
                  <button type="button" disabled={uploading || (draft.photos?.length || 0) >= 8} onClick={() => fileInput.current?.click()} className="text-[10px] font-black text-emerald-400 disabled:text-slate-600 flex gap-1 items-center">
                    <ImagePlus className="w-3.5 h-3.5" /> {uploading ? 'Загрузка…' : 'Добавить'}
                  </button>
                </div>
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                {!!draft.photos?.length && (
                  <div className="grid grid-cols-3 gap-2">
                    {draft.photos.map((url, index) => (
                      <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-slate-700">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setDraft(v => ({...v, photos:(v.photos || []).filter((_, i) => i !== index)}))} className="absolute right-1 top-1 rounded-md bg-slate-950/90 p-1 text-rose-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center gap-2 text-[11px] text-slate-300">
                  <input type="checkbox" checked={draft.isPublished !== false} onChange={e => setDraft(v => ({...v, isPublished:e.target.checked}))} className="accent-emerald-500" />
                  Опубликовано
                </label>
                <label className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center gap-2 text-[11px] text-slate-300">
                  <input type="checkbox" checked={draft.isVerified === true} onChange={e => setDraft(v => ({...v, isVerified:e.target.checked}))} className="accent-emerald-500" />
                  Проверено SportBuddy
                </label>
              </div>

              <button type="button" disabled={busy} onClick={() => void save()} className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950 flex items-center justify-center gap-1.5">
                <Save className="w-4 h-4" /> Сохранить площадку
              </button>
            </div>
          )}

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {venues.map(venue => (
              <div key={venue.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-black text-white truncate">{venue.name}</p>
                      {venue.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-500 truncate">{venue.address}</p>
                    <p className="mt-1 text-[9px] text-slate-400">{venue.sports.join(' • ')}</p>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" title={venue.isPublished === false ? 'Опубликовать' : 'Скрыть'} onClick={() => void togglePublish(venue)} className="p-1.5 rounded-lg bg-slate-900 text-slate-400">
                      {venue.isPublished === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button type="button" onClick={() => beginEdit(venue)} className="p-1.5 rounded-lg bg-slate-900 text-amber-300"><Pencil className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => void remove(venue)} className="p-1.5 rounded-lg bg-slate-900 text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5 text-[9px]">
                  <span className={`px-2 py-1 rounded-lg border ${venue.isPublished === false ? 'border-slate-700 text-slate-500' : 'border-emerald-500/30 text-emerald-300'}`}>
                    {venue.isPublished === false ? 'Черновик' : 'В приложении'}
                  </span>
                  {venue.isVerified && (
                    <span className="px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Проверено
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
