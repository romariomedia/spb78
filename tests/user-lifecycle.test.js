import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDeletionSafety } from '../server/user-lifecycle.js';

function emptyCounts(){
  return {
    goals:0,checkins:0,feed:0,chats:0,trainingsOwned:0,trainingsJoined:0,
    friendRequestsFrom:0,friendRequestsTo:0,friendships:0,leisureOwned:0,leisureJoined:0,
    stories:0,ratingsGiven:0,ratingsReceived:0,workoutCredits:0,promoCodes:0,pushDevices:0,
    payments:0,paymentRequests:0,reportsSent:0,reportsReceived:0
  };
}

test('only suspended empty unverified account can be a deletion candidate',()=>{
  const result=evaluateDeletionSafety({
    email:'test@example.com',
    user:{isVerified:false,isSuspended:true,hasRealPhoto:false,totalWorkouts:0,avatar:'',photoPortfolio:[]},
    counts:emptyCounts(),
    authDisabled:true
  });
  assert.equal(result.safeToDelete,true);
  assert.equal(result.classification,'test_candidate');
  assert.equal(result.blockers.length,0);
});

test('admin, verified or active account cannot be deleted',()=>{
  const admin=evaluateDeletionSafety({email:'support@sportbuddy78.ru',user:{isSuspended:true},counts:emptyCounts(),authDisabled:true});
  assert.equal(admin.safeToDelete,false);
  assert.ok(admin.blockers.some(x=>x.includes('администратора')));

  const verified=evaluateDeletionSafety({email:'u@example.com',user:{isVerified:true,isSuspended:true},counts:emptyCounts(),authDisabled:true});
  assert.equal(verified.safeToDelete,false);

  const active=evaluateDeletionSafety({email:'u@example.com',user:{isVerified:false,isSuspended:false},counts:emptyCounts(),authDisabled:false});
  assert.equal(active.safeToDelete,false);
});

test('financial social moderation content and media records are hard blockers',()=>{
  for(const [key,value] of [
    ['payments',1],['chats',1],['reportsReceived',1],['feed',1],['ratingsGiven',1],
    ['trainingsJoined',1],['promoCodes',1]
  ]){
    const counts=emptyCounts();counts[key]=value;
    const result=evaluateDeletionSafety({
      email:'u@example.com',
      user:{isVerified:false,isSuspended:true,hasRealPhoto:false,totalWorkouts:0,avatar:'',photoPortfolio:[]},
      counts,authDisabled:true
    });
    assert.equal(result.safeToDelete,false,key);
  }
  const media=evaluateDeletionSafety({
    email:'u@example.com',user:{isVerified:false,isSuspended:true,totalWorkouts:0,avatar:'https://img',photoPortfolio:[]},
    counts:emptyCounts(),authDisabled:true
  });
  assert.equal(media.safeToDelete,false);
  assert.ok(media.blockers.some(x=>x.includes('медиахранилища')));
});
