import test from 'node:test';
import assert from 'node:assert/strict';
import {formatOverviewAsset,summarizeNetworkEconomics} from './network-summary.js';

test('summarizes BP stake, allocated votes, and internal governance power without floating point loss',()=>{
  assert.deepEqual(summarizeNetworkEconomics(
    [{total_votes:'2000000011'},{total_votes:'3000000000'}],
    [{staked:'1.00000001 FLON'},{staked:'2.50000000 FLON'}],
    {total_power:'99.00000000 POWER'},
  ),{
    totalBpStake:'3.50000001 FLON',
    totalNetworkStake:'102.50000001 FLON',
    totalVotes:'50.00000011 FLON',
    governancePower:'99.00000000 POWER',
  });
});

test('uses an explicit unavailable value when governance state cannot be read',()=>{
  const summary=summarizeNetworkEconomics([],[],{});
  assert.equal(summary.governancePower,'— POWER');
  assert.equal(summary.totalNetworkStake,'— FLON');
});

test('removes meaningless trailing zeroes while preserving real precision',()=>{
  assert.equal(formatOverviewAsset('2000000.00000000 FLON'),'2,000,000 FLON');
  assert.equal(formatOverviewAsset('0.00000000 POWER'),'0 POWER');
  assert.equal(formatOverviewAsset('100.00000000 POWER'),'100 POWER');
  assert.equal(formatOverviewAsset('6799.12000000 POWER'),'6,799.12 POWER');
  assert.equal(formatOverviewAsset('— POWER'),'— POWER');
});
