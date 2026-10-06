import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAdminSession, requireProductionAdminSecrets, writeAdminAudit } from '../server/admin-control.js';

test('admin secrets fail closed without production configuration',()=>{
  const oldPassword=process.env.ADMIN_ACCESS_PASSWORD;
  const oldPepper=process.env.ADMIN_OTP_PEPPER;
  try{
    delete process.env.ADMIN_ACCESS_PASSWORD;delete process.env.ADMIN_OTP_PEPPER;
    assert.throws(()=>requireProductionAdminSecrets(),error=>error.status===503);
    process.env.ADMIN_ACCESS_PASSWORD='secret';process.env.ADMIN_OTP_PEPPER='dev-pepper';
    assert.throws(()=>requireProductionAdminSecrets(),error=>error.status===503);
    process.env.ADMIN_OTP_PEPPER='real-random-pepper';
    assert.doesNotThrow(()=>requireProductionAdminSecrets());
  }finally{
    if(oldPassword===undefined)delete process.env.ADMIN_ACCESS_PASSWORD;else process.env.ADMIN_ACCESS_PASSWORD=oldPassword;
    if(oldPepper===undefined)delete process.env.ADMIN_OTP_PEPPER;else process.env.ADMIN_OTP_PEPPER=oldPepper;
  }
});

test('admin session accepts active sessions and deletes expired sessions',async()=>{
  const records=new Map([
    ['adminSessions/live',{email:'support@sportbuddy78.ru',adminKey:'a',expiresAt:{toMillis:()=>Date.now()+60000}}],
    ['adminSessions/old',{email:'support@sportbuddy78.ru',adminKey:'a',expiresAt:{toMillis:()=>Date.now()-1}}]
  ]);
  const db={doc(path){return {path,async get(){return {exists:records.has(path),data:()=>records.get(path)};},async delete(){records.delete(path);}};}};
  const live=await requireAdminSession(db,'live');assert.equal(live.email,'support@sportbuddy78.ru');
  await assert.rejects(requireAdminSession(db,'old'),error=>error.status===401);
  assert.equal(records.has('adminSessions/old'),false);
});

test('admin audit records actor, entity and snapshots',async()=>{
  const records=new Map();
  const db={collection(name){return {doc(id){return {async set(value){records.set(name+'/'+id,value);}};}};}};
  await writeAdminAudit(db,{email:'support@sportbuddy78.ru',adminKey:'admin'},{
    action:'venue.update',entityType:'venue',entityId:'nova',before:{price:'1'},after:{price:'2'},requestId:'req'
  });
  assert.equal(records.size,1);
  const entry=[...records.values()][0];
  assert.equal(entry.adminEmail,'support@sportbuddy78.ru');
  assert.equal(entry.action,'venue.update');assert.equal(entry.entityId,'nova');
  assert.deepEqual(entry.before,{price:'1'});assert.deepEqual(entry.after,{price:'2'});
});
