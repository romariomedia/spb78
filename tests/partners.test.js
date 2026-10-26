import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePartner,partnerIsPublished } from '../server/partners.js';

test('partner content requires safe https links and core copy',()=>{
  const item=sanitizePartner({
    name:'LIT Energy',offerTitle:'Скидка для участников SportBuddy78',description:'Специальное предложение партнёра.',
    ctaUrl:'https://example.com/action',logoUrl:'https://example.com/logo.png',priority:150,isActive:true,isAdvertising:false
  });
  assert.equal(item.priority,100);
  assert.equal(item.ctaUrl,'https://example.com/action');
  assert.equal(item.partnerLabel,'Партнёр SportBuddy78');
  assert.throws(()=>sanitizePartner({name:'X',offerTitle:'Акция',description:'Описание',ctaUrl:'http://example.com'}));
});

test('partner publishing respects activation window',()=>{
  const now=Date.parse('2026-10-07T12:00:00.000Z');
  assert.equal(partnerIsPublished({isActive:true,isAdvertising:false,startAt:'2026-10-01T00:00:00.000Z',endAt:'2026-11-01T00:00:00.000Z'},now),true);
  assert.equal(partnerIsPublished({isActive:false,isAdvertising:false},now),false);
  assert.equal(partnerIsPublished({isActive:true,isAdvertising:false,startAt:'2026-10-08T00:00:00.000Z'},now),false);
  assert.equal(partnerIsPublished({isActive:true,isAdvertising:false,endAt:'2026-10-01T00:00:00.000Z'},now),false);
});

test('partner media is internally consistent and invalid publication dates fail closed',()=>{
 const base={name:'Партнёр',offerTitle:'Акция',description:'Описание'};
 assert.equal(sanitizePartner({...base,mediaType:'video',mediaUrl:''}).mediaType,'none');
 assert.equal(sanitizePartner({...base,mediaType:'none',mediaUrl:'https://example.com/photo.jpg'}).mediaType,'image');
 assert.throws(()=>sanitizePartner({...base,ctaUrl:'https://user:password@example.com'}),{status:400});
 assert.equal(partnerIsPublished({isActive:true,isAdvertising:false,endAt:'invalid'}),false);
 assert.equal(partnerIsPublished({name:'Missing status'}),false);
 assert.equal(partnerIsPublished({isActive:true,isAdvertising:false,endAt:'2026-10-08T12:00:00Z'},Date.parse('2026-10-08T12:00:00Z')),false);
});


test('internet advertising fails closed without advertiser, ORD and ERID',()=>{
  const base={name:'Рекламодатель',offerTitle:'Рекламное предложение',description:'Описание',isAdvertising:true,isActive:true};
  assert.throws(()=>sanitizePartner(base),{code:'ADVERTISER_REQUIRED'});
  assert.throws(()=>sanitizePartner({...base,advertiserName:'ИП Иванов',advertiserInn:'781234567890'}),{code:'ERID_REQUIRED'});
  const ad=sanitizePartner({...base,advertiserName:'ИП Иванов',advertiserInn:'781234567890',erid:'2VtzqExample123',ordName:'ОРД'});
  assert.equal(partnerIsPublished(ad),true);
  assert.equal(ad.isAdvertising,true);
  assert.equal(ad.advertiserInn,'781234567890');
});
