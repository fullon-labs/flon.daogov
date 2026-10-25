import test from 'node:test';
import assert from 'node:assert/strict';
import {formatVoteInput,voteAllocationChanges} from './vote-diff.js';

test('vote allocation diff lists additions, changes, and removals',()=>{
  const changes=voteAllocationChanges(
    [{producer:'bp-a',votes:'2000000000'},{producer:'bp-b',votes:'3000000000'}],
    [{producer:'bp-a',votes:'2500000000'},{producer:'bp-c',votes:'5000000000'}],
  );
  assert.deepEqual(changes,[
    {producer:'bp-a',previous:2000000000n,next:2500000000n,type:'changed'},
    {producer:'bp-b',previous:3000000000n,next:0n,type:'removed'},
    {producer:'bp-c',previous:0n,next:5000000000n,type:'added'},
  ]);
});

test('vote allocation diff is empty when allocations are unchanged',()=>{
  assert.deepEqual(voteAllocationChanges(
    [{producer:'bp-b',votes:'20'},{producer:'bp-a',votes:'10'}],
    [{producer:'bp-a',votes:10n},{producer:'bp-b',votes:20n}],
  ),[]);
});

test('vote input formatting removes insignificant decimal zeroes',()=>{
  assert.equal(formatVoteInput(1000000000n),'10');
  assert.equal(formatVoteInput(1010000000n),'10.1');
  assert.equal(formatVoteInput(1000000011n),'10.00000011');
  assert.equal(formatVoteInput(0n),'0');
});
