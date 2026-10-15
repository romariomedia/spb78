import test from 'node:test';
import assert from 'node:assert/strict';
import {androidUpdatePolicy,needsAndroidUpdate} from '../shared/android-update.js';
const ruStoreUrl='https://www.rustore.ru/catalog/app/ru.sportbuddy.mobile';
test('Android updates compare numeric build codes, not version names',()=>{
 const policy=androidUpdatePolicy({minimumAndroidVersion:'12',ruStoreUrl});
 assert.equal(needsAndroidUpdate('9',policy),true);
 for(const build of ['12','13','0','1.0','garbage'])assert.equal(needsAndroidUpdate(build,policy),false);
});
test('update notice stays off without valid build and exact trusted app link',()=>{
 for(const url of ['', 'http://www.rustore.ru/catalog/app/ru.sportbuddy.mobile','https://rustore.ru.evil.test/catalog/app/ru.sportbuddy.mobile','https://www.rustore.ru/catalog/app/other','javascript:alert(1)','https://evil@www.rustore.ru/catalog/app/ru.sportbuddy.mobile'])
  assert.equal(needsAndroidUpdate('1',androidUpdatePolicy({minimumAndroidVersion:'12',ruStoreUrl:url})),false);
 for(const code of ['','1.2','-1','Infinity','2100000001'])assert.equal(needsAndroidUpdate('1',androidUpdatePolicy({minimumAndroidVersion:code,ruStoreUrl})),false);
});
