import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeChatReadResult,pruneUnavailableGroupThreads} from '../shared/chat-cache-policy.js';

test('removed training chat is deleted from local cache while direct chat stays',()=>{
  const source={
    training_t1:{id:'training_t1',kind:'training',participantIds:['u1','u2']},
    chat_u1__u2:{id:'chat_u1__u2',participantIds:['u1','u2']}
  };
  const next=pruneUnavailableGroupThreads(source,{
    liveIds:['chat_u1__u2'],
    removedIds:['training_t1'],
    authoritative:true
  });
  assert.equal(next.training_t1,undefined);
  assert.ok(next.chat_u1__u2);
  assert.ok(source.training_t1,'input must stay immutable');
});

test('authoritative snapshot prunes stale group chats that no longer contain user',()=>{
  const source={
    training_old:{id:'training_old',kind:'training',participantIds:['u1','u2']},
    event_live:{id:'event_live',kind:'event',participantIds:['u1','u3']},
    chat_u1__u4:{id:'chat_u1__u4',participantIds:['u1','u4']}
  };
  const next=pruneUnavailableGroupThreads(source,{
    liveIds:['event_live','chat_u1__u4'],
    authoritative:true
  });
  assert.equal(next.training_old,undefined);
  assert.ok(next.event_live);
  assert.ok(next.chat_u1__u4);
});

test('cache-only snapshot does not purge unseen group chats',()=>{
  const source={training_t1:{id:'training_t1',kind:'training',participantIds:['u1']}};
  const next=pruneUnavailableGroupThreads(source,{liveIds:[],removedIds:['training_t1'],authoritative:false});
  assert.ok(next.training_t1);
});

test('late read responses preserve newer messages and read boundaries',()=>{
 const thread={messages:[{senderId:'other',timestamp:300}],lastMessageAt:300,readAt:{me:100},unreadCount:{me:2}};
 const stale=mergeChatReadResult(thread,'me',{readAt:200,unreadCount:0,lastMessageAt:200});
 assert.equal(stale.unreadCount.me,2);assert.equal(stale.messages[0].read,false);
 const newerRead={...thread,readAt:{me:300},unreadCount:{me:0}};
 const result=mergeChatReadResult(newerRead,'me',{readAt:200,unreadCount:1,lastMessageAt:300});
 assert.equal(result.readAt.me,300);assert.equal(result.unreadCount.me,0);
 const fresh=mergeChatReadResult(thread,'me',{readAt:300,unreadCount:0,lastMessageAt:300});
 assert.equal(fresh.unreadCount.me,0);assert.equal(fresh.messages[0].read,true);
});
