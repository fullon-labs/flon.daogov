import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveProposalPhase,governanceAction,proposalCounts} from './governance.js';

const now=Date.parse('2026-10-25T04:00:00Z');
const proposal=(status,overrides={})=>({proposal_id:7,status,endorsement_end:'2026-10-25T03:00:00',vote_start:'2026-10-25T03:30:00',vote_end:'2026-10-25T03:59:00',execute_after:'2026-10-25T03:30:00',execute_before:'2026-10-25T05:00:00',actions:[],...overrides});

test('derives permissionless lifecycle steps from chain time',()=>{
  assert.equal(effectiveProposalPhase(proposal(0),now),'activation');
  assert.equal(effectiveProposalPhase(proposal(2),now),'finalization');
  assert.equal(effectiveProposalPhase(proposal(4,{actions:[{}]}),now),'queue');
  assert.equal(effectiveProposalPhase(proposal(6),now),'execution');
  assert.equal(effectiveProposalPhase(proposal(6,{execute_before:'2026-10-25T03:59:59'}),now),'expiry');
});

test('does not offer duplicate endorsement or vote actions',()=>{
  const endorsing=proposal(0,{endorsement_end:'2026-10-25T05:00:00'});
  assert.equal(governanceAction(endorsing,{now})?.action,'dao-endorse');
  assert.equal(governanceAction(endorsing,{endorsed:true,now}),null);
  const voting=proposal(2,{vote_end:'2026-10-25T05:00:00'});
  assert.equal(governanceAction(voting,{now})?.action,'dao-vote');
  assert.equal(governanceAction(voting,{voted:true,now}),null);
});

test('counts actionable proposal phases',()=>{
  assert.deepEqual(proposalCounts([
    proposal(0,{endorsement_end:'2026-10-25T05:00:00'}),
    proposal(2,{vote_end:'2026-10-25T05:00:00'}),
    proposal(6),
  ],now),{endorsement:1,voting:1,execution:1});
});
