import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestCompleteEpoch,summarizeBPProduction } from './production.js';

test('selects the newest closed epoch with a complete sample',()=>{
  const selected=latestCompleteEpoch([
    {epoch_id:728,closed:0,complete_sample:1},
    {epoch_id:727,closed:1,complete_sample:1},
    {epoch_id:729,closed:1,complete_sample:0},
    {epoch_id:726,closed:1,complete_sample:1},
  ]);
  assert.equal(selected.epoch_id,727);
});

test('calculates assigned-slot production without counting idle skipped slots',()=>{
  const summary=summarizeBPProduction([
    {expected_blocks:102,produced_blocks:102,missed_blocks:0,idle_skipped_blocks:2298},
    {expected_blocks:101,produced_blocks:100,missed_blocks:1,idle_skipped_blocks:2299},
    {expected_blocks:100,produced_blocks:100,missed_blocks:0,idle_skipped_blocks:2300},
  ]);
  assert.equal(summary.expected,303n);
  assert.equal(summary.produced,302n);
  assert.equal(summary.missed,1n);
  assert.equal(summary.idleSkipped,6897n);
  assert.equal(summary.rate,99.6699);
});

test('returns no rate when an epoch has no assigned blocks',()=>{
  assert.equal(summarizeBPProduction([]).rate,null);
});
