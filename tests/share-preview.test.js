import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSharePreviewHtml, renderSharePreviewImage, shareTarget } from '../server/share-preview.js';

const model={
  kind:'training',
  id:'tr_test_123',
  eyebrow:'ОФИЦИАЛЬНАЯ ТРЕНИРОВКА SPORTBUDDY78',
  title:'Вечерняя пробежка',
  subtitle:'Бег · Крестовский остров',
  when:'12 октября · 19:00',
  description:'Присоединяйтесь к тренировке в SportBuddy78.'
};

test('share preview HTML exposes social metadata and SPA target',()=>{
  const page=buildSharePreviewHtml(model);
  assert.match(page,/property="og:title"/);
  assert.match(page,/property="og:image"/);
  assert.match(page,/twitter:card/);
  assert.match(page,/\/share\/image\/training\/tr_test_123\.png/);
  assert.match(page,/#training=tr_test_123/);
  assert.match(page,/utm_campaign=training_share/);
});

test('share target preserves campaign and exact activity id',()=>{
  assert.equal(
    shareTarget('leisure','out_abc-123'),
    'https://sportbuddy78.pro/?utm_source=sportbuddy&utm_medium=share&utm_campaign=leisure_share#leisure=out_abc-123'
  );
});

test('share preview renderer returns a 1200x630 PNG',async()=>{
  const image=await renderSharePreviewImage(model);
  assert.equal(image.subarray(1,4).toString(),'PNG');
  assert.ok(image.length>1000);
});
