import test from 'node:test';
import assert from 'node:assert/strict';
import {epochTiming,currentRewardEpoch} from './wallet.js';

test('does not invent an epoch while rewards are disabled',()=>{
  const timing=epochTiming(
    {head_block_time:'2026-11-01T03:58:27.000'},
    {reward_started_time:'1970-01-01T00:00:00.000'},
    [],
    null,
    null,
  );
  assert.equal(timing.available,false);
  assert.equal(timing.reason,'rewards_disabled');
  assert.equal(timing.targetEpoch,undefined);
});

test('uses contract epoch ids instead of deriving them from wall clock time',()=>{
  const timing=epochTiming(
    {head_block_time:'2026-11-01T04:00:00.000'},
    {reward_started_time:'2026-11-01T00:00:00.000'},
    [],
    7,
    null,
  );
  assert.equal(timing.available,true);
  assert.equal(timing.currentEpoch,7);
  assert.equal(timing.targetEpoch,8);
});

test('uses pendingvote activation_epoch as the effective epoch',()=>{
  const timing=epochTiming(
    {head_block_time:'2026-11-01T04:00:00.000'},
    {reward_started_time:'2026-11-01T00:00:00.000'},
    [],
    7,
    12,
  );
  assert.equal(timing.currentEpoch,7);
  assert.equal(timing.targetEpoch,12);
});

test('current BP epoch follows slot plans across duration changes and ignores settlement backlog',()=>{
  const start=Date.UTC(2026,10,1),slot=(start-Date.UTC(2000,0,1))/500;
  const plans=[{first_epoch_id:0,start_slot:slot,epoch_slots:43200},{first_epoch_id:2,start_slot:slot+86400,epoch_slots:7200}];
  const global={reward_started_time:'2026-11-01T00:00:00.000'};
  assert.equal(currentRewardEpoch({head_block_time:'2026-11-01T11:59:59.500'},global,plans),1);
  assert.equal(currentRewardEpoch({head_block_time:'2026-11-01T12:00:00.000'},global,plans),2);
  assert.equal(currentRewardEpoch({head_block_time:'2026-11-01T15:00:00.000'},global,plans),5);
  assert.equal(currentRewardEpoch({head_block_time:'invalid'},global,plans),null);
});
