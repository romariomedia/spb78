import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Building2, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ExternalLink,
  MapPin, Phone, Search, ShieldCheck, Star, Trophy, X
} from 'lucide-react';
import {
  SPB_VENUES, VENUE_SPORT_FILTERS, SportVenue, venueMapUrl, venueScore
} from '../lib/venues';
import { refreshVenues } from '../services/venues';
import { venueCover } from '../lib/venueCovers';
import { venuePrice } from '../lib/venuePricing';
import { triggerHapticImpact } from '../services/native';

interface PlacesSectionProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTraining: (venue: SportVenue) => void;
}

type SortMode = 'recommended' | 'rating' | 'reviews';

const STATUS_COPY: Record<SportVenue['status'], { label: string; className: string; description: string }> = {
  curated: {
    label: 'Отобрано SportBuddy',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    description: 'Карточка собрана из открытых и официальных источников. Перед арендой подтвердите цену и время у площадки.'
  },
  needs_confirmation: {
    label: 'Требует подтверждения',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    description: 'Площадка реальная, но условия аренды, цена или контакты требуют дополнительной проверки.'
  },
  restricted: {
    label: 'Аренду нужно уточнить',
    className: 'border-slate-600 bg-slate-800 text-slate-300',
    description: 'Известный объект. Не обещаем почасовую аренду: сначала свяжитесь с администрацией.'
  }
};

function sportEmoji(sport: string): string {
  if (sport === 'Футбол') return '⚽';
  if (sport === 'Баскетбол') return '🏀';
  if (sport === 'Волейбол') return '🏐';
  if (sport === 'Теннис' || sport === 'Падел') return '🎾';
  if (sport === 'Настольный теннис') return '🏓';
  if (sport === 'Хоккей') return '🏒';
  return '🏟️';
}

