import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SPB_VENUES, SportVenue } from '../lib/venues';
import { getAdminSession } from './adminAuth';

const CACHE_KEY = 'sportbuddy_places_cache_v1';

function normalizeVenue(raw: Partial<SportVenue> & { id: string }): SportVenue {
  return {
    id: raw.id,
    name: String(raw.name || ''),
    sports: Array.isArray(raw.sports) ? raw.sports.map(String).filter(Boolean) : [],
    address: String(raw.address || ''),
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

export async function refreshVenues(includeUnpublished = false): Promise<SportVenue[]> {
  try {
    const snap = await getDocs(collection(db, 'venues'));
    const venues = snap.docs
      .map((doc) => normalizeVenue({ id: doc.id, ...(doc.data() as Omit<SportVenue, 'id'>) }))
      .filter((venue) => includeUnpublished || venue.isPublished !== false)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    // Firestore becomes authoritative as soon as the collection is populated.
    if (snap.size > 0) {
      saveCache(venues);
      return venues;
    }
  } catch {
    const cached = readCache().filter((venue) => includeUnpublished || venue.isPublished !== false);
    if (cached.length) return cached;
  }

  return SPB_VENUES.filter((venue) => includeUnpublished || venue.isPublished !== false);
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

  const response = await fetch('/api/admin-mutate-venue', {
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
