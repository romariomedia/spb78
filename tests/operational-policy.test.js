import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveOperations,operationDenial} from '../shared/operational-policy.js';
test('legacy nonfunctional flags cannot accidentally disable existing product after deployment',()=>{
 const c=effectiveOperations({featureFlags:{storiesEnabled:false},product:{maintenanceMode:true}});
 assert.equal(c.featureFlags.storiesEnabled,true);assert.equal(c.maintenanceMode,false);
});
test('explicit switches block corresponding operations but preserve unrelated actions',()=>{
 const c=effectiveOperations({operationsVersion:1,featureFlags:{datingEnabled:false,storiesEnabled:false,boxEnabled:false}});
 assert.equal(operationDenial(c,'stories').status,403);
 assert.equal(operationDenial(c,'sportbuddy-mutation','match').code,'FEATURE_DISABLED');
 assert.equal(operationDenial(c,'sportbuddy-mutation','openBox').status,403);
 assert.equal(operationDenial(c,'sportbuddy-mutation','dailyMedal'),null);
 assert.equal(operationDenial(c,'sportbuddy-mutation','chat'),null);
});
test('maintenance leaves recovery controls and payment fulfillment available',()=>{
 const c=effectiveOperations({operationsVersion:1,product:{maintenanceMode:true,maintenanceMessage:'Скоро вернёмся'}});
 for(const r of ['admin-config','admin-request-otp','admin-verify-otp','payment-webhook','app-config','health'])assert.equal(operationDenial(c,r),null);
 assert.equal(operationDenial(c,'create-payment').status,503);
 assert.equal(operationDenial(c,'sportbuddy-mutation','profile').error,'Скоро вернёмся');
});

test('push pause blocks registration and tests but keeps history and logout available',()=>{
 const c=effectiveOperations({operationsVersion:1,featureFlags:{pushEnabled:false}});
 assert.equal(operationDenial(c,'notifications','test').code,'FEATURE_DISABLED');
 assert.equal(operationDenial(c,'notifications','register').status,403);
 for(const action of ['list','stream','read','settings','unregister'])assert.equal(operationDenial(c,'notifications',action),null);
});
