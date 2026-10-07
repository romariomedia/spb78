import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_RECENT_LIMIT,assertChatParticipants,assertChatRateLimit,assertChatRelationship,
  buildRecentMessages,buildServerChatId,nextChatTimestamp,nextUnreadCounts,sanitizeChatText
} from '../server/chat-policy.js';

test('chat id is deterministic',()=>{
  assert.equal(buildServerChatId('b','a'),'chat_a__b');
  assert.equal(buildServerChatId('a','b'),'chat_a__b');
});

test('chat text is trimmed and bounded',()=>{
  assert.equal(sanitizeChatText('  Привет  '),'Привет');
  assert.throws(()=>sanitizeChatText('   '),error=>error.status===400);
  assert.throws(()=>sanitizeChatText('x'.repeat(2001)),error=>error.status===400);
});

test('chat participants must match deterministic id',()=>{
  assert.doesNotThrow(()=>assertChatParticipants({uid:'u1',companionId:'u2',chatId:'chat_u1__u2'}));
  assert.throws(()=>assertChatParticipants({uid:'u1',companionId:'u1',chatId:'chat_u1__u1'}),error=>error.status===400);
  assert.throws(()=>assertChatParticipants({uid:'u1',companionId:'u2',chatId:'chat_fake'}),error=>error.status===400);
});

test('chat requires mutual match or friendship and respects blocks/suspension',()=>{
  assert.deepEqual(
    assertChatRelationship({matchIds:['u2']},{matchIds:['u1']},'u2','u1'),
    {matched:true,friends:false}
  );
  assert.deepEqual(
    assertChatRelationship({friendIds:['u2']},{friendIds:['u1']},'u2','u1'),
    {matched:false,friends:true}
  );
  assert.throws(
    ()=>assertChatRelationship({matchIds:['u2'],blockedUserIds:['u2']},{matchIds:['u1']},'u2','u1'),
    error=>error.status===403
  );
  assert.throws(
    ()=>assertChatRelationship({friendIds:['u2']},{friendIds:['u1'],isSuspended:true},'u2','u1'),
    error=>error.status===403
  );
  assert.throws(
    ()=>assertChatRelationship({},{},'u2','u1'),
    error=>error.status===403
  );
});

test('recent message cache is bounded while preserving newest messages',()=>{
  const existing=Array.from({length:CHAT_RECENT_LIMIT},(_,i)=>({id:String(i),timestamp:i}));
  const next=buildRecentMessages({messages:existing},{id:'new',timestamp:999});
  assert.equal(next.length,CHAT_RECENT_LIMIT);
  assert.equal(next[0].id,'1');
  assert.equal(next.at(-1).id,'new');
});

test('unread metadata increments only recipient and caps safely',()=>{
  assert.deepEqual(nextUnreadCounts({unreadCount:{u1:3,u2:7}},'u1','u2'),{u1:3,u2:8});
  assert.equal(nextUnreadCounts({unreadCount:{u2:999}},'u1','u2').u2,999);
});

test('message timestamps stay monotonic and spam guard rejects bursts',()=>{
  assert.equal(nextChatTimestamp(2000,1000),2001);
  assert.doesNotThrow(()=>assertChatRateLimit({lastSenderAt:{u1:1000}},'u1',1400));
  assert.throws(()=>assertChatRateLimit({lastSenderAt:{u1:1000}},'u1',1200),error=>error.status===429);
});
