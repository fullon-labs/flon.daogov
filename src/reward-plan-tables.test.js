import test from 'node:test';
import assert from 'node:assert/strict';
import {rewardPlanTableNames} from './wallet.js';

test('queries only reward plan tables declared by the live ABI',()=>{
  assert.deepEqual(rewardPlanTableNames({tables:[{name:'rewardplans'},{name:'rewardepoch'}]}),['rewardplans']);
  assert.deepEqual(rewardPlanTableNames({tables:[{name:'rewardcfgv2'}]}),['rewardcfgv2']);
  assert.deepEqual(rewardPlanTableNames({tables:[{name:'rewardplans'},{name:'rewardcfgv2'}]}),['rewardplans','rewardcfgv2']);
  assert.deepEqual(rewardPlanTableNames({tables:[]}),[]);
  assert.deepEqual(rewardPlanTableNames(null),[]);
});
