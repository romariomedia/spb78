import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementMatchesUser,sanitizeAnnouncement } from '../server/announcements.js';

test('announcement validation keeps only internal links and valid dates',()=>{
  const item=sanitizeAnnouncement({
    title:'Тест',text:'Сообщение',buttonLabel:'Открыть',buttonLink:'#profile',
    placement:'profile',audienceType:'all',startAt:'2026-10-06T10:00:00.000Z',
    endAt:'2026-10-07T10:00:00.000Z',priority:150,isActive:true,dismissible:true
  });
  assert.equal(item.priority,100);
  assert.equal(item.buttonLink,'#profile');
  assert.throws(()=>sanitizeAnnouncement({title:'Тест',text:'Сообщение',buttonLink:'https://example.com'}),error=>error.status===400);
  assert.throws(()=>sanitizeAnnouncement({title:'Тест',text:'Сообщение',startAt:'2026-10-07T10:00:00Z',endAt:'2026-10-06T10:00:00Z'}),error=>error.status===400);
});

test('announcement audience validates districts and sports',()=>{
  const district=sanitizeAnnouncement({title:'Район',text:'Текст',audienceType:'district',audienceValue:'spb-primorsky'});
  assert.equal(district.audienceValue,'spb-primorsky');
  assert.throws(()=>sanitizeAnnouncement({title:'Район',text:'Текст',audienceType:'district',audienceValue:'unknown'}),error=>error.status===400);
  assert.throws(()=>sanitizeAnnouncement({title:'Спорт',text:'Текст',audienceType:'sport',audienceValue:''}),error=>error.status===400);
});

test('announcement matching applies placement, activity window and audience',()=>{
  const now=Date.UTC(2026,9,6,12);
  const base={isActive:true,placement:'global',audienceType:'all',startAt:'',endAt:''};
  const user={id:'u1',isVerified:true,districtId:'spb-primorsky',sports:['Бег']};
  assert.equal(announcementMatchesUser(base,user,'feed',now),true);
  assert.equal(announcementMatchesUser({...base,placement:'profile'},user,'feed',now),false);
  assert.equal(announcementMatchesUser({...base,audienceType:'verified'},user,'feed',now),true);
  assert.equal(announcementMatchesUser({...base,audienceType:'district',audienceValue:'spb-nevsky'},user,'feed',now),false);
  assert.equal(announcementMatchesUser({...base,audienceType:'sport',audienceValue:'Бег'},user,'feed',now),true);
  assert.equal(announcementMatchesUser({...base,startAt:new Date(now+60000).toISOString()},user,'feed',now),false);
  assert.equal(announcementMatchesUser({...base,endAt:new Date(now-1).toISOString()},user,'feed',now),false);
});
