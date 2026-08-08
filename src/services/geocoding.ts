export interface GeocodeResult {
  displayName: string;
  shortAddress: string;
  city: string;
}

const geocodeCache = new Map<string, GeocodeResult>();

export async function getAddressFromCoords(lat: number, lng: number): Promise<GeocodeResult> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    const cached = geocodeCache.get(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'ru-RU, ru;q=0.9, en;q=0.8',
          'User-Agent': 'SportBuddy-MobileApp/8.0 (ru.sportbuddy.mobile; contact@sportbuddy.ru)'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed with status ${response.status}`);
    }

    const data = await response.json();
    const address = data.address || {};
    
    const road = address.road || address.pedestrian || address.path || address.suburb || address.neighbourhood || address.quarter || '';
    const houseNumber = address.house_number || '';
    const city = address.city || address.town || address.village || address.state || 'Санкт-Петербург';
    const place = address.amenity || address.leisure || address.stadium || address.park || address.building || '';

    let shortAddress = [place, road, houseNumber].filter(Boolean).join(', ');
    if (!shortAddress) {
      shortAddress = data.display_name ? data.display_name.split(',')[0] || `Локация (${lat.toFixed(3)}, ${lng.toFixed(3)})` : `Локация (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
    }

    const result: GeocodeResult = {
      displayName: data.display_name || `${shortAddress}, ${city}`,
      shortAddress: shortAddress || 'Спортивная площадка СПб',
      city: city || 'Санкт-Петербург'
    };

    geocodeCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('Geocoding error (offline or timeout):', error);
    const fallback: GeocodeResult = {
      displayName: `Спортивная локация (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      shortAddress: `Точка (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
      city: 'Санкт-Петербург'
    };
    return fallback;
  }
}
