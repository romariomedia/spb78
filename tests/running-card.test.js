import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source = readFileSync(new URL('../src/lib/runningCard.ts', import.meta.url), 'utf8');
const {code} = transformSync(source, {loader:'ts',format:'esm',target:'es2020'});
const {runDuration, runPace, runStatus, prepareCardPhoto} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('card formats zero GPS, rounded minute boundary and long elapsed time', () => {
  assert.equal(runPace({distanceM:0,paceSecPerKm:300}),'—');
  assert.equal(runPace({distanceM:1000,paceSecPerKm:359.6}),'6:00');
  assert.equal(runPace({distanceM:1000,paceSecPerKm:NaN}),'—');
  assert.equal(runDuration(3723000),'01:02:03');
  assert.equal(runDuration(-1),'00:00:00');
});
test('card never implies an unsaved or unpublished result entered the ranking', () => {
  assert.equal(runStatus({published:true},false),'Результат ещё не сохранён');
  assert.equal(runStatus({published:false,eligible:true},true),'Трасса пройдена · личный результат');
  assert.equal(runStatus({published:false,eligible:false},true),'Личный результат · вне рейтинга');
  assert.equal(runStatus({published:true},true),'Результат включён в рейтинг');
});
test('unsupported and oversized photos fail before browser decoding', async () => {
  await assert.rejects(prepareCardPhoto({type:'image/svg+xml',size:100}),/JPG, PNG или WebP/);
  await assert.rejects(prepareCardPhoto({type:'image/jpeg',size:21*1024*1024}),/20 МБ/);
});
