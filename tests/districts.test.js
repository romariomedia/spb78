import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS, districtLabel, matchesDistrict, validateDistrictId } from '../shared/districts.js';
test('district catalog keeps city and oblast names separate',()=>{
  assert.equal(DISTRICTS.length,36);
  assert.equal(new Set(DISTRICTS.map(d=>d.id)).size,36);
  assert.equal(DISTRICTS.filter(d=>d.region==='spb').length,18);
  assert.notEqual(districtLabel('spb-vyborgsky'),districtLabel('lo-vyborgsky'));
  assert.notEqual(districtLabel('spb-kirovsky'),districtLabel('lo-kirovsky'));
  assert.equal(validateDistrictId(null),'');
  assert.throws(()=>validateDistrictId('Выборгский'));
});
test('district search includes legacy records only when no district is selected',()=>{
  const records=[{id:1,districtId:'spb-vyborgsky'},{id:2,districtId:'lo-vyborgsky'},{id:3}];
  assert.equal(records.filter(t=>matchesDistrict(t,'')).length,3);
  assert.deepEqual(records.filter(t=>matchesDistrict(t,'lo-vyborgsky')).map(t=>t.id),[2]);
});
