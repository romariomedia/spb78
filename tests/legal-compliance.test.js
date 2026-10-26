import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_DISSEMINATION_VERSION,consentedPublicProfile,publicConsentDocument,publicConsentState,revokedPublicConsentDocument
} from '../server/public-consent.js';
import {
  LEGAL_COMPLIANCE_CHECKS,legalChecklistComplete,legalEnvironmentReadiness,sanitizeLegalCompliance
} from '../server/legal-compliance.js';

test('public dissemination consent is explicit, category-scoped and revocable',()=>{
  const granted=publicConsentDocument('u1',['identity','location'],new Date('2026-10-26T09:00:00Z'));
  assert.equal(granted.active,true);
  assert.equal(granted.version,PUBLIC_DISSEMINATION_VERSION);
  assert.deepEqual(granted.groups,['identity','location']);
  assert.match(granted.recipients,/авторизованные пользователи/i);
  assert.throws(()=>publicConsentDocument('u1',[]),{code:'PUBLIC_CONSENT_EMPTY'});
  const state=publicConsentState({publicDissemination:granted});
  assert.equal(state.active,true);
  const revoked=revokedPublicConsentDocument('u1',granted,new Date('2026-10-26T10:00:00Z'));
  assert.equal(publicConsentState({publicDissemination:revoked}).active,false);
});

test('public projection exposes only selected categories and coarsens location',()=>{
  const publicDissemination=publicConsentDocument('u1',['identity','location'],new Date('2026-10-26T09:00:00Z'));
  const projected=consentedPublicProfile('u1',{
    publicDissemination,name:'Athlete',age:30,avatar:'a',sports:['Бег'],bio:'secret profile',
    lat:59.9386123,lng:30.3141456,locationName:'Санкт-Петербург',
    email:'private@example.com',phone:'79990000000',friendIds:['x']
  });
  assert.equal(projected.name,'Athlete');
  assert.equal(projected.locationName,'Санкт-Петербург');
  assert.equal(projected.lat,59.94);
  assert.equal(projected.lng,30.31);
  assert.equal('sports' in projected,false);
  assert.equal('email' in projected,false);
  assert.equal('friendIds' in projected,false);
});

test('legal readiness checklist and environment gates cannot substitute each other',()=>{
  const blank=sanitizeLegalCompliance({});
  assert.equal(legalChecklistComplete(blank),false);
  const complete=sanitizeLegalCompliance({checks:Object.fromEntries(LEGAL_COMPLIANCE_CHECKS.map(key=>[key,true]))});
  assert.equal(legalChecklistComplete(complete),true);
  const env=legalEnvironmentReadiness({
    SB_LEGAL_COMPLIANCE_READY:'false',SB_AD_MARKING_READY:'false',
    YOOKASSA_SHOP_ID:'shop',YOOKASSA_SECRET_KEY:'secret',YOOKASSA_RECEIPT_MODE:'yookassa',
    YOOKASSA_VAT_CODE:'1',YOOKASSA_PAYMENT_MODE:'full_payment'
  });
  assert.equal(env.legalGate,false);
  assert.equal(env.adMarkingGate,false);
  assert.equal(env.yookassaConfigured,true);
  assert.equal(env.receiptMode,true);
  assert.equal(env.vatConfigured,true);
  assert.equal(env.paymentModeConfigured,true);
});
