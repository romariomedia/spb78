import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesAdminPushAudience,sanitizeAdminPushAudience,sanitizeAdminPushContent,sanitizeAdminPushSchedule
} from '../server/admin-push.js';

test('admin push audience filters are combined and suspended users are excluded',()=>{
  const audience=sanitizeAdminPushAudience({
    districtId:'spb-primorsky',sport:'Бег',verifiedOnly:true,activeWithinDays:30
  });
  const now=Date.UTC(2026,9,6,12);
  const user={
    id:'u1',districtId:'spb-primorsky',sports:['Бег'],isVerified:true,
    lastSeenAt:now-5*86400000,isSuspended:false
  };
  assert.equal(matchesAdminPushAudience(user,audience,now),true);
  assert.equal(matchesAdminPushAudience({...user,isVerified:false},audience,now),false);
  assert.equal(matchesAdminPushAudience({...user,lastSeenAt:now-31*86400000},audience,now),false);
  assert.equal(matchesAdminPushAudience({...user,isSuspended:true},audience,now),false);
});

test('admin push exact user can be targeted safely',()=>{
  const audience=sanitizeAdminPushAudience({userId:'firebase-uid-1'});
  assert.equal(matchesAdminPushAudience({id:'firebase-uid-1'},audience),true);
  assert.equal(matchesAdminPushAudience({id:'firebase-uid-2'},audience),false);
  assert.throws(()=>sanitizeAdminPushAudience({userId:'bad/id'}),error=>error.status===400);
});

test('admin push content accepts internal routes and rejects external links',()=>{
  assert.deepEqual(sanitizeAdminPushContent({title:'Тест',message:'Проверка',link:'#notifications'}),{
    title:'Тест',message:'Проверка',link:'#notifications'
  });
  assert.throws(()=>sanitizeAdminPushContent({title:'Тест',message:'Проверка',link:'https://example.com'}),error=>error.status===400);
  assert.throws(()=>sanitizeAdminPushContent({title:'',message:'Проверка'}),error=>error.status===400);
});

test('admin push schedule is immediate for empty/past and capped at thirty days',()=>{
  const now=Date.UTC(2026,9,6,12);
  assert.equal(sanitizeAdminPushSchedule('',now),now);
  assert.equal(sanitizeAdminPushSchedule(new Date(now-120000).toISOString(),now),now);
  assert.equal(sanitizeAdminPushSchedule(new Date(now+3600000).toISOString(),now),now+3600000);
  assert.throws(()=>sanitizeAdminPushSchedule(new Date(now+31*86400000).toISOString(),now),error=>error.status===400);
});
