import type { OfficialEvent } from './types';

// Permanent club cover photos provided by the SportBuddy78 administrator.
// Other clubs and media leagues never get an unrelated Saint Petersburg team's photo.
export const CLUB_EVENT_COVERS = {
  footballZenit: '/event-covers/rpl-zenit.webp',
  basketballZenit: '/event-covers/vtb-zenit.webp',
  hockeySka: '/event-covers/khl-ska.webp'
} as const;

export function presetEventCover(event:Pick<OfficialEvent,'league'|'sport'|'homeTeam'|'awayTeam'|'isMediaLeague'>):string{
  if(event.isMediaLeague)return '';
  const teams=[event.homeTeam||'',event.awayTeam||''].map(x=>x.trim().toLocaleLowerCase('ru-RU'));
  const has=(name:string)=>teams.includes(name);
  if(event.league==='РПЛ' && has('зенит'))return CLUB_EVENT_COVERS.footballZenit;
  if(event.league==='Единая лига ВТБ' && has('зенит'))return CLUB_EVENT_COVERS.basketballZenit;
  if(event.league==='КХЛ' && has('ска'))return CLUB_EVENT_COVERS.hockeySka;
  return '';
}
export function effectiveEventCover(event:Pick<OfficialEvent,'league'|'sport'|'homeTeam'|'awayTeam'|'isMediaLeague'|'coverUrl'>):string{
  return event.coverUrl?.trim() || presetEventCover(event);
}
