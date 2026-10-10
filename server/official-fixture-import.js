import { createHash } from 'node:crypto';
import { OFFICIAL_CLUBS, parseHttps, safeFixtureTicket, mediaOrganizerLink } from '../shared/official-ticket-policy.js';

// Contract for permissioned JSON calendar feeds. No arbitrary-site scraping.
// Config examples are documented in ops/OFFICIAL_FIXTURE_IMPORT.md.
export function normalizeFixture(input, source, now = Date.now()) {
  if (!input || typeof input !== 'object' || !source || !source.id) return null;
  const id = String(input.id || '').trim().slice(0,120);
  const title = String(input.title || '').trim().slice(0,180);
  const venue = String(input.venue || '').trim().slice(0,180);
  const address = String(input.address || '').trim().slice(0,350);
  const start = Date.parse(String(input.start || ''));
  if (!id || !title || !venue || !address || !Number.isFinite(start)) return null;
  if (start < now - 2 * 3600000 || start > now + 90 * 86400000) return null;
  const lat = Number(input.lat),lng=Number(input.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  const media = source.kind === 'media';
  const club = OFFICIAL_CLUBS[source.clubId];
  if (!media && !club) return null;
  const sourceUrl = parseHttps(input.sourceUrl || source.url);
  if (!sourceUrl || !source.allowedHosts.includes(sourceUrl.hostname.toLowerCase())) return null;
  const ticketUrl= media ? null : safeFixtureTicket(source.clubId,input.ticketUrl);
  const organizerUrl=media?mediaOrganizerLink(input.organizerUrl || input.sourceUrl,source.allowedHosts):null;
  if(media && !organizerUrl) return null;
  const eventId='evt-auto-'+createHash('sha256').update(source.id+'|'+id).digest('hex').slice(0,24);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(start).map(part=>[part.type,part.value]));
  const day=`${parts.year}-${parts.month}-${parts.day}`;
  const clock = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(start);
  return {
    id:eventId,sourceEventId:id,sourceId:source.id,
    title, tagline:'Не с кем пойти? Найдите компанию в SportBuddy78',
    category:'spectator',audienceMode:'spectator',
    description:String(input.description||'Спортивное событие Санкт-Петербурга. Билеты приобретаются отдельно у официального организатора.').slice(0,3000),
    sport: media ? String(input.sport || 'Футбол').slice(0,80) : club.sport,
    league:String(input.league||'').slice(0,120),
    isMediaLeague:media,
    ...(media?{officialHosts:source.allowedHosts}: {officialClubId:source.clubId}),
    ...(ticketUrl?{ticketUrl,ticketVerified:true,ticketSourceName:club.name,ticketVerifiedBy:'official-allowlist'}:{}),
    officialSourceUrl:sourceUrl.href,
    ...(organizerUrl?{organizerUrl}:{}),
    locationName:venue,address,lat,lng,
    dateKey:day,dateLabel:day,time:clock,startsAt:start,
    participantsMax:100, status:input.cancelled === true?'finished':'published',
    isOfficial:false, isImported:true
  };
}

export function validateFeedSource(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const url=parseHttps(raw.url);
  if (!url) return null;
  const club=OFFICIAL_CLUBS[raw.clubId];
  const media=raw.kind==='media';
  const hosts=media && Array.isArray(raw.allowedHosts)
    ? raw.allowedHosts.filter(x=>typeof x==='string' && /^[a-z0-9.-]+$/.test(x) && !x.endsWith('.') && x.includes('.'))
    : club?[club.sourceHost]:[];
  if (!hosts.includes(url.hostname.toLowerCase())) return null;
  return { id:raw.id.slice(0,100),url:url.href,clubId:raw.clubId,kind:media?'media':'club',allowedHosts:hosts };
}
