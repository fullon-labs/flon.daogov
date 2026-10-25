import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeNetworkEconomics} from './network-summary.js';

test('summarizes BP stake, allocated votes, and GLON supply without floating point loss',()=>{
  assert.deepEqual(summarizeNetworkEconomics(
    [{total_votes:'2000000011'},{total_votes:'3000000000'}],
    [{staked:'1.00000001 FLON'},{staked:'2.50000000 FLON'}],
    {GLON:{supply:'99.00000000 GLON'}},
  ),{
    totalBpStake:'3.50000001 FLON',
    totalVotes:'50.00000011 FLON',
    governancePower:'99.00000000 GLON',
  });
});

test('uses an explicit unavailable value when GLON stats cannot be read',()=>{
  assert.equal(summarizeNetworkEconomics([],[],{}).governancePower,'— GLON');
});
