import test from 'node:test';
import assert from 'node:assert/strict';
import {pruneUnavailableGroupThreads} from '../shared/chat-cache-policy.js';

test('removed training chat is deleted from local cache while direct chat stays',()=>{
  const source={
    training_t1:{id:'training_t1',kind:'training',participantIds:['u1','u2']},
    chat_u1__u2:{id:'chat_u1__u2',participantIds:['u1','u2']}
  };
  const next=pruneUnavailableGroupThreads(source,{
    liveIds:['chat_u1__u2'],
    removedIds:['training_t1'],
    authoritative:false
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
  const next=pruneUnavailableGroupThreads(source,{liveIds:[],authoritative:false});
  assert.ok(next.training_t1);
});
