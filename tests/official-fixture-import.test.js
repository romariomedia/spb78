import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICIAL_CLUBS, officialTicketLink, safeFixtureTicket, mediaOrganizerLink, spectatorAction } from '../shared/official-ticket-policy.js';
import { normalizeFixture, validateFeedSource } from '../server/official-fixture-import.js';

test('club URLs only accept exact HTTPS official ticket hosts',()=>{
  for(const [id,club] of Object.entries(OFFICIAL_CLUBS)){
    assert.equal(officialTicketLink(id,club.tickets),new URL(club.tickets).href);
    assert.equal(officialTicketLink(id,'https://'+club.hosts[0]+'.fraud.example/buy'),null);
    assert.equal(officialTicketLink(id,'http://'+club.hosts[0]+'/buy'),null);
    assert.equal(officialTicketLink(id,'https://username@'+club.hosts[0]+'/buy'),null);
    assert.equal(officialTicketLink(id,'https://'+club.hosts[0]+':444/buy'),null);
    assert.equal(safeFixtureTicket(id,'https://fake-tickets.example/buy'),new URL(club.tickets).href);
  }
});
test('media organizers never receive ticket buttons',()=>{
  const e={isMediaLeague:true,officialClubId:'ska',ticketUrl:'https://tickets.ska.ru',officialSourceUrl:'https://media.example/event',officialHosts:['media.example']};
  assert.deepEqual(spectatorAction(e),{url:'https://media.example/event',label:'Уточнить у организаторов',type:'organizer'});
  assert.equal(mediaOrganizerLink('https://media.example.evil.org',['media.example']),null);
});
test('official fixture feeds reject unapproved hosts and preserve deterministic id',()=>{
  const source=validateFeedSource({id:'bc',clubId:'bc-zenit',url:'https://bc-zenit.com/feeds/events.json'});
  assert.ok(source);
  assert.equal(validateFeedSource({id:'bc',clubId:'bc-zenit',url:'https://bc-zenit.com.evil.org/feed'}),null);
  const sample={id:'match-42',title:'Зенит — Автодор',venue:'КСК Арена',address:'Санкт-Петербург',lat:59.96,lng:30.25,start:'2026-10-15T19:00:00+03:00',ticketUrl:'https://fake.example/tickets'};
  const a=normalizeFixture(sample,source,Date.parse('2026-10-10T00:00:00Z'));
  const b=normalizeFixture({...sample,title:'Зенит — Автодор (перенос)'},source,Date.parse('2026-10-10T00:00:00Z'));
  assert.equal(a.id,b.id);
  assert.equal(a.ticketUrl,new URL(OFFICIAL_CLUBS['bc-zenit'].tickets).href);
  assert.equal(a.isImported,true);
});
test('media feed requires organizer official host',()=>{
  const source=validateFeedSource({id:'media',kind:'media',url:'https://media.example/calendar.json',allowedHosts:['media.example']});
  const fixture={id:'x',title:'Матч медиалиги',venue:'Санкт-Петербург',address:'Санкт-Петербург',lat:59.93,lng:30.31,start:'2026-10-16T19:00:00+03:00',organizerUrl:'https://media.example/fixture/x'};
  const result=normalizeFixture(fixture,source,Date.parse('2026-10-10T00:00:00Z'));
  assert.equal(result.isMediaLeague,true);
  assert.equal(result.ticketUrl,undefined);
  assert.equal(result.organizerUrl,'https://media.example/fixture/x');
});
