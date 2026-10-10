import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICIAL_CALENDAR_SOURCES, SOURCE_ONBOARDING_RULES } from '../shared/official-calendar-sources.js';
import { OFFICIAL_CLUBS, officialTicketLink } from '../shared/official-ticket-policy.js';

test('four approved clubs have official calendar catalog entries without invented feeds',()=>{
  assert.equal(OFFICIAL_CALENDAR_SOURCES.length,4);
  const ids=new Set(OFFICIAL_CALENDAR_SOURCES.map(source=>source.id));
  assert.equal(ids.size,4);
  for(const s of OFFICIAL_CALENDAR_SOURCES){
    assert.equal(s.feedStatus,'not-connected');
    assert.equal(s.requiresApproval,true);
    assert.ok(OFFICIAL_CLUBS[s.id]);
    assert.ok(new URL(s.homepage).protocol==='https:');
    assert.ok(new URL(s.ticketPortal).protocol==='https:');
    assert.ok(officialTicketLink(s.id,OFFICIAL_CLUBS[s.id].tickets));
  }
  assert.equal(SOURCE_ONBOARDING_RULES.doNotScrapeWithoutAuthorization,true);
});
