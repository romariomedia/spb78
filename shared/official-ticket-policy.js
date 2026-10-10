// One source of truth for official club ticket navigation.
// Never promote scraped, user supplied, or intermediary URLs to ticket buttons.
export const OFFICIAL_CLUBS = Object.freeze({
  'fc-zenit': Object.freeze({
    name: 'ФК «Зенит»', sport: 'Футбол',
    tickets: 'https://tickets.fc-zenit.ru/football/tickets/',
    hosts: ['tickets.fc-zenit.ru'], sourceHost: 'fc-zenit.ru'
  }),
  'ska': Object.freeze({
    name: 'ХК СКА', sport: 'Хоккей',
    tickets: 'https://tickets.ska.ru/',
    hosts: ['tickets.ska.ru','cdn-tickets.ska.ru'], sourceHost: 'ska.ru'
  }),
  'dragons': Object.freeze({
    name: 'ХК «Шанхай Дрэгонс»', sport: 'Хоккей',
    tickets: 'https://hc-dragons.com/tickets/',
    hosts: ['hc-dragons.com','tickets.hc-dragons.com'], sourceHost: 'hc-dragons.com'
  }),
  'bc-zenit': Object.freeze({
    name: 'БК «Зенит»', sport: 'Баскетбол',
    tickets: 'https://bc-zenit.com/tickets',
    hosts: ['bc-zenit.com'], sourceHost: 'bc-zenit.com'
  })
});

export function parseHttps(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!url.hostname || url.hostname.endsWith('.')) return null;
    return url;
  } catch { return null; }
}

export function officialTicketLink(clubId, candidate) {
  const club = OFFICIAL_CLUBS[clubId];
  if (!club) return null;
  const url = parseHttps(candidate || club.tickets);
  if (!url || !club.hosts.includes(url.hostname.toLowerCase())) return null;
  return url.href;
}

export function safeFixtureTicket(clubId, candidate) {
  const club = OFFICIAL_CLUBS[clubId];
  if (!club) return null;
  // Individual ticket links must use an exact allowlisted host.
  // Otherwise fall back to the club's own tickets landing page.
  return officialTicketLink(clubId,candidate) || officialTicketLink(clubId,club.tickets);
}

export function mediaOrganizerLink(value, allowedHosts) {
  const url = parseHttps(value);
  if (!url || !Array.isArray(allowedHosts)) return null;
  return allowedHosts.some(host => typeof host === 'string' && url.hostname.toLowerCase() === host.toLowerCase())
    ? url.href : null;
}

export function spectatorAction(event) {
  if (event?.isMediaLeague === true) {
    const link = mediaOrganizerLink(event.officialSourceUrl, event.officialHosts);
    return link ? { url:link, label:'Уточнить у организаторов',type:'organizer' } : null;
  }
  const url = safeFixtureTicket(event?.officialClubId, event?.ticketUrl);
  return url ? { url,label:'Билеты на сайте клуба',type:'tickets' } : null;
}
