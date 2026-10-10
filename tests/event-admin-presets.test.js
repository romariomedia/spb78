import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUE_TEAMS, LEAGUE_SPORT, LEAGUE_VENUES, teamsForLeague, venuesForLeague, eventMatchTitle } from '../src/lib/eventAdminPresets.ts';

test('league presets contain no duplicate teams and match the sport',()=>{
 assert.deepEqual(Object.keys(LEAGUE_TEAMS).sort(),['Единая лига ВТБ','КХЛ','РПЛ'].sort());
 for(const [league,teams] of Object.entries(LEAGUE_TEAMS)){
  assert.ok(teams.length>=12);
  assert.equal(new Set(teams).size,teams.length);
  assert.ok(LEAGUE_SPORT[league]);
  assert.deepEqual(teamsForLeague(league),teams);
 }
 assert.deepEqual(teamsForLeague('Медиалига'),[]);
});
test('venue presets contain grounded address and numeric GPS, editable per fixture',()=>{
 for(const venue of LEAGUE_VENUES){
  assert.ok(venue.address.includes('Санкт-Петербург'));
  assert.ok(venue.lat>=59&&venue.lat<=61&&venue.lng>=29&&venue.lng<=31);
  for(const league of venue.leagues)assert.ok(venuesForLeague(league).includes(venue));
 }
 assert.deepEqual(venuesForLeague('Медиалига'),[]);
});
test('match title rejects same team',()=>{
 assert.equal(eventMatchTitle('СКА','СКА'),'');
 assert.equal(eventMatchTitle('СКА','Трактор'),'СКА — Трактор');
});
