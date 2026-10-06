import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SportVenue } from '../lib/venues';
import { venueLocation } from '../lib/venueLocation';
import { venuePrice } from '../lib/venuePricing';

function FitVenues({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 15 });
    else map.setView([59.9386, 30.3141], 11);
  }, [map, points]);
  return null;
}

export default function VenuesMap({ venues, onSelect }: { venues: SportVenue[]; onSelect: (venue: SportVenue) => void }) {
  const [tileError, setTileError] = useState(false);
  const groups = useMemo(() => {
    const grouped = new Map<string, { point: [number, number]; venues: SportVenue[] }>();
    for (const venue of venues) {
      const p = venueLocation(venue);
      if (!p) continue;
      const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
      const group = grouped.get(key) ?? { point: [p.lat, p.lng] as [number, number], venues: [] };
      group.venues.push(venue); grouped.set(key, group);
    }
    return [...grouped.values()];
  }, [venues]);
  const points = useMemo(() => groups.map(g => g.point), [groups]);
  const missing = venues.filter(v => !venueLocation(v));
  return <section aria-label="Карта спортивных площадок" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
      <span>На карте: <strong className="text-emerald-300">{venues.length - missing.length}</strong> из {venues.length}</span>
      <span>Нажмите на метку, чтобы выбрать площадку</span>
    </div>
    {tileError && <p role="status" className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">Не удалось загрузить часть карты. Проверьте соединение или перейдите к списку площадок.</p>}
    <div className="relative isolate z-0 overflow-hidden rounded-3xl border border-slate-700" style={{height:'min(62dvh, 560px)', minHeight:320}}>
      <MapContainer center={[59.9386,30.3141]} zoom={11} scrollWheelZoom={false} style={{height:'100%',width:'100%'}}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' eventHandlers={{tileerror:()=>setTileError(true)}} />
        <FitVenues points={points} />
        {groups.map(group => <Marker key={group.venues.map(v=>v.id).join('|')} position={group.point}
          title={group.venues.map(v=>v.name).join(', ')}
          icon={L.divIcon({className:'sportbuddy-venue-marker',html:`<div style="width:36px;height:36px;border-radius:12px;background:#bef264;color:#0f172a;border:2px solid white;display:grid;place-items:center;font-weight:900;box-shadow:0 3px 12px #0006">${group.venues.length > 1 ? group.venues.length : '●'}</div>`,iconSize:[36,36],iconAnchor:[18,36],popupAnchor:[0,-32]})}>
          <Popup maxWidth={285} minWidth={230}>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {group.venues.map(venue=><div key={venue.id} className="border-b border-slate-700 pb-3 last:border-0">
                <strong className="block text-sm">{venue.name}</strong>
                <span className="mt-1 block text-xs text-slate-400">{venue.address}</span>
                <span className="mt-1 block text-xs text-slate-300">{venue.sports.join(' · ')}</span>
                <span className="mt-2 block text-xs font-bold text-emerald-300">{venuePrice(venue).text}</span>
                <span className="mt-1 block text-[11px] text-slate-400">{venuePrice(venue).condition}</span>
                <button type="button" onClick={()=>onSelect(venue)} className="mt-3 w-full rounded-xl bg-emerald-400 px-3 py-2.5 text-xs font-bold text-slate-950">Открыть площадку</button>
              </div>)}
            </div>
          </Popup>
        </Marker>)}
      </MapContainer>
    </div>
    <p className="text-[11px] text-slate-500">Метки показывают расположение по адресу. Вход и место встречи уточняйте у площадки.</p>
    {missing.length > 0 && <details className="rounded-2xl border border-slate-800 p-3 text-xs text-slate-400">
      <summary className="cursor-pointer">Уточняем расположение: {missing.length}</summary>
      <div className="mt-2 space-y-1">{missing.map(v=><button key={v.id} type="button" onClick={()=>onSelect(v)} className="block w-full py-2 text-left text-emerald-300">{v.name} →</button>)}</div>
    </details>}
  </section>;
}
