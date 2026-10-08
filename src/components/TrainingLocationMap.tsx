import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Point = { lat: number; lng: number };
const startIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border:3px solid white;border-radius:50%;background:#a3e635;box-shadow:0 2px 14px #0008"></div>',
  iconSize: [28, 28], iconAnchor: [14, 14],
});
function Controls({ point, onChange }: { point: Point | null; onChange: (point: Point) => void }) {
  const map = useMap();
  useMapEvents({ click: event => onChange({ lat: event.latlng.lat, lng: event.latlng.wrap().lng }) });
  useEffect(() => {
    if (point) map.panTo([point.lat, point.lng]);
  }, [map, point?.lat, point?.lng]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
export default function TrainingLocationMap({ point, onChange }: { point: Point | null; onChange: (point: Point) => void }) {
  return <div className="relative z-0 overflow-hidden rounded-2xl border border-slate-700" aria-label="Карта выбора места старта">
    <MapContainer center={point || { lat: 59.9386, lng: 30.3141 }} zoom={point ? 15 : 11} scrollWheelZoom={false} style={{ height: 320, width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' maxZoom={19}/>
      <Controls point={point} onChange={onChange}/>
      {point && <Marker position={point} icon={startIcon} draggable title="Место старта — перетащите для уточнения" eventHandlers={{ dragend: event => {
        const value = (event.target as L.Marker).getLatLng().wrap();
        onChange({ lat: value.lat, lng: value.lng });
      } }}/>}
    </MapContainer>
  </div>;
}
