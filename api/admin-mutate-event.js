import { randomUUID } from 'node:crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { enqueueNotification } from '../server/notification-policy.js';
import { requireAdminSession, writeAdminAudit } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

const CATEGORIES = new Set(['competition','contest','festival','masterclass','charity','spectator']);
const STATUSES = new Set(['draft','published','finished']);
const SPORTS = new Set(['Бег','Футбол','Теннис','Баскетбол','Волейбол','Падел','Настольный теннис','Хоккей','Велопрогулка','Походы','Активный отдых','Воркаут','Общее']);

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function optionalUrl(value) {
  const result = text(value, 1200);
  if (!result) return undefined;
  try {
    const url = new URL(result);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
function number(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function sanitizeEvent(input, id, existing = null) {
  const participantIds = Array.isArray(existing?.participantIds)
    ? existing.participantIds.map(String).filter(Boolean).slice(0, 500)
    : [];
  const participantsMax = number(input?.participantsMax, 10, 100);
  const lat = number(input?.lat, -90, 90);
  const lng = number(input?.lng, -180, 180);
  const category = CATEGORIES.has(input?.category) ? input.category : '';
  const status = STATUSES.has(input?.status) ? input.status : '';
  const sport = SPORTS.has(input?.sport) ? input.sport : '';
  const audienceMode = input?.audienceMode === 'spectator' || category === 'spectator' ? 'spectator' : 'participant';
  const ticketUrl = optionalUrl(input?.ticketUrl);
  const officialSourceUrl = optionalUrl(input?.officialSourceUrl);
  const ticketVerified = input?.ticketVerified === true;
  const dateKey = text(input?.dateKey, 10);
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(input?.time || '')) ? String(input.time) : '';
  const startsAt = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && time
    ? Date.parse(`${dateKey}T${time}:00+03:00`)
    : Number(input?.startsAt);

  const event = {
    id,
    title: text(input?.title, 180),
    tagline: text(input?.tagline, 220),
    category,
    sport,
    description: text(input?.description, 5000),
    ...(optionalUrl(input?.coverUrl) ? { coverUrl: optionalUrl(input.coverUrl) } : {}),
    ...(optionalUrl(input?.videoUrl) ? { videoUrl: optionalUrl(input.videoUrl) } : {}),
    locationName: text(input?.locationName, 220),
    address: text(input?.address, 400),
    lat,
    lng,
    dateLabel: text(input?.dateLabel, 160),
    ...(dateKey ? { dateKey } : {}),
    time,
    ...(Number.isFinite(startsAt) ? { startsAt } : {}),
    participantsMax,
    participantIds,
    ...(text(input?.prizePool, 240) ? { prizePool: text(input.prizePool, 240) } : {}),
    ...(text(input?.entryFee, 240) ? { entryFee: text(input.entryFee, 240) } : {}),
    audienceMode,
    ...(text(input?.league, 120) ? { league: text(input.league, 120) } : {}),
    ...(text(input?.homeTeam, 120) ? { homeTeam: text(input.homeTeam, 120) } : {}),
    ...(text(input?.awayTeam, 120) ? { awayTeam: text(input.awayTeam, 120) } : {}),
    ...(officialSourceUrl ? { officialSourceUrl } : {}),
    ...(ticketUrl ? { ticketUrl } : {}),
    ...(text(input?.ticketSourceName, 160) ? { ticketSourceName: text(input.ticketSourceName, 160) } : {}),
    ticketVerified,
    ...(ticketVerified ? {
      ticketVerifiedAt: existing?.ticketVerified === true && existing?.ticketUrl === ticketUrl
        ? existing.ticketVerifiedAt || new Date().toISOString()
        : new Date().toISOString(),
      ticketVerifiedBy: 'admin'
    } : {}),
    status,
    createdBy: existing?.createdBy || text(input?.createdBy, 180) || 'admin',
    createdAt: existing?.createdAt || text(input?.createdAt, 80) || new Date().toISOString(),
    isOfficial: true
  };

  if (event.title.length < 5 || event.tagline.length < 5 || event.description.length < 20) {
    throw Object.assign(new Error('Title, tagline and description are required.'), { status: 400 });
  }
  if (!category || !sport || !status || participantsMax === null || lat === null || lng === null || !event.time) {
    throw Object.assign(new Error('Invalid event fields.'), { status: 400 });
  }
  if (category === 'spectator') {
    if (!Number.isFinite(event.startsAt)) {
      throw Object.assign(new Error('Для городского события укажите точную дату и время.'), { status: 400 });
    }
    if (status === 'published' && (!event.ticketVerified || !event.ticketUrl || !event.ticketSourceName || !event.officialSourceUrl)) {
      throw Object.assign(new Error('Перед публикацией подтвердите официальный источник события и официальную ссылку покупки билетов.'), { status: 400 });
    }
  }
  if (event.locationName.length < 2 || event.address.length < 3 || event.dateLabel.length < 2) {
    throw Object.assign(new Error('Event location and date are required.'), { status: 400 });
  }
  return event;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { sessionId, operation, eventId, event, patch, requestId } = req.body || {};
  const db = getFirestore();

  try {
    const session = await requireAdminSession(db, sessionId);
    if (!eventId || String(eventId).includes('/')) return res.status(400).json({ error: 'Event id required.' });
    if (!['create','update','delete'].includes(operation)) return res.status(400).json({ error: 'Unknown operation.' });
    if (operation === 'create' && (!event || typeof event !== 'object')) return res.status(400).json({ error: 'Event payload required.' });
    if (operation === 'update' && (!patch || typeof patch !== 'object')) return res.status(400).json({ error: 'Patch required.' });

    const ref = db.doc(`events/${eventId}`);
    let auditBefore = null;
    let auditAfter = null;
    let notify = null;

    await db.runTransaction(async tx => {
      const before = await tx.get(ref);
      const old = before.exists ? before.data() : null;
      auditBefore = old;

      if (operation === 'create') {
        if (before.exists) throw Object.assign(new Error('Event already exists.'), { status: 409 });
        auditAfter = sanitizeEvent(event, eventId, null);
        tx.create(ref, auditAfter);
      } else if (operation === 'update') {
        if (!before.exists) throw Object.assign(new Error('Event not found.'), { status: 404 });
        auditAfter = sanitizeEvent({ ...old, ...patch }, eventId, old);
        tx.set(ref, auditAfter, { merge: false });
      } else {
        if (!before.exists) throw Object.assign(new Error('Event not found.'), { status: 404 });
        tx.delete(ref);
      }

      const next = auditAfter;
      const newlyPublished = next?.status === 'published' && old?.status !== 'published';
      const participants = Array.isArray(old?.participantIds) ? old.participantIds : [];
      if (newlyPublished || (old?.status === 'published' && participants.length)) {
        notify = {
          id:`event:${eventId}:${randomUUID()}`,
          actorId:'',
          broadcast:newlyPublished,
          recipients:participants,
          category:'events',
          kind:newlyPublished?'event_new':'event_update',
          entityId:eventId,
          title:newlyPublished?'Новое событие SportBuddy':next?.status==='published'?'Событие обновлено':'Событие снято с публикации',
          message:String(next?.title||old?.title||'Откройте раздел событий.'),
          link:next?.status==='published'?'#event='+encodeURIComponent(eventId):'#events'
        };
        enqueueNotification(tx, db, notify);
      }
    });

    await writeAdminAudit(db, session, {
      action:`event.${operation}`,
      entityType:'event',
      entityId:String(eventId),
      before:auditBefore,
      after:auditAfter,
      requestId:String(requestId || '')
    });

    return res.status(200).json({ ok:true, event:auditAfter });
  } catch (error) {
    const status = Number(error?.status || 500);
    return res.status(status).json({ error: status === 500 ? 'Event mutation failed.' : error.message });
  }
}
