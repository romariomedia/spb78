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

test('existing biography remains readable after removing its sport, but new edits must use selected sports',async()=>{
 const {readSportPassport}=await import('../server/sport-passport.js');
 const original={mainSport:'Бег',rankTitle:'КМС',declaredAchievements:[{id:'a1',title:'Победа в забеге',sport:'Бег'}],publicSlug:'stable-slug-123',publicEnabled:true};
 const snapshot=readSportPassport(original,['Теннис']);
 assert.equal(snapshot.mainSport,'Бег');assert.equal(snapshot.rankTitle,'КМС');
 assert.equal(snapshot.declaredAchievements.length,1);assert.equal(snapshot.publicSlug,original.publicSlug);
 assert.throws(()=>sanitizeSportPassportDraft(original,['Теннис']),e=>e.status===400);
 assert.equal(sanitizeSportPassportDraft({...original,mainSport:'Теннис'},['Теннис']).mainSport,'Теннис');
});

test('lifetime medals are counted before limiting the displayed result history',async()=>{
 const {officialCompetitionSummary}=await import('../server/sport-passport.js');
 const results=Array.from({length:65},(_,i)=>({status:'verified',placement:'1 место',achievedAt:i}));
 results.push({status:'revoked',placement:'1 место',achievedAt:999});
 const summary=officialCompetitionSummary(results);
 assert.deepEqual(summary.stats,{wins:65,podiums:65});assert.equal(summary.results.length,50);
 assert.equal(summary.results[0].achievedAt,64);
});
