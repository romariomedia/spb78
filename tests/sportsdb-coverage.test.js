import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTSDB_REQUIRED_TEAMS,sportsDbTeamSearchUrl,sportsDbNextEventsUrl,assessTeamResults,assessEventResults,isPublishableFromSportsDb} from '../server/sportsdb-coverage.js';
test('coverage probe checks four named clubs and never authorizes publishing',()=>{
 assert.deepEqual(SPORTSDB_REQUIRED_TEAMS.map(x=>x.club),['fc-zenit','ska','dragons','bc-zenit']);
 assert.equal(isPublishableFromSportsDb(),false);
});
test('API URLs are fixed-host, encoded and reject arbitrary team ids',()=>{
 assert.equal(new URL(sportsDbTeamSearchUrl('SKA Saint Petersburg')).hostname,'www.thesportsdb.com');
 assert.match(sportsDbTeamSearchUrl('SKA Saint Petersburg'),/SKA%20Saint%20Petersburg/);
 assert.throws(()=>sportsDbNextEventsUrl('12/../../'));
 assert.throws(()=>sportsDbNextEventsUrl('123','../'));
});
test('team lookup filters wrong sport, event lookup does not invent venue',()=>{
 const target=SPORTSDB_REQUIRED_TEAMS[0];
 const teams=assessTeamResults({teams:[{idTeam:'11',strTeam:'Zenit',strSport:'Basketball'},{idTeam:'22',strTeam:'Zenit',strSport:'Soccer'}]},target);
 assert.equal(teams.length,1);assert.equal(teams[0].id,'22');
 const matches=assessEventResults({events:[{idEvent:'3',strHomeTeam:'Zenit',strAwayTeam:'Krasnodar',dateEvent:'2026-10-20',strVenue:''},{idEvent:'oops',dateEvent:'yesterday'}]});
 assert.equal(matches.length,1);assert.equal(matches[0].venue,'');
});
