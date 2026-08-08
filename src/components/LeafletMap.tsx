import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, ExternalLink, Activity, Users as UsersIcon } from 'lucide-react';
import { getAddressFromCoords, GeocodeResult } from '../services/geocoding';
import { triggerHapticImpact } from '../services/native';
import { UserProfile, Training } from '../lib/types';


/** Добавляет небольшой безопасный сдвиг (офсет ~250м) для защиты точного адреса на карте. */
function obfuscateCoords(lat: number, lng: number, seedStr: string): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  const offsetKm = 0.25;
  const dLat = (offsetKm / 111) * Math.cos(angle);
  const dLng = (offsetKm / (111 * Math.cos(lat * (Math.PI / 180)))) * Math.sin(angle);
  return { lat: lat + dLat, lng: lng + dLng };
}

interface LeafletMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  users?: UserProfile[];
  trainings?: Training[];
  selectedCoords?: { lat: number; lng: number } | null;
  onSelectPoint?: (coords: { lat: number; lng: number }, address: GeocodeResult) => void;
  onSelectTraining?: (training: Training) => void;
  onSelectUser?: (user: UserProfile) => void;
  height?: string;
  interactiveSelect?: boolean;
}

// Custom Leaflet Div Icons for high native aesthetic
const userMarkerIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `<div style="background: #0ea5e9; border: 3px solid #f8fafc; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.5); font-size: 16px;">🏃‍♀️</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18]
});

const myLocationIcon = L.divIcon({
  className: 'custom-my-marker',
  html: `<div style="background: #10b981; border: 3px solid #ffffff; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(16, 185, 129, 0.8); animation: pulse 2s infinite;">📍</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -19]
});

