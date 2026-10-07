import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/send-password-reset.js';

test('legacy password reset rejects arbitrary email and URL without any external calls',async()=>{
 const r={code:200,status(n){this.code=n;return this},json(body){this.body=body;return this}};
 await handler({method:'POST',headers:{},body:{email:'test@example.invalid',resetCode:'123456',resetUrl:'https://example.invalid/untrusted',expiresIn:10}},r);
 assert.equal(r.code,410);assert.equal(r.body.code,'LEGACY_PASSWORD_RESET_DISABLED');
 assert.equal(JSON.stringify(r.body).includes('untrusted'),false);
});
test('retired password reset accepts no other methods',()=>{
 for(const method of ['GET','PUT','DELETE']){
  const r={status(n){this.code=n;return this},json(body){this.body=body;return this}};
  handler({method},r);assert.equal(r.code,405);
 }
});
