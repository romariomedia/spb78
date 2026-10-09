import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {stat} from 'node:fs/promises';
const b=await build({entryPoints:['src/components/welcomeGuideContent.ts'],bundle:true,format:'esm',platform:'node',write:false});
const {guideChapters}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
test('guide covers current product areas with locally available lightweight artwork',async()=>{
 const chapters=guideChapters(Date.parse('2026-10-08T12:00:00Z'));
 assert.deepEqual(chapters.map(s=>s.id),['start','discover','trainings','leisure','venues','events','chats','feed','profile','rewards']);
 assert.equal(new Set(chapters.map(slide=>slide.art)).size,chapters.length,'Each chapter needs a distinct relevant visual');
 const screens={chats:['chats-screen.jpg'],feed:['feed-screen.jpg'],progress:['medals-screen.jpg','stats-screen.jpg'],overview:[]};
 for(const slide of chapters){
  assert.equal(slide.points.length,slide.id==='start'?0:3);
  assert.ok(slide.lead&&slide.tip);
  const assets=screens[slide.art]??[slide.art+'.webp'];
  for(const asset of assets)assert.ok((await stat('public/guide/'+asset)).size<300000);
 }
 assert.equal(chapters.find(s=>s.id==='chats').art,'chats');
 assert.equal(chapters.find(s=>s.id==='feed').art,'feed');
 assert.equal(chapters.find(s=>s.id==='rewards').art,'progress');
});
test('guide switches beta wording at Moscow midnight and never promises beta BOX',()=>{
 const before=guideChapters(Date.parse('2026-12-31T20:59:59Z'));
 const after=guideChapters(Date.parse('2026-12-31T21:00:00Z'));
 assert.match(before.at(-1).points[2][1],/Во время беты BOX не выдаются/);
 assert.match(before.at(-1).points[1][1],/уже сейчас/);
 assert.match(after.at(-1).lead,/действующим сроком/);
 assert.doesNotMatch(JSON.stringify(after),/Premium открыт бесплатно/);
 assert.match(after[1].tip,/5 мэтчей за 7 дней/);
});
