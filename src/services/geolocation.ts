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

export async function getCurrentCoords(): Promise<Coords> {
  try {
    // Check and request permissions if needed
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location === 'prompt' || permissions.location === 'prompt-with-rationale') {
      await Geolocation.requestPermissions();
    }
    
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 60000
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
  } catch (error) {
    console.warn('Capacitor Geolocation error or permission denied, falling back to default coords:', error);
    // Fallback to HTML5 Geolocation if available and Capacitor fails in browser
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(DEFAULT_COORDS),
          { timeout: 3000 }
        );
      } else {
        resolve(DEFAULT_COORDS);
      }
    });
  }
}

export function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}
