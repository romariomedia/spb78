import { venueLocation } from '../lib/venueLocation';
import { apiBase } from './serverApi';
import { validVenueCoordinates } from '../../shared/venue-location.js';
import { SPB_VENUES, SportVenue } from '../lib/venues';
import { getAdminSession } from './adminAuth';

const CACHE_KEY = 'sportbuddy_places_cache_v1';

function normalizeVenue(raw: Partial<SportVenue> & { id: string }): SportVenue {
  return {
    id: raw.id,
    name: String(raw.name || ''),
    sports: Array.isArray(raw.sports) ? raw.sports.map(String).filter(Boolean) : [],
    address: String(raw.address || ''),
    coordinates: validVenueCoordinates(raw.coordinates) ? raw.coordinates : undefined,
    phone: raw.phone ? String(raw.phone) : undefined,
    hours: raw.hours ? String(raw.hours) : undefined,
    priceText: raw.priceText ? String(raw.priceText) : undefined,
    rating: Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : undefined,
    reviews: Number.isFinite(Number(raw.reviews)) ? Number(raw.reviews) : undefined,
    website: raw.website ? String(raw.website) : undefined,
    status: raw.status === 'restricted' || raw.status === 'needs_confirmation' ? raw.status : 'curated',
    note: raw.note ? String(raw.note) : undefined,
    photos: Array.isArray(raw.photos) ? raw.photos.map(String).filter(Boolean).slice(0, 8) : [],
    isVerified: raw.isVerified === true,
    isPublished: raw.isPublished !== false,
    contactName: raw.contactName ? String(raw.contactName) : undefined,
    amenities: Array.isArray(raw.amenities) ? raw.amenities.map(String).filter(Boolean).slice(0, 20) : [],
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined
  };
}

function saveCache(venues: SportVenue[]): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(venues)); } catch { /* ignore */ }
}

function readCache(): SportVenue[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => normalizeVenue(v)) : [];
  } catch {
    return [];
  }
}

export function mergeVenueCatalog(managed: Array<Partial<SportVenue> & {id:string}>, includeUnpublished = false): SportVenue[] {
  const map = new Map<string, SportVenue>(SPB_VENUES.map(venue => [venue.id, normalizeVenue(venue)]));
  for (const raw of managed) {
    const id = String(raw.id || '').trim();
    if (!id) continue;
    if ((raw as { archived?: boolean }).archived === true || (!includeUnpublished && raw.isPublished === false)) {
      map.delete(id);
      continue;
    }
    const base = map.get(id);
    map.set(id, normalizeVenue({ ...(base || { id }), ...raw, id }));
  }
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
}

async function loadManagedVenues(includeUnpublished:boolean): Promise<Array<Partial<SportVenue> & {id:string; archived?:boolean}>> {
  if (includeUnpublished) {
    const session = getAdminSession();
    if (session) {
      const response = await fetch(`${apiBase()}/api/admin-mutate-venue`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({sessionId:session.sessionId,operation:'list'})
      });
      const data = await response.json().catch(()=>({})) as {venues?:Array<Partial<SportVenue> & {id:string; archived?:boolean}>;error?:string};
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      return Array.isArray(data.venues) ? data.venues : [];
    }
  }
  const response = await fetch(`${apiBase()}/api/venues`);
  const data = await response.json().catch(()=>({})) as {venues?:Array<Partial<SportVenue> & {id:string; archived?:boolean}>;error?:string};
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return Array.isArray(data.venues) ? data.venues : [];
}

export async function refreshVenues(includeUnpublished = false): Promise<SportVenue[]> {
  try {
    const managed = await loadManagedVenues(includeUnpublished);
    const merged = mergeVenueCatalog(managed)
      .filter(venue => includeUnpublished || venue.isPublished !== false);
    saveCache(merged);
    return merged;
  } catch {
    const cached = readCache().filter(venue => includeUnpublished || venue.isPublished !== false);
    if (cached.length) return cached;
    return SPB_VENUES.filter(venue => includeUnpublished || venue.isPublished !== false);
  }
}

export async function adminMutateVenue(payload: {
  operation: 'create' | 'update' | 'delete' | 'seed';
  venueId?: string;
  venue?: Partial<SportVenue>;
  patch?: Partial<SportVenue>;
  venues?: SportVenue[];
}): Promise<void> {
  const session = getAdminSession();
  if (!session) throw new Error('admin-otp-required');

  const response = await fetch(`${apiBase()}/api/admin-mutate-venue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: session.sessionId, ...payload })
  });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
}

export async function seedVenueCatalog(): Promise<void> {
  await adminMutateVenue({ operation: 'seed', venues: SPB_VENUES });
}

/** Full administrative catalog; never place unpublished entries in the public cache. */
export async function loadOfficialTrainingVenues(): Promise<SportVenue[]> {
  if (!getAdminSession()) throw new Error('admin-otp-required');
  return mergeVenueCatalog(await loadManagedVenues(true), true).map(venue => ({ ...venue, coordinates: venueLocation(venue) }));
}