const trainingMarkerIcon = L.divIcon({
  className: 'custom-training-marker',
  html: `<div style="background: #f59e0b; border: 3px solid #1e293b; border-radius: 12px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.6);">🔥</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 38],
  popupAnchor: [0, -38]
});

const selectedPointIcon = L.divIcon({
  className: 'custom-selected-point',
  html: `<div style="background: #ef4444; border: 3px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); width: 32px; height: 32px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.7);"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// Helper component to bind click events on Leaflet Map
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// Helper component to center map when coords change significantly
function MapCentering({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center.lat, center.lng, map]);
  return null;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center,
  zoom = 13,
  users = [],
  trainings = [],
  selectedCoords,
  onSelectPoint,
  onSelectTraining,
  onSelectUser,
  height = "400px",
  interactiveSelect = false
}) => {
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [clickedAddress, setClickedAddress] = useState<GeocodeResult | null>(null);
  const [tempCoords, setTempCoords] = useState<{ lat: number; lng: number } | null>(selectedCoords || null);

  const handleMapClick = async (lat: number, lng: number) => {
    triggerHapticImpact('light');
    setTempCoords({ lat, lng });
    
    if (interactiveSelect || onSelectPoint) {
      setLoadingAddress(true);
      try {
        const addr = await getAddressFromCoords(lat, lng);
        setClickedAddress(addr);
        if (onSelectPoint) {
          onSelectPoint({ lat, lng }, addr);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAddress(false);
      }
    }
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900 z-0">
      <div style={{ height, width: '100%' }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={zoom}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          attributionControl={false}
        >
          {/* OpenStreetMap dark/hot compatible standard tile layer */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            className="filter brightness-90 contrast-125 saturate-50"
          />

          <MapCentering center={center} />
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Current user location marker */}
          <Marker position={[center.lat, center.lng]} icon={myLocationIcon}>
            <Popup className="rounded-2xl bg-slate-900 text-slate-100 p-2">
              <div className="text-center font-bold text-emerald-400 flex items-center gap-1 justify-center">
                <MapPin className="w-4 h-4" /> Ваша текущая позиция
              </div>
              <p className="text-xs text-slate-400 mt-1">Здесь ищутся ближайшие напарники и тренировки</p>
            </Popup>
          </Marker>

          {/* Users Discovery Markers */}
          {users.map((user) => {
            const obfuscated = obfuscateCoords(user.lat, user.lng, user.id);
            return (
              <Marker
              key={user.id}
              position={[obfuscated.lat, obfuscated.lng]}
              icon={userMarkerIcon}
              eventHandlers={{
                click: () => {
                  triggerHapticImpact('light');
                  if (onSelectUser) onSelectUser(user);
                }
              }}
            >
              <Popup>
                <div className="p-1 min-w-[160px] text-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover border border-emerald-500" />
                    <div>
                      <h4 className="font-bold text-sm leading-tight text-white">{user.name}, {user.age}</h4>
                      <div className="flex items-center text-xs text-amber-400 font-semibold">
                        ★ {user.rating.toFixed(1)} <span className="text-slate-400 font-normal ml-1">({user.totalWorkouts} к)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {user.sports.slice(0, 2).map((s, i) => (
                      <span key={i} className="text-[10px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded-full border border-slate-700">
                        {s}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => onSelectUser && onSelectUser(user)}
                    className="w-full mt-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-1 px-2 rounded-lg text-xs transition flex items-center justify-center gap-1"
                  >
                    <UsersIcon className="w-3 h-3" /> Посмотреть анкету
                  </button>
                </div>
              </Popup>
            </Marker>
            );
          })}

          {/* Trainings Markers */}
          {trainings.map((tr) => (
            <Marker
              key={tr.id}
              position={[tr.lat, tr.lng]}
              icon={trainingMarkerIcon}
              eventHandlers={{
                click: () => {
                  triggerHapticImpact('light');
                  if (onSelectTraining) onSelectTraining(tr);
                }
              }}
            >
              <Popup>
                <div className="p-1 min-w-[180px] text-slate-100">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 mb-1 border border-amber-500/30">
                    {tr.sport} • {tr.level === 'pro' ? 'Профи' : tr.level === 'semi-pro' ? 'Любитель+' : 'Начинающие'}
                  </span>
                  <h4 className="font-bold text-sm text-white leading-tight mb-1">{tr.title}</h4>
                  <p className="text-xs text-slate-300 mb-2 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400" /> {tr.dateLabel} ({tr.time})
                  </p>
                  <div className="flex justify-between items-center text-xs bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
                    <span>Мест: {tr.participantIds.length} / {tr.participantsMax}</span>
                    <button
                      onClick={() => onSelectTraining && onSelectTraining(tr)}
                      className="text-emerald-400 font-bold flex items-center gap-1 hover:underline text-xs"
                    >
                      Открыть <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Interactive Selected Point Marker */}
          {tempCoords && interactiveSelect && (
            <Marker position={[tempCoords.lat, tempCoords.lng]} icon={selectedPointIcon}>
              <Popup>
                <div className="p-1 text-slate-100 min-w-[160px]">
                  <div className="font-bold text-red-400 text-xs flex items-center gap-1 mb-1">
                    <MapPin className="w-3.5 h-3.5" /> Выбранная точка
                  </div>
                  {loadingAddress ? (
                    <p className="text-xs text-slate-400 animate-pulse">Определение адреса...</p>
                  ) : clickedAddress ? (
                    <div>
                      <p className="font-semibold text-xs text-slate-200 leading-tight">{clickedAddress.shortAddress}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{clickedAddress.city}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300">Координаты: {tempCoords.lat.toFixed(4)}, {tempCoords.lng.toFixed(4)}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Interactive Selection Notification Bar overlay */}
      {interactiveSelect && tempCoords && (
        <div className="absolute bottom-3 left-3 right-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-2xl shadow-xl z-10 flex items-center justify-between transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-slate-200">Локация для тренировки выбрана</h5>
              <p className="text-xs text-emerald-400 font-semibold truncate max-w-[200px]">
                {loadingAddress ? 'Поиск адреса...' : clickedAddress?.shortAddress || `${tempCoords.lat.toFixed(3)}, ${tempCoords.lng.toFixed(3)}`}
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-lg border border-slate-700 font-mono">
            Кликните в другое место для смены
          </span>
        </div>
      )}
    </div>
  );
};
