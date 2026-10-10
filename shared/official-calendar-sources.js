// Public official pages for human verification and feed onboarding.
// These pages are NOT permission to scrape, and are not machine-readable feeds.
export const OFFICIAL_CALENDAR_SOURCES = Object.freeze([
  { id:'fc-zenit', name:'ФК «Зенит»', category:'football', homepage:'https://fc-zenit.ru/', ticketPortal:'https://tickets.fc-zenit.ru/', feedStatus:'not-connected', requiresApproval:true },
  { id:'bc-zenit', name:'БК «Зенит»', category:'basketball', homepage:'https://bc-zenit.com/', ticketPortal:'https://bc-zenit.com/tickets', feedStatus:'not-connected', requiresApproval:true },
  { id:'ska', name:'ХК СКА', category:'hockey', homepage:'https://www.ska.ru/', ticketPortal:'https://tickets.ska.ru/', feedStatus:'not-connected', requiresApproval:true },
  { id:'dragons', name:'ХК «Шанхай Дрэгонс»', category:'hockey', homepage:'https://hc-dragons.com/calendar/', ticketPortal:'https://tickets.hc-dragons.com/', feedStatus:'not-connected', requiresApproval:true },
]);
export const SOURCE_ONBOARDING_RULES = Object.freeze({
  requireWrittenLicenseOrPublishedFeedTerms:true,
  doNotScrapeWithoutAuthorization:true,
  requireStableMatchId:true,
  requireVerifiedDateAndVenue:true,
  requireApprovedTicketsDomain:true,
  preserveImportedAttendees:true
});
