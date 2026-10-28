import test from 'node:test';
import assert from 'node:assert/strict';
import {eventCoverSources} from '../src/lib/eventCoverSources.ts';

test('bundled official poster precedes remote URL and fallback without duplicates',()=>{
 assert.deepEqual(eventCoverSources('https://sportbuddy78.pro/event-posters/match.webp','/event-covers/khl-ska.webp',['/event-posters/match.webp','/event-covers/khl-ska.webp']),['/event-posters/match.webp','https://sportbuddy78.pro/event-posters/match.webp','/event-covers/khl-ska.webp']);
});
test('new posters absent from an old APK remain remote; external sources are never rewritten',()=>{
 assert.deepEqual(eventCoverSources('https://sportbuddy78.pro/event-posters/new.webp','',[]),['https://sportbuddy78.pro/event-posters/new.webp']);
 assert.deepEqual(eventCoverSources('https://external.example/event-posters/match.webp','',['/event-posters/match.webp']),['https://external.example/event-posters/match.webp']);
 assert.deepEqual(eventCoverSources('','',[]),[]);
});
