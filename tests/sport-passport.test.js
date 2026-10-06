import test from 'node:test';
import assert from 'node:assert/strict';
import { competitionStats,levelLabel,sanitizeSportPassportDraft } from '../server/sport-passport.js';

test('SportBuddy78 ID accepts main sport and multiple declared achievements',()=>{
  const value=sanitizeSportPassportDraft({
    mainSport:'Бег',level:'competitive',rankTitle:'1 разряд',yearsExperience:4,
    declaredAchievements:[
      {id:'a1',title:'Полумарафон',sport:'Бег',date:'2026-09-01',placement:'1:42'},
      {id:'a2',title:'Городской старт',sport:'Бег',placement:'5 место'}
    ]
  },['Бег','Теннис']);
  assert.equal(value.mainSport,'Бег');
  assert.equal(value.level,'competitive');
  assert.equal(value.declaredAchievements.length,2);
  assert.equal(value.declaredAchievements[0].verification,'declared');
  assert.equal(value.declaredAchievements[0].placement,'1:42');
  assert.throws(()=>sanitizeSportPassportDraft({mainSport:'Хоккей'},['Бег']),error=>error.status===400);
});

test('SportBuddy78 ID caps declared achievements at thirty',()=>{
  const value=sanitizeSportPassportDraft({
    mainSport:'',level:'elite',rankTitle:'x'.repeat(500),yearsExperience:999,
    declaredAchievements:Array.from({length:40},(_,i)=>({title:'Достижение '+i}))
  },[]);
  assert.equal(value.level,'beginner');
  assert.equal(value.yearsExperience,80);
  assert.equal(value.rankTitle.length,120);
  assert.equal(value.declaredAchievements.length,30);
});

test('competition medals count only verified SportBuddy result placements',()=>{
  assert.deepEqual(competitionStats([
    {placement:'1 место'},{placement:'2 место'},{placement:'3 место'},{placement:'5 место'},{placement:'Победитель'}
  ]),{wins:2,podiums:4});
});

test('SportBuddy78 ID level labels are stable',()=>{
  assert.equal(levelLabel('pro'),'Профессионал');
  assert.equal(levelLabel('unknown'),'Начинающий');
});
