// Admin-only SportBuddy Places CRUD. Writes are server-authoritative and
// require the same OTP session as official event management.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
  return result || undefined;
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

async function requireAdminSession(db, sessionId) {
  if (!sessionId) throw Object.assign(new Error('Session required.'), { status: 401 });
  const session = await db.doc(`adminSessions/${sessionId}`).get();
  if (!session.exists) throw Object.assign(new Error('Session not found.'), { status: 401 });
  const expiresAt = session.data()?.expiresAt?.toMillis?.() ?? 0;
  if (expiresAt <= Date.now()) throw Object.assign(new Error('Session expired.'), { status: 401 });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  const db = getFirestore();

  try {
    await requireAdminSession(db, body.sessionId);
    const operation = String(body.operation || '');

    if (operation === 'seed') {
      const venues = Array.isArray(body.venues) ? body.venues.slice(0, 100) : [];
      if (!venues.length) return res.status(400).json({ error: 'Venue list required.' });
      const batch = db.batch();
      for (const raw of venues) {
        const id = cleanString(raw?.id, 120);
        if (!id || id.includes('/')) continue;
        const venue = sanitizeVenue(raw, id);
        if (venue.name.length < 2 || venue.address.length < 3 || venue.sports.length < 1) continue;
        batch.set(db.collection('venues').doc(id), venue, { merge: true });
      }
      await batch.commit();
      return res.status(200).json({ ok: true, count: venues.length });
    }

    const venueId = cleanString(body.venueId, 120);
    if (!venueId || venueId.includes('/')) return res.status(400).json({ error: 'Venue id required.' });
    const ref = db.collection('venues').doc(venueId);

    if (operation === 'delete') {
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    if (operation !== 'create' && operation !== 'update') {
      return res.status(400).json({ error: 'Unknown operation.' });
    }

    const source = operation === 'create' ? body.venue : body.patch;
    if (!source || typeof source !== 'object') return res.status(400).json({ error: 'Venue payload required.' });

    if (operation === 'create') {
      const venue = sanitizeVenue(source, venueId);
      if (venue.name.length < 2 || venue.address.length < 3 || venue.sports.length < 1) {
        return res.status(400).json({ error: 'Name, address and at least one sport are required.' });
      }
      await ref.create(venue);
    } else {
      const before = await ref.get();
      if (!before.exists) return res.status(404).json({ error: 'Venue not found.' });
      const venue = sanitizeVenue({ ...before.data(), ...source }, venueId);
      if (venue.name.length < 2 || venue.address.length < 3 || venue.sports.length < 1) {
        return res.status(400).json({ error: 'Name, address and at least one sport are required.' });
      }
      await ref.set(venue, { merge: false });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    const status = Number(error?.status || 500);
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Venue mutation failed.' });
  }
}
