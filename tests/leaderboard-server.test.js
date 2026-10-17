import test from 'node:test';
import assert from 'node:assert/strict';
import { rankingRow, rankingSnapshot, rankingPage } from '../server/leaderboard.js';

test('ranking uses stored metrics, excludes hidden/demo users and never exposes reward codes',()=>{
 const rows=[rankingRow('a',{name:'A',totalWorkouts:4,totalDailyMedals:7,dailyMedalStreak:3,claimedBoxTiers:[7,14],rewardItems:[{code:'secret'}],phone:'secret',friendIds:['secret']}),
   rankingRow('b',{name:'B',totalWorkouts:2,totalDailyMedals:10,dailyMedalStreak:5}),
   rankingRow('hidden',{isSuspended:true,totalWorkouts:100}),rankingRow('demo',{isDemo:true}),rankingRow('user-anna',{})];
 const snapshot=rankingSnapshot(rows);
 assert.deepEqual(snapshot.stats,{athletes:2,workouts:6,medals:17,boxes:2});
 assert.equal(JSON.stringify(snapshot).includes('secret'),false);
 for(const [metric,id,value] of [['workouts','a',4],['streak','b',5],['medals','b',10],['boxes','a',2]]) {
   const page=rankingPage(snapshot,'a',{metric});
   assert.equal(page.entries[0].user.id,id);assert.equal(page.entries[0].value,value);
   assert.equal(page.myEntry.user.id,'a');
 }
});

test('rank ties use rating then stable ID and pages do not mutate the snapshot',()=>{
 const snapshot=rankingSnapshot([rankingRow('z',{totalWorkouts:1,rating:2}),rankingRow('b',{totalWorkouts:1,rating:4}),rankingRow('a',{totalWorkouts:1,rating:4})]);
 const before=JSON.stringify(snapshot);
 const page=rankingPage(snapshot,'missing',{});
 assert.deepEqual(page.entries.map(e=>e.user.id),['a','b','z']);
 assert.equal(page.myEntry,null);assert.equal(page.nextOffset,null);
 assert.equal(JSON.stringify(snapshot),before);
});

test('malformed legacy numbers and tiers do not break ranking or create negative totals',()=>{
 const row=rankingRow('legacy',{totalWorkouts:-3,totalDailyMedals:Infinity,dailyMedalStreak:'99',claimedBoxTiers:null,medalTier:'unknown',rating:NaN});
 assert.deepEqual(row.values,{workouts:0,medals:0,streak:0,boxes:0});
 assert.equal(row.user.medalTier,'bronze');assert.equal(row.rating,0);
 const page=rankingPage(rankingSnapshot([]),'me',{});
 assert.deepEqual(page.stats,{athletes:0,workouts:0,medals:0,boxes:0});
 assert.equal(page.top3Value,null);assert.equal(page.myEntry,null);
});
