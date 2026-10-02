import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface Coords {
  lat: number;
  lng: number;
}

// Default Coordinates: Krestovsky Island & Primorsky Park of Victory, Saint Petersburg
export const DEFAULT_COORDS: Coords = {
  lat: 59.9727,
  lng: 30.2372
};

export function validCoords(coords: Coords): boolean {
  return Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
    && Math.abs(coords.lat) <= 90 && Math.abs(coords.lng) <= 180;
}

export async function getCurrentCoords(options: { fresh?: boolean } = {}): Promise<Coords> {
  try {
    const settings = { enableHighAccuracy: true, timeout: 15000, maximumAge: options.fresh ? 0 : 60000 };
    let position;
    if (Capacitor.isNativePlatform()) {
      let permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
        permissions = await Geolocation.requestPermissions();
      }
      if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
        throw { code: 1 };
      }
      position = await Geolocation.getCurrentPosition(settings);
    } else {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        throw new Error('Геолокация недоступна. Откройте сайт по HTTPS в поддерживаемом браузере.');
      }
      position = await new Promise<GeolocationPosition>((resolve, reject) => {
        const timer = setTimeout(() => reject({ code: 3 }), 20000);
        navigator.geolocation.getCurrentPosition(
          value => { clearTimeout(timer); resolve(value); },
          error => { clearTimeout(timer); reject(error); }, settings
        );
      });
    }
    const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
    if (!validCoords(coords)) throw new Error('Устройство вернуло некорректные координаты. Повторите определение местоположения.');
    if (options.fresh && (!Number.isFinite(position.coords.accuracy) || position.coords.accuracy > 150)) {
      throw new Error('Недостаточная точность геолокации. Включите точное местоположение и повторите попытку на открытом месте.');
    }
    return coords;
  } catch (error) {
    const code = (error as { code?: string | number })?.code;
    if (code === 1 || code === 'OS-PLUG-GLOC-0003') throw new Error('Доступ к геолокации запрещён. Разрешите местоположение в настройках сайта или приложения.');
    if (code === 3 || code === 'OS-PLUG-GLOC-0010') throw new Error('Не удалось определить местоположение вовремя. Включите геолокацию и попробуйте ещё раз.');
    if (error instanceof Error && !code) throw error;
    throw new Error('Не удалось определить местоположение. Проверьте, включена ли геолокация устройства.');
  }
}

export function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return R * c;
}
