import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { validVenueCoordinates } from '../shared/venue-location.js';
import { requireAdminSession, writeAdminAudit } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

const SPORTS = new Set(['Футбол','Баскетбол','Волейбол','Теннис','Падел','Настольный теннис','Хоккей']);
const STATUSES = new Set(['curated','needs_confirmation','restricted']);

function cleanString(value, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function optionalString(value, max = 300) {
  const result = cleanString(value, max);
  return result || null;
}
function sanitizeVenue(input, id) {
  const sports = Array.isArray(input?.sports)
    ? [...new Set(input.sports.map(v => cleanString(v, 60)).filter(v => SPORTS.has(v)))].slice(0, 12)
    : [];
  const photos = Array.isArray(input?.photos)
    ? input.photos.map(v => cleanString(v, 1000)).filter(v => /^https:\/\//i.test(v)).slice(0, 8)
    : [];
  const amenities = Array.isArray(input?.amenities)
    ? [...new Set(input.amenities.map(v => cleanString(v, 80)).filter(Boolean))].slice(0, 20)
    : [];

  const rating = Number(input?.rating);
  const reviews = Number(input?.reviews);
  return {
    id,
    name: cleanString(input?.name, 160),
    sports,
    address: cleanString(input?.address, 300),
    coordinates: validVenueCoordinates(input?.coordinates) ? { lat: input.coordinates.lat, lng: input.coordinates.lng } : null,
    phone: optionalString(input?.phone, 80),
    hours: optionalString(input?.hours, 180),
    priceText: optionalString(input?.priceText, 180),
    rating: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null,
    reviews: Number.isInteger(reviews) && reviews >= 0 ? reviews : null,
    website: optionalString(input?.website, 1000),
    status: STATUSES.has(input?.status) ? input.status : 'needs_confirmation',
    note: optionalString(input?.note, 1000),
    photos,
    amenities,
    contactName: optionalString(input?.contactName, 160),
    isVerified: input?.isVerified === true,
    isPublished: input?.isPublished !== false,
    updatedAt: new Date().toISOString()
  };
}

function validateVenue(venue) {
  if (venue.name.length < 2 || venue.address.length < 3 || venue.sports.length < 1) {
    throw Object.assign(new Error('Name, address and at least one sport are required.'), { status: 400 });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  const db = getFirestore();

  try {
    const session = await requireAdminSession(db, body.sessionId);
    const operation = String(body.operation || '');

    if (operation === 'seed') {
      const venues = Array.isArray(body.venues) ? body.venues.slice(0, 100) : [];
      if (!venues.length) return res.status(400).json({ error: 'Venue list required.' });
      const batch = db.batch();
      let accepted = 0;
      for (const raw of venues) {
        const id = cleanString(raw?.id, 120);
        if (!id || id.includes('/')) continue;
        const venue = sanitizeVenue(raw, id);
        try { validateVenue(venue); } catch { continue; }
        batch.set(db.collection('venues').doc(id), venue, { merge: true });
        accepted++;
      }
      await batch.commit();
      await writeAdminAudit(db, session, {
        action:'venue.seed',
        entityType:'venueCatalog',
        entityId:'venues',
        after:{ accepted, submitted:venues.length },
        requestId:String(body.requestId || '')
      });
      return res.status(200).json({ ok: true, count: accepted });
    }

    const venueId = cleanString(body.venueId, 120);
    if (!venueId || venueId.includes('/')) return res.status(400).json({ error: 'Venue id required.' });
    const ref = db.collection('venues').doc(venueId);
    const beforeSnap = await ref.get();
    const before = beforeSnap.exists ? beforeSnap.data() : null;
    let after = null;

    if (operation === 'delete') {
      if (!beforeSnap.exists) return res.status(404).json({ error: 'Venue not found.' });
      await ref.delete();
    } else if (operation === 'create') {
      if (beforeSnap.exists) return res.status(409).json({ error: 'Venue already exists.' });
      const venue = sanitizeVenue(body.venue, venueId);
      validateVenue(venue);
      await ref.create(venue);
      after = venue;
    } else if (operation === 'update') {
      const source = beforeSnap.exists ? { ...before, ...(body.patch || {}) } : (body.patch || {});
      const venue = sanitizeVenue(source, venueId);
      validateVenue(venue);
      await ref.set(venue, { merge: false });
      after = venue;
    } else {
      return res.status(400).json({ error: 'Unknown operation.' });
    }

    await writeAdminAudit(db, session, {
      action:`venue.${operation}`,
      entityType:'venue',
      entityId:venueId,
      before,
      after,
      requestId:String(body.requestId || '')
    });
    return res.status(200).json({ ok:true, venue:after });
  } catch (error) {
    const status = Number(error?.status || 500);
    if (status === 500) console.error('[admin-mutate-venue]', error);
    return res.status(status).json({ error: status === 500 ? 'Venue mutation failed.' : error.message });
  }
}