const VenueHero: React.FC<{ venue: SportVenue; compact?: boolean }> = ({ venue, compact = false }) => {
  const cover = venueCover(venue);
  const ownPhoto = venue.photos?.[0];
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => setFailed([]), [venue.id, ownPhoto, cover.url]);
  const image = [ownPhoto, cover.url].find(url => url && !failed.includes(url));
  const editorialPhoto = image === cover.url && !!image;
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-emerald-500/20 via-slate-900 to-slate-950 ${compact ? 'h-40 sm:h-48' : 'h-64'}`}>
      {image ? (
        <img src={image} alt={`${venue.name}: фото объекта`} className="h-full w-full object-cover"
          loading={compact ? 'lazy' : 'eager'} decoding="async" referrerPolicy="no-referrer"
          onError={() => setFailed(previous => [...previous, image])} />
      ) : (
        <div className="flex h-full items-center justify-center gap-4 px-6 text-slate-400">
          <Building2 className="h-10 w-10 shrink-0 text-emerald-300/50" />
          <div><p className="text-xs font-bold text-slate-200">{venue.name}</p>
            <p className="mt-1 text-[11px]">Фото площадки уточняется</p></div>
        </div>
      )}
      {image && <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-slate-950/70 px-2.5 py-1 text-[9px] font-bold text-white backdrop-blur-md">Фото объекта</span>}
      {editorialPhoto && !compact && (
        <a href={cover.sourceUrl} target="_blank" rel="noreferrer"
          className="absolute bottom-3 right-3 z-10 max-w-[80%] rounded-xl bg-slate-950/80 px-3 py-2 text-[10px] text-slate-200 backdrop-blur-md">
          {cover.sourceLabel}{cover.license ? ` · ${cover.license}` : ''} ↗
          {cover.credit && <span className="block text-[9px] text-slate-400">{cover.credit}</span>}
        </a>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/50 to-transparent" />
    </div>
  );
};

const VenuePriceInfo: React.FC<{ venue: SportVenue; compact?: boolean }> = ({ venue, compact = false }) => {
  const price = venuePrice(venue);
  return (
    <div className={compact ? 'mt-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5' : 'mt-1'}>
      <p className="text-sm font-black text-emerald-300">{price.text}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{price.condition}</p>
      {!compact && price.sourceUrl && <>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{price.note} Итоговую цену и свободное время подтвердите перед арендой.</p>
        <a href={price.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-300">
          Тариф на сайте площадки <ExternalLink className="h-3 w-3" />
        </a>
        <p className="mt-1 text-[10px] text-slate-500">Проверено {price.checkedAt?.split('-').reverse().join('.')}</p>
      </>}
    </div>
  );
};

const VenueGallery: React.FC<{ venue: SportVenue }> = ({ venue }) => {
  const photos = venue.photos?.filter(Boolean) ?? [];
  const [index, setIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => setIndex(0), [venue.id]);

  if (!photos.length) return <VenueHero venue={venue} />;

  const go = (next: number) => {
    const normalized = (next + photos.length) % photos.length;
    setIndex(normalized);
  };

  return (
    <div
      className="relative h-[46vh] min-h-[260px] max-h-[430px] overflow-hidden bg-slate-950"
      onTouchStart={event => setTouchStart(event.touches[0]?.clientX ?? null)}
      onTouchEnd={event => {
        if (touchStart === null) return;
        const end = event.changedTouches[0]?.clientX ?? touchStart;
        const delta = end - touchStart;
        if (Math.abs(delta) > 45) go(index + (delta < 0 ? 1 : -1));
        setTouchStart(null);
      }}
    >
      <img
        src={photos[index]}
        alt={`${venue.name}: фото ${index + 1}`}
        className="h-full w-full object-cover"
        loading="eager"
      />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Предыдущее фото"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/70 border border-white/10 backdrop-blur flex items-center justify-center active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Следующее фото"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/70 border border-white/10 backdrop-blur flex items-center justify-center active:scale-95"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-1.5">
            {photos.map((_, dot) => (
              <button
                key={dot}
                type="button"
                aria-label={`Фото ${dot + 1}`}
                onClick={() => setIndex(dot)}
                className={`h-1.5 rounded-full transition-all ${dot === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
          <div className="absolute top-3 right-3 rounded-full bg-slate-950/70 border border-white/10 px-2.5 py-1 text-[10px] font-black backdrop-blur">
            {index + 1}/{photos.length}
          </div>
        </>
      )}
    </div>
  );
};

