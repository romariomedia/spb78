import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProfileInput,isPhotoUrl} from '../server/profile-input.js';
import {hasVerificationPhotos} from '../server/profile-verification.js';
import deleteExpired from '../api/delete-expired-profile.js';
const now=Date.parse('2026-10-07T12:00:00Z');
test('invalid profile shapes cannot reach Firestore or grant photo verification',()=>{
 for(const input of [[],null,'name',{age:-999},{age:'30'},{age:30.5},{gender:''},{sports:'Бег'},{sports:[{}]}, {hidePhone:'false'},{bio:{}},{photoPortfolio:['x']},{avatar:'javascript:alert(1)'},{avatar:'data:image/png;base64,AA=='},{photoPortfolio:Array(6).fill('https://example.com/a.jpg')},{birthDate:'2000-02-30'},{birthDate:'2015-01-01'},{deviceId:'x'.repeat(201)}])
  assert.throws(()=>validateProfileInput(input,now),{status:400});
 for(const avatar of ['x','http://example.com/a.jpg','https://user:password@example.com/a.jpg']){
  assert.equal(isPhotoUrl(avatar),false);
  assert.equal(hasVerificationPhotos({avatar,photoPortfolio:['https://example.com/b.jpg']}),false);
 }
});
test('valid partial updates retain clearing semantics and server timestamps',()=>{
 assert.deepEqual(validateProfileInput({avatar:'',photoPortfolio:[],sports:[],birthDate:'',hidePhone:false},now),{avatar:'',photoPortfolio:[],sports:[],birthDate:'',hidePhone:false});
 const result=validateProfileInput({birthDate:'1995-12-05',age:99,lastSeenAt:99999999999999,legalAcceptedAt:'2020-01-01',sports:['Бег','Бег']},now);
 assert.equal(result.age,30);assert.equal(result.lastSeenAt,now);assert.equal(result.legalAcceptedAt,new Date(now).toISOString());assert.deepEqual(result.sports,['Бег']);
 assert.equal(validateProfileInput({birthDate:'2008-10-07'},now).age,18);
 assert.throws(()=>validateProfileInput({birthDate:'2008-10-08'},now),{status:400});
});
test('retired automatic deletion never accesses database or deletes shared chats',()=>{
 const req={method:'POST',get body(){throw Error('must not inspect caller data')},get headers(){throw Error('must not initiate deletion')}};
 const res={status(code){this.code=code;return this},json(body){this.body=body;return this}};
 deleteExpired(req,res);assert.equal(res.code,200);assert.equal(res.body.deleted,false);assert.equal(res.body.reviewRequired,true);
 deleteExpired({method:'DELETE'},res);assert.equal(res.code,405);
});
