import test from 'node:test';
import assert from 'node:assert/strict';
import { presetEventCover, effectiveEventCover, CLUB_EVENT_COVERS } from '../src/lib/eventCoverPresets.ts';

test('only the correct Saint Petersburg club receives its permanent cover',()=>{
 const sample={sport:'Хоккей',league:'КХЛ',isMediaLeague:false,homeTeam:'СКА',awayTeam:'Автомобилист',coverUrl:''};
 assert.equal(presetEventCover(sample),CLUB_EVENT_COVERS.hockeySka);
 assert.equal(presetEventCover({...sample,homeTeam:'Шанхайские Драконы'}),'');
 assert.equal(presetEventCover({...sample,league:'РПЛ',homeTeam:'Зенит',sport:'Футбол'}),CLUB_EVENT_COVERS.footballZenit);
 assert.equal(presetEventCover({...sample,league:'Единая лига ВТБ',homeTeam:'Зенит',sport:'Баскетбол'}),CLUB_EVENT_COVERS.basketballZenit);
 assert.equal(presetEventCover({...sample,isMediaLeague:true}),'');
});
test('individual cover always overrides the default',()=>{
 const e={league:'КХЛ',sport:'Хоккей',isMediaLeague:false,homeTeam:'СКА',awayTeam:'Автомобилист',coverUrl:'https://images.example/match.jpg'};
 assert.equal(effectiveEventCover(e),e.coverUrl);
 assert.equal(effectiveEventCover({...e,coverUrl:''}),CLUB_EVENT_COVERS.hockeySka);
});
