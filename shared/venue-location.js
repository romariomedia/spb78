/** Null/empty values must never become the real coordinate 0. */
export function validVenueCoordinates(value) {
  return !!value && typeof value.lat === 'number' && typeof value.lng === 'number' &&
    Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
    value.lat >= -90 && value.lat <= 90 && value.lng >= -180 && value.lng <= 180;
}
