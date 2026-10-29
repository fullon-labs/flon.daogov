import test from 'node:test';
import assert from 'node:assert/strict';
import {abiFieldValue,actionAbiFields,effectiveProposalPhase,enabledAllowlist,governanceAction,proposalCounts,validateFrozenActions} from './governance.js';

const now=Date.parse('2026-10-25T04:00:00Z');
const proposal=(status,overrides={})=>({proposal_id:7,status,endorsement_end:'2026-10-25T03:00:00',vote_start:'2026-10-25T03:30:00',vote_end:'2026-10-25T03:59:00',execute_after:'2026-10-25T03:30:00',execute_before:'2026-10-25T05:00:00',actions:[],...overrides});

test('derives permissionless lifecycle steps from chain time',()=>{
  assert.equal(effectiveProposalPhase(proposal(0),now),'activation');
  assert.equal(effectiveProposalPhase(proposal(2),now),'finalization');
  assert.equal(effectiveProposalPhase(proposal(4),now),'closed');
  assert.equal(effectiveProposalPhase(proposal(4,{actions:[{}]}),now),'queue');
  assert.equal(effectiveProposalPhase(proposal(6),now),'closed');
  assert.equal(effectiveProposalPhase(proposal(6,{actions:[{}]}),now),'execution');
  assert.equal(effectiveProposalPhase(proposal(6,{actions:[{}],execute_before:'2026-10-25T03:59:59'}),now),'expiry');
});

test('does not offer duplicate endorsement or vote actions',()=>{
  const endorsing=proposal(0,{endorsement_end:'2026-10-25T05:00:00'});
  assert.equal(governanceAction(endorsing,{now})?.action,'dao-endorse');
  assert.equal(governanceAction(endorsing,{endorsed:true,now}),null);
  const voting=proposal(2,{vote_end:'2026-10-25T05:00:00'});
  assert.equal(governanceAction(voting,{now})?.action,'dao-vote');
  assert.equal(governanceAction(voting,{voted:true,now}),null);
});

test('does not offer queue or execute for signal proposals without frozen actions',()=>{
  assert.equal(governanceAction(proposal(4),{now}),null);
  assert.equal(governanceAction(proposal(6),{now}),null);
});

test('counts actionable proposal phases',()=>{
  assert.deepEqual(proposalCounts([
    proposal(0,{endorsement_end:'2026-10-25T05:00:00'}),
    proposal(2,{vote_end:'2026-10-25T05:00:00'}),
    proposal(6,{actions:[{}]}),
  ],now),{endorsement:1,voting:1,execution:1});
});

test('normalizes enabled allowlist rules and validates frozen action bytes',()=>{
  const rules=enabledAllowlist([
    {contract:'dao.treasury',action_name:'pay',max_data_bytes:512,enabled:1},
    {contract:'dao.gov',action_name:'setconfig',max_data_bytes:256,enabled:0},
  ]);
  assert.deepEqual(rules,[{contract:'dao.treasury',action:'pay',maxBytes:512}]);
  assert.equal(validateFrozenActions([{contract:'dao.treasury',action_name:'pay',data:'00ff'}],rules,{max_actions:10,max_action_bytes:4096,max_total_action_bytes:16384}),2);
  assert.throws(()=>validateFrozenActions([{contract:'dao.gov',action_name:'setconfig',data:'00'}],rules,{max_actions:10,max_action_bytes:4096,max_total_action_bytes:16384}),/ACTION_NOT_ALLOWLISTED/);
});

test('derives action fields from ABI structs and aliases',()=>{
  const abi={types:[{new_type_name:'grant_id',type:'uint64'}],actions:[{name:'pay',type:'pay_args'}],structs:[{name:'base_args',base:'',fields:[{name:'grant_id',type:'grant_id'}]},{name:'pay_args',base:'base_args',fields:[{name:'quantity',type:'asset'},{name:'memo',type:'string?'},{name:'recipients',type:'name[]'}]}]};
  assert.deepEqual(actionAbiFields(abi,'pay'),[
    {name:'grant_id',type:'grant_id',baseType:'uint64',array:false,optional:false,structured:false},
    {name:'quantity',type:'asset',baseType:'asset',array:false,optional:false,structured:false},
    {name:'memo',type:'string?',baseType:'string',array:false,optional:true,structured:false},
    {name:'recipients',type:'name[]',baseType:'name',array:true,optional:false,structured:false},
  ]);
});

test('normalizes ABI form values without constructing binary locally',()=>{
  assert.equal(abiFieldValue({name:'grant_id',baseType:'uint64'},'42'),'42');
  assert.equal(abiFieldValue({name:'enabled',baseType:'bool'},'',true),true);
  assert.equal(abiFieldValue({name:'memo',baseType:'string',optional:true},''),null);
  assert.deepEqual(abiFieldValue({name:'recipients',baseType:'name',array:true},'["alice","bob"]'),['alice','bob']);
  assert.throws(()=>abiFieldValue({name:'grant_id',baseType:'uint64'},'4.2'),/INVALID_ABI_FIELD/);
});
