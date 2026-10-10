import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSportBuddyShareUrl, trainingShareCopy, leisureShareCopy } from '../shared/share-links.js';

test('training share uses public domain instead of device origin',()=>{
  const payload=trainingShareCopy({
    id:'tr 1',title:'Бег на Крестовском',sport:'Бег',locationName:'Крестовский остров',dateLabel:'12 октября, 10:00'
  });
  assert.equal(payload.url,'https://sportbuddy78.pro/?utm_source=sportbuddy&utm_medium=share&utm_campaign=training_share#training=tr%201');
  assert.match(payload.text,/Присоединяйся/);
  assert.match(payload.text,/Крестовский остров/);
});

test('leisure share opens the exact community event',()=>{
  const startsAt=Date.parse('2026-10-12T07:00:00.000Z');
  const payload=leisureShareCopy({
    id:'leisure-42',title:'Поездка в Рускеалу',destinationName:'Рускеала',
    meetingPoint:'Московский вокзал',startsAt
  });
  assert.equal(payload.url,'https://sportbuddy78.pro/?utm_source=sportbuddy&utm_medium=share&utm_campaign=leisure_share#leisure=leisure-42');
  assert.match(payload.text,/Московский вокзал/);
  assert.match(payload.text,/МСК/);
});

test('share URL encodes ids and rejects unsupported kinds',()=>{
  assert.equal(buildSportBuddyShareUrl('training','a/b?c').endsWith('#training=a%2Fb%3Fc'),true);
  assert.throws(()=>buildSportBuddyShareUrl('event','x'));
});
