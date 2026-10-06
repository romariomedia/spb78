import locations from './venueLocations.json';
import { validVenueCoordinates } from '../../shared/venue-location.js';
import type { SportVenue } from './venues';
interface CatalogLocation { lat: number; lng: number; address: string; sourceUrl: string; precision: string }
export function venueLocation(venue: SportVenue): { lat: number; lng: number } | null {
  if (validVenueCoordinates(venue.coordinates)) return venue.coordinates;
  const point = (locations as Record<string, CatalogLocation>)[venue.id];
  // A moved or renamed address must not keep the previous venue's marker.
  if (!point || point.address !== venue.address || !validVenueCoordinates(point)) return null;
  return { lat: point.lat, lng: point.lng };
}
