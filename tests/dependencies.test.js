import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {initializeApp,deleteApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import {createApiApp} from '../server/app.js';

test('upgraded real Admin SDK and every API module load without contacting services',async()=>{
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const credential=cert({projectId:'sportbuddy-local-compatibility',clientEmail:'test@sportbuddy-local-compatibility.iam.gserviceaccount.com',privateKey:privateKey.export({type:'pkcs8',format:'pem'})});
  credential.getAccessToken=async()=>{throw new Error('Network credentials must not be requested by this test');};
  const app=initializeApp({projectId:'sportbuddy-local-compatibility',credential});
  try {
    assert.equal(typeof getAuth(app).verifyIdToken,'function');
    const db=getFirestore(app);
    assert.equal(db.collection('users').doc('test').path,'users/test');
    assert.equal(Timestamp.fromMillis(1234).toMillis(),1234);
    const api=await createApiApp({apiDir:resolve('api')});
    assert.equal(typeof api.listen,'function');
    await db.terminate();
  } finally {await deleteApp(app);}
});

test('Nodemailer upgrade generates reset and OTP messages using local stream transport',async()=>{
  const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix',disableFileAccess:true,disableUrlAccess:true});
  for(const subject of ['SportBuddy: восстановление пароля','SportBuddy: код входа']){
    const result=await transport.sendMail({from:'no-reply@example.invalid',to:'athlete@example.invalid',subject,text:'Код: 123456',html:'<p>Код: <b>123456</b></p>'});
    assert.deepEqual(result.envelope.to,['athlete@example.invalid']);
    assert.ok(Buffer.isBuffer(result.message));
    assert.match(result.message.toString(),/multipart\/alternative/);
  }
  transport.close();
});