export const PlacesSection: React.FC<PlacesSectionProps> = ({ isOpen, onClose, onCreateTraining }) => {
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<string>('Все');
  const [sort, setSort] = useState<SortMode>('recommended');
  const [selected, setSelected] = useState<SportVenue | null>(null);
  const [showOnlyReady, setShowOnlyReady] = useState(false);
  const [catalog, setCatalog] = useState<SportVenue[]>(SPB_VENUES);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let cancelled = false;
    setCatalogLoading(true);
    void refreshVenues(false)
      .then(items => { if (!cancelled) setCatalog(items); })
      .finally(() => { if (!cancelled) setCatalogLoading(false); });
    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setSelected(null);
  }, [isOpen]);

  const venues = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ru-RU');
    const list = catalog.filter(venue => {
      if (showOnlyReady && venue.status !== 'curated') return false;
      if (sport !== 'Все' && !venue.sports.includes(sport)) return false;
      if (!q) return true;
      return [venue.name, venue.address, ...venue.sports].some(value =>
        value.toLocaleLowerCase('ru-RU').includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === 'reviews') return (b.reviews ?? 0) - (a.reviews ?? 0);
      return venueScore(b) - venueScore(a);
    });
  }, [catalog, query, sport, sort, showOnlyReady]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950 text-white overflow-y-auto overscroll-contain [padding-bottom:env(safe-area-inset-bottom)]">
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl [padding-top:env(safe-area-inset-top)]">
        <div className="mx-auto max-w-3xl px-4 py-2.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => { triggerHapticImpact('light'); selected ? setSelected(null) : onClose(); }}
            className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center active:scale-95"
            aria-label={selected ? 'Назад к площадкам' : 'Закрыть площадки'}
          >
            {selected ? <ArrowLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-400 font-black">SportBuddy Places</p>
            <h2 className="text-base font-black truncate">{selected ? selected.name : 'Площадки Санкт-Петербурга'}</h2>
          </div>
          {!selected && (
            <span className="text-[11px] font-black px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              {venues.length} из {catalog.length}
            </span>
          )}
        </div>
      </div>

      {selected ? (
        <div className="mx-auto max-w-3xl pb-28">
          <VenueGallery venue={selected} />

          <div className="px-4 -mt-3 relative z-10 space-y-4">
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-black">{selected.name}</h3>
                  <p className="mt-1 text-xs text-slate-400 flex gap-1.5 items-start">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    {selected.address}
                  </p>
                </div>
                {selected.rating && (
                  <div className="shrink-0 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-2.5 py-2 text-center">
                    <p className="font-black text-amber-300 flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current" />{selected.rating.toFixed(1)}</p>
                    {selected.reviews ? <p className="text-[9px] text-slate-500">{selected.reviews} отзывов</p> : null}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {selected.sports.map(item => (
                  <span key={item} className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-800 border border-slate-700 text-slate-200">
                    {sportEmoji(item)} {item}
                  </span>
                ))}
              </div>

              <div className={`mt-4 rounded-2xl border p-3 ${STATUS_COPY[selected.status].className}`}>
                <p className="text-xs font-black flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> {selected.isVerified ? 'Проверено SportBuddy' : STATUS_COPY[selected.status].label}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                  {selected.isVerified
                    ? 'Площадка напрямую подтвердила карточку SportBuddy. Цена и свободное время всё равно согласовываются с владельцем.'
                    : STATUS_COPY[selected.status].description}
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold">Цена</p>
                <VenuePriceInfo venue={selected} />
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold">Часы работы</p>
                <p className="mt-1 text-sm font-black text-white">{selected.hours || 'Уточнить'}</p>
              </div>
            </section>

            {!!selected.amenities?.length && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-3.5">
                <p className="text-[10px] uppercase tracking-wide font-black text-slate-500 mb-2">Удобства</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.amenities.map(item => (
                    <span key={item} className="rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-slate-300">
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {selected.note && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-3.5 text-xs text-slate-300 leading-relaxed">
                {selected.note}
              </section>
            )}

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4 space-y-2">
              <h4 className="text-sm font-black">Связаться с площадкой</h4>
              <p className="text-[11px] text-slate-400">
                SportBuddy пока не бронирует время. Сначала самостоятельно подтвердите аренду у площадки.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {selected.phone ? (
                  <a
                    href={`tel:${selected.phone.replace(/[^+\d]/g, '')}`}
                    className="min-h-12 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs py-3 flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Phone className="w-4 h-4" /> Позвонить
                  </a>
                ) : (
                  <button disabled className="rounded-2xl bg-slate-800 text-slate-500 font-black text-xs py-3">Телефон уточняется</button>
                )}
                <a
                  href={venueMapUrl(selected)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-12 rounded-2xl bg-slate-800 border border-slate-700 text-white font-black text-xs py-3 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <MapPin className="w-4 h-4" /> На карте
                </a>
              </div>
              {selected.website && (
                <a
                  href={selected.website}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 font-bold text-xs py-3 flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" /> Сайт площадки
                </a>
              )}
            </section>

            <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 mb-24">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-200">Организуйте тренировку здесь</h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                    Сначала договоритесь с площадкой о времени. SportBuddy не бронирует аренду автоматически.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl p-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-3xl">
              <button
                type="button"
                disabled={selected.status === 'restricted'}
                onClick={() => {
                  triggerHapticImpact('medium');
                  onCreateTraining(selected);
                }}
                className="w-full min-h-14 rounded-2xl bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-sm px-4 flex items-center justify-center gap-2 active:scale-[0.99] shadow-[0_0_24px_rgba(16,185,129,0.25)]"
              >
                <CheckCircle2 className="w-4 h-4" />
                {selected.status === 'restricted' ? 'Сначала уточните аренду' : 'Создать тренировку здесь'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl px-4 py-4 pb-28 space-y-4">
          <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-slate-900 to-slate-950 p-4">
            <div className="flex gap-3 items-start">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black">Одна база спортивных площадок Петербурга</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                  Сравнивайте площадки, цены и контакты. Бронирование выполняется напрямую у владельца — SportBuddy не скрывает контакты и не добавляет комиссию.
                </p>
              </div>
            </div>
          </section>

          <div className="sticky z-20 bg-slate-950/95 backdrop-blur-xl pt-1 pb-2 -mx-4 px-4 [top:calc(64px+env(safe-area-inset-top))]">
            <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Название, адрес или вид спорта"
              className="w-full min-h-12 rounded-2xl border border-slate-800 bg-slate-900 pl-10 pr-4 py-3 text-sm outline-none focus:border-emerald-500 placeholder:text-slate-600"
            />
            </div>

          <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {VENUE_SPORT_FILTERS.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => { triggerHapticImpact('light'); setSport(item); }}
                className={`px-3 py-2 rounded-xl text-[11px] font-black whitespace-nowrap border transition ${
                  sport === item
                    ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                {item === 'Все' ? 'Все' : `${sportEmoji(item)} ${item}`}
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowOnlyReady(value => !value)}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold border ${
                showOnlyReady ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              ✓ Только отобранные
            </button>
            <select
              value={sort}
              onChange={event => setSort(event.target.value as SortMode)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-[11px] font-bold text-slate-300"
            >
              <option value="recommended">Рекомендуемые</option>
              <option value="rating">По рейтингу</option>
              <option value="reviews">По отзывам</option>
            </select>
          </div>
          </div>

          <div className="space-y-3">
            {catalogLoading && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-center text-xs font-bold text-slate-500">
                Обновляем данные площадок…
              </div>
            )}
            {venues.map(venue => (
              <button
                key={venue.id}
                type="button"
                onClick={() => { triggerHapticImpact('light'); setSelected(venue); }}
                className="w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-left active:scale-[0.995] transition shadow-xl touch-manipulation"
              >
                <VenueHero venue={venue} compact />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="font-black text-sm truncate">{venue.name}</h3>
                        {venue.isVerified && (
                          <span className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black text-emerald-300">
                            ✓ Проверено
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 truncate">{venue.address}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 mt-1" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                    {venue.rating ? (
                      <span className="flex items-center gap-1 text-amber-300 font-black">
                        <Star className="w-3 h-3 fill-current" /> {venue.rating.toFixed(1)}
                        {venue.reviews ? <span className="text-slate-500 font-medium">({venue.reviews})</span> : null}
                      </span>
                    ) : null}

                    {venue.hours ? <span className="flex items-center gap-1 text-slate-400"><Clock3 className="w-3 h-3" />{venue.hours}</span> : null}
                  </div>
                  <VenuePriceInfo venue={venue} compact />
                  <div className="mt-3 flex flex-wrap gap-1">
                    {venue.sports.slice(0, 4).map(item => (
                      <span key={item} className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-1 text-[9px] font-bold text-slate-400">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}

            {venues.length === 0 && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center">
                <MapPin className="w-8 h-8 mx-auto text-slate-600" />
                <h3 className="mt-3 font-black">Площадок по фильтру не найдено</h3>
                <p className="mt-1 text-xs text-slate-500">Сбросьте фильтры или попробуйте другой запрос.</p>
              </div>
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-slate-600 text-center px-4">
            Цены, режим работы и доступность могут измениться. Всегда подтверждайте условия непосредственно у площадки.
          </p>
        </div>
      )}
    </div>
  );
};
