import test from 'node:test';
import assert from 'node:assert/strict';
import {epochTiming} from './wallet.js';

test('does not invent an epoch while rewards are disabled',()=>{
  const timing=epochTiming(
    {head_block_time:'2026-11-01T03:58:27.000'},
    {reward_started_time:'1970-01-01T00:00:00.000'},
    [],
    null,
    null,
  );
  assert.equal(timing,null);
});

test('uses contract epoch ids instead of deriving them from wall clock time',()=>{
  const timing=epochTiming(
    {head_block_time:'2026-11-01T04:00:00.000'},
    {reward_started_time:'2026-11-01T00:00:00.000'},
    [],
    7,
    null,
  );
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
