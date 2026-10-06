import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutomaticAchievements,levelLabel,sanitizeSportPassportDraft } from '../server/sport-passport.js';

test('passport draft only accepts a main sport from the user profile',()=>{
  const value=sanitizeSportPassportDraft({
    mainSport:'Бег',level:'competitive',rankTitle:'1 разряд',yearsExperience:4,
    declaredAchievements:[{id:'a1',title:'Полумарафон',sport:'Бег',date:'2026-09-01'}]
  },['Бег','Теннис']);
  assert.equal(value.mainSport,'Бег');
  assert.equal(value.level,'competitive');
  assert.equal(value.rankTitle,'1 разряд');
  assert.equal(value.declaredAchievements[0].verification,'declared');
  assert.throws(()=>sanitizeSportPassportDraft({mainSport:'Хоккей'},['Бег']),error=>error.status===400);
});

test('passport sanitizes limits and unknown levels',()=>{
  const value=sanitizeSportPassportDraft({
    mainSport:'',level:'elite',rankTitle:'x'.repeat(500),yearsExperience:999,
    declaredAchievements:Array.from({length:15},(_,i)=>({title:'Достижение '+i}))
  },[]);
  assert.equal(value.level,'beginner');
  assert.equal(value.yearsExperience,80);
  assert.equal(value.rankTitle.length,120);
  assert.equal(value.declaredAchievements.length,10);
});

test('automatic SportBuddy achievements depend only on server profile facts',()=>{
  const items=buildAutomaticAchievements({totalWorkouts:10,rating:4.8,ratingCount:6,totalDailyMedals:8});
  assert.ok(items.some(x=>x.id==='first-workout'));
  assert.ok(items.some(x=>x.id==='workouts-10'));
  assert.ok(items.some(x=>x.id==='rating-45'));
  assert.ok(items.every(x=>x.verification==='sportbuddy'));
  assert.equal(buildAutomaticAchievements({totalWorkouts:0}).length,0);
});

test('passport level labels are stable',()=>{
  assert.equal(levelLabel('pro'),'Профессионал');
  assert.equal(levelLabel('unknown'),'Начинающий');
});
