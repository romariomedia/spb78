import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { build } from 'esbuild';
async function source(path) {
  const result = await build({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'node'});
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const { venuePrice } = await source('src/lib/venuePricing.ts');
const { venueCover } = await source('src/lib/venueCovers.ts');
const { SPB_VENUES } = await source('src/lib/venues.ts');
const photos = JSON.parse(fs.readFileSync('src/lib/venuePhotos.json'));
const prices = JSON.parse(fs.readFileSync('src/lib/venuePrices.json'));
test('official prices replace legacy seed and cached values without replacing administrator prices', () => {
  const venue = SPB_VENUES.find(v => v.id === 'sosnovka-park');
  assert.equal(venuePrice(venue).sourceUrl, 'https://parksosnovka.ru/');
  assert.match(venuePrice(JSON.parse(JSON.stringify(venue))).text, /4\s000/);
  assert.match(venuePrice({...venue, priceText: undefined}).text, /4\s000/);
  assert.deepEqual(venuePrice({...venue, priceText:'5 500 ₽/ч — подтверждено клубом'}), {
    text:'5 500 ₽/ч — подтверждено клубом', condition:'Условия уточняйте у площадки'
  });
});
test('unverified seed prices and unknown objects do not inherit a price or stock cover', () => {
  assert.equal(venuePrice(SPB_VENUES.find(v => v.id === 'f-base')).text, 'Цена по запросу');
  const unknown = {id:'new-place', sports:['Футбол']};
  assert.equal(venuePrice(unknown).sourceUrl, undefined);
  assert.equal(venueCover(unknown).url, '');
  assert.equal(venueCover(unknown).kind, 'missing');
});
test('every curated photo has its own existing lightweight file and traceable source', () => {
  const hashes = new Set();
  for (const [id, photo] of Object.entries(photos)) {
    assert.ok(SPB_VENUES.some(v => v.id === id));
    assert.ok(photo.imageUrl.startsWith('https://'));
    assert.ok(photo.sourceUrl.startsWith('https://'));
    const bytes = fs.readFileSync('public'+photo.url);
    assert.ok(bytes.length < 200_000, id);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.ok(!hashes.has(hash), `Repeated cover: ${id}`);hashes.add(hash);
    assert.equal(venueCover({id}).url, photo.url);
  }
});
test('every published starting tariff includes scope, conditions, source and review date', () => {
  for (const [id, price] of Object.entries(prices)) {
    assert.ok(SPB_VENUES.some(v => v.id === id));
    assert.ok(price.amount > 0 && price.unit.includes('час'));
    assert.ok(price.condition.length > 10 && price.note.length > 10);
    assert.match(price.sourceUrl, /^https:\/\//);
    assert.equal(price.checkedAt,'2026-10-05');
  }
});
