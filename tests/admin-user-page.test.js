import test from 'node:test';
import assert from 'node:assert/strict';
import {readAdminUserPage} from '../server/admin-user-page.js';
function fixture(){
 const users=Array.from({length:305},(_,i)=>({id:'u'+String(i).padStart(3,'0'),name:'Человек '+i}));
 const doc=row=>({id:row?.id,exists:Boolean(row),data:()=>row});
 const db={collection(name){
  return {
   doc(id){return {async get(){return doc(name==='users'?users.find(u=>u.id===id):undefined);}};},
   orderBy(){let cursor='';return {limit(){return this;},startAfter(id){cursor=id;return this;},async get(){return {docs:users.filter(u=>u.id>cursor).slice(0,100).map(doc)};}};}
  };
 }};
 const map=d=>({...d.data(),email:'',districtId:'',sports:[]});
 return {db,map};
}
test('admin pages reach every account beyond old 250 cap without duplicates',async()=>{
 const {db,map}=fixture();let cursor=null;const ids=[];
 do{const page=await readAdminUserPage(db,{},map,'',cursor);ids.push(...page.users.map(u=>u.id));cursor=page.nextCursor;}while(cursor);
 assert.equal(ids.length,305);assert.equal(new Set(ids).size,305);assert.equal(ids.at(-1),'u304');
});
test('empty filtered page explicitly retains continuation and later match is reachable',async()=>{
 const {db,map}=fixture();
 const first=await readAdminUserPage(db,{},map,'Человек 304');
 assert.equal(first.users.length,0);assert.equal(first.nextCursor,'u099');
 const last=await readAdminUserPage(db,{},map,'Человек 304','u299');
 assert.equal(last.users[0].id,'u304');assert.equal(last.nextCursor,null);
});
test('exact UID and Firebase email bypass pagination and never become false empty on auth failure',async()=>{
 const {db,map}=fixture();
 assert.equal((await readAdminUserPage(db,{},map,'u304')).users[0].id,'u304');
 const auth={async getUserByEmail(){return {uid:'u304'};}};
 assert.equal((await readAdminUserPage(db,auth,map,'person@example.org')).users[0].id,'u304');
 await assert.rejects(readAdminUserPage(db,{getUserByEmail:async()=>{throw new Error('unavailable');}},map,'a@b.org'),/unavailable/);
});
