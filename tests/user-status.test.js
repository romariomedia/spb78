import test from 'node:test';
import assert from 'node:assert/strict';
import { assertUserActive, readUserStatus, requireActiveUser } from '../server/user-status.js';

function dbWith(records) {
  return {
    collection(name) {
      assert.equal(name,'users');
      return {
        doc(id) {
          return {
            async get() {
              const value=records.get(id);
              return { exists:value!==undefined, data:()=>value };
            }
          };
        }
      };
    }
  };
}

test('active profiles pass moderation guard', async()=>{
  assert.doesNotThrow(()=>assertUserActive({isSuspended:false}));
  const db=dbWith(new Map([['u1',{name:'User',isSuspended:false}]]));
  const result=await requireActiveUser(db,'u1');
  assert.equal(result.profile.name,'User');
});

test('suspended profiles fail closed with stable code', async()=>{
  assert.throws(
    ()=>assertUserActive({isSuspended:true}),
    error=>error.status===403&&error.code==='ACCOUNT_SUSPENDED'
  );
  const db=dbWith(new Map([['u1',{isSuspended:true}]]));
  await assert.rejects(
    requireActiveUser(db,'u1'),
    error=>error.status===403&&error.code==='ACCOUNT_SUSPENDED'
  );
});

test('status read allows missing profile only for bootstrap paths', async()=>{
  const db=dbWith(new Map());
  const status=await readUserStatus(db,'new-user');
  assert.equal(status.exists,false);
  assert.equal(status.profile,null);
  await assert.rejects(
    requireActiveUser(db,'new-user'),
    error=>error.status===404&&error.code==='PROFILE_NOT_FOUND'
  );
});
