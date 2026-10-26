import test from 'node:test';
import assert from 'node:assert/strict';
import {iso3166Regions,regionByNumeric,regionDisplayName} from './countries.js';

test('includes the complete ISO 3166-1 country and region set',()=>{
  assert.equal(iso3166Regions.length,249);
  assert.equal(new Set(iso3166Regions.map(([alpha2])=>alpha2)).size,249);
  assert.equal(new Set(iso3166Regions.map(([,numeric])=>numeric)).size,249);
  assert.ok(iso3166Regions.every(([alpha2,numeric])=>/^[A-Z]{2}$/.test(alpha2)&&/^\d{3}$/.test(numeric)));
});

test('resolves chain numeric locations and localized names',()=>{
  assert.deepEqual(regionByNumeric(702),['SG','702']);
  assert.deepEqual(regionByNumeric('156'),['CN','156']);
  assert.equal(regionDisplayName('JP','en'),'Japan');
});
