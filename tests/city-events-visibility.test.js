import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const events=readFileSync(new URL('../src/services/events.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const calendar=readFileSync(new URL('../src/components/CitySportsEvents.tsx',import.meta.url),'utf8');

test('published spectator fixtures do not require tickets to appear in calendar',()=>{
 const a=events.indexOf('export function filterUpcomingCityEvents');
 const b=events.indexOf('export function getUpcomingCityEvents',a);
 const filter=events.slice(a,b);
 assert.ok(filter.includes("event.status==='published'"));
 assert.ok(filter.includes("event.category==='spectator'"));
 assert.ok(!filter.includes('ticketVerified'));
 assert.ok(!filter.includes('ticketUrl'));
});
test('city spectator block is only in feed, deep links follow its location',()=>{
 const trainings=app.indexOf("activeTab === 'trainings'");
 const feed=app.indexOf("activeTab === 'feed'");
 assert.ok(trainings>=0&&feed>trainings);
 const block=app.indexOf('<CitySportsEvents');
 assert.ok(block>feed);
 assert.equal((app.match(/<CitySportsEvents/g)||[]).length,1);
 assert.ok(app.includes("else if(link==='#events')setActiveTab('feed')"));
});
test('calendar reports read failure instead of silent catch',()=>{
 assert.ok(calendar.includes('setLoadError(true)'));
 assert.ok(calendar.includes('role="alert"'));
 assert.ok(calendar.includes('filterUpcomingCityEvents(all,30)'));
});
