import test from 'node:test';
import assert from 'node:assert/strict';
import {DASHBOARD_SECTIONS,normalizeDashboardOrder,moveDashboardSection} from '../shared/dashboard-order.js';
test('saved dashboard order keeps valid choices and appends missing sections',()=>{
 assert.deepEqual(normalizeDashboardOrder(['calendar','removed','calendar','running']),['calendar','running','events','trainers','leaderboard','community']);
 for(const invalid of [null,{},'running',42])assert.deepEqual(normalizeDashboardOrder(invalid),DASHBOARD_SECTIONS);
});
test('moving sections preserves all content and does not cross list bounds',()=>{
 const before=[...DASHBOARD_SECTIONS];
 assert.equal(moveDashboardSection(before,'events',-1)[0],'events');
 assert.deepEqual(before,DASHBOARD_SECTIONS);
 assert.deepEqual(moveDashboardSection(before,'running',-1),before);
 assert.deepEqual(moveDashboardSection(before,'community',1),before);
 assert.deepEqual(moveDashboardSection(before,'missing',1),before);
});
