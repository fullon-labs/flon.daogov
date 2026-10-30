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
  const run=new Function('window','refreshVotingAccount','draftVoteAllocations','restoreVoteAllocations','votingState','refreshElection',`
    let epochBoundaryRefreshPromise=null,epochBoundaryRefreshAt=0;
    ${source.slice(start,end)}
    refreshAfterEpochBoundary();return ()=>epochBoundaryRefreshPromise;
  `);
  const getPending=run({setTimeout:callback=>callback()},()=>pending,()=>selection.map(item=>({...item})),draft=>{selection=draft.filter(item=>item.votes>0n)},{},async()=>{});
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
  await run();
  assert.equal(calls,0);
});
test('initial account data failure keeps the authenticated wallet and draft',async()=>{
  const start=source.indexOf('async function initializeWallet(){');
  const end=source.indexOf('initializeWallet().catch',start);
  const session={account:'flonflonflon'};
  const run=new Function('restoreWallet','isHuFuApp','renderWallet','refreshVotingAccount','refreshGovernance','console',`let walletSession=null;${source.slice(start,end)};return async()=>{await initializeWallet();return walletSession}`)(async()=>session,()=>false,()=>{},async()=>{throw new Error('RPC timeout')},async()=>{}, {error(){}});
  assert.equal(await run(),session);
});

test('pending vote boundary agrees with contract materialization',()=>{
  const wallet=fs.readFileSync(new URL('./wallet.js',import.meta.url),'utf8');
  const expression=wallet.match(/const hasUnsettledVote=([\s\S]*?);/)[1];
  const pending=new Function('pendingAllocation','pending','pendingActivationEpoch','nextEpoch',`return ${expression}`);
  assert.equal(pending({},null,847,846),true);
  assert.equal(pending({},null,847,847),false);
  assert.equal(pending({},null,847,848),false);
  assert.equal(pending(null,null,847,846),false);
});
test('epoch boundary requests candidate refresh with draft preservation',async()=>{
  const body=source.slice(source.indexOf('function refreshAfterEpochBoundary(){'),source.indexOf('function updateEpochCountdown()'));
  const calls=[];
  const run=new Function('window','refreshVotingAccount','refreshElection',`let epochBoundaryRefreshPromise=null,epochBoundaryRefreshAt=0;${body};refreshAfterEpochBoundary();return epochBoundaryRefreshPromise`);
  await run({setTimeout:fn=>fn()},async()=>calls.push('account'),async options=>calls.push(options));
  assert.deepEqual(calls,['account',{preserveDraft:true}]);
});
test('candidate votes and ranks refresh without touching draft inputs',async()=>{
  const start=source.indexOf('async function refreshElection('),end=source.indexOf('async function refreshVotingAccount()',start);
  const amount={value:''},checkbox={checked:true},votes={textContent:'old'},rank={textContent:'09'};
  const row={dataset:{producer:'alice'},querySelector(selector){return {'.node-votes strong':votes,'.rank':rank,'[data-node-votes]':amount,'input[type="checkbox"]':checkbox}[selector]}};
  let finish;
  const pending=new Promise(resolve=>finish=resolve);
  const run=new Function('loadElection','loadNetworkProduction','document','formatVotes',`let electionRefreshing=false,voteDraftDirty=true,electionState=null,electionLastRefresh=0;${source.slice(start,end)};return refreshElection`)(()=>pending,async()=>({available:false}),{querySelectorAll:()=>[row]},String);
  const refresh=run({preserveDraft:true});
  amount.value='2.50000000';
  finish({producers:[{owner:'alice',total_votes:'918.79761905'}]});
  await refresh;
  assert.equal(votes.textContent,'918.79761905');
  assert.equal(rank.textContent,'01');
  assert.equal(row.dataset.rank,'1');
  assert.equal(amount.value,'2.50000000');
  assert.equal(checkbox.checked,true);
});
