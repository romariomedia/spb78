import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePartner,partnerIsPublished } from '../server/partners.js';

test('partner content requires safe https links and core copy',()=>{
  const item=sanitizePartner({
    name:'LIT Energy',offerTitle:'Скидка для участников SportBuddy78',description:'Специальное предложение партнёра.',
    ctaUrl:'https://example.com/action',logoUrl:'https://example.com/logo.png',priority:150,isActive:true
  });
  assert.equal(item.priority,100);
  assert.equal(item.ctaUrl,'https://example.com/action');
  assert.equal(item.partnerLabel,'Партнёр SportBuddy78');
  assert.throws(()=>sanitizePartner({name:'X',offerTitle:'Акция',description:'Описание',ctaUrl:'http://example.com'}));
});

test('partner publishing respects activation window',()=>{
  const now=Date.parse('2026-10-07T12:00:00.000Z');
  assert.equal(partnerIsPublished({isActive:true,startAt:'2026-10-01T00:00:00.000Z',endAt:'2026-11-01T00:00:00.000Z'},now),true);
  assert.equal(partnerIsPublished({isActive:false},now),false);
  assert.equal(partnerIsPublished({isActive:true,startAt:'2026-10-08T00:00:00.000Z'},now),false);
  assert.equal(partnerIsPublished({isActive:true,endAt:'2026-10-01T00:00:00.000Z'},now),false);
});
