import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
test('epoch refresh keeps selections made while the request is pending, including blank amounts',async()=>{
  const start=source.indexOf('function refreshAfterEpochBoundary(){');
  const end=source.indexOf('function updateEpochCountdown()',start);
  let finish;
  const pending=new Promise(resolve=>{finish=resolve});
  let selection=[{producer:'oldbp',votes:1n}];
  const run=new Function('window','refreshVotingAccount','draftVoteAllocations','restoreVoteAllocations','votingState',`
    let epochBoundaryRefreshPromise=null,epochBoundaryRefreshAt=0;
    ${source.slice(start,end)}
    refreshAfterEpochBoundary();return ()=>epochBoundaryRefreshPromise;
  `);
  const getPending=run({setTimeout:callback=>callback()},()=>pending,()=>selection.map(item=>({...item})),draft=>{selection=draft.filter(item=>item.votes>0n)},{});
  await Promise.resolve();
  selection.push({producer:'newbp',votes:0n});
  finish();await getPending();
  assert.deepEqual(selection,[{producer:'oldbp',votes:1n},{producer:'newbp',votes:0n}]);
});
test('candidate refresh does not rebuild the editable list while a draft exists',async()=>{
  const start=source.indexOf('async function refreshElection(');
  const end=source.indexOf('async function refreshVotingAccount()',start);
  let calls=0;
  const run=new Function('loadElection',`let electionRefreshing=false,voteDraftDirty=true;${source.slice(start,end)};return refreshElection;`)(()=>{calls++;throw new Error('Must not reload draft')});
  await run({preserveDraft:true});
  assert.equal(calls,0);
});
test('initial account data failure keeps the authenticated wallet and draft',async()=>{
  const start=source.indexOf('async function initializeWallet(){');
  const end=source.indexOf('initializeWallet().catch',start);
  const session={account:'flonflonflon'};
  const run=new Function('restoreWallet','isHuFuApp','renderWallet','refreshVotingAccount','refreshGovernance','console',`let walletSession=null;${source.slice(start,end)};return async()=>{await initializeWallet();return walletSession}`)(async()=>session,()=>false,()=>{},async()=>{throw new Error('RPC timeout')},async()=>{}, {error(){}});
  assert.equal(await run(),session);
});
