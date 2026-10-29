import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const walletSource=fs.readFileSync(new URL('./wallet.js',import.meta.url),'utf8');
const appSource=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');

test('BP registration persists the status page on chain',()=>{
  const start=appSource.indexOf('async function submitCandidate');
  const end=appSource.indexOf('async function openBPStakeSheet',start);
  const submission=appSource.slice(start,end);

  assert.ok(start>=0&&end>start,'BP candidate submission was not found');
  assert.match(submission,/name:'regproducer'/);
  assert.match(appSource,/DEFAULT_BP_STATUS_URL='https:\/\/status\.flon\.network'/);
  assert.match(appSource,/statusUrl:DEFAULT_BP_STATUS_URL/);
  assert.match(submission,/status_url:candidateDraft\.statusUrl/);
  assert.match(appSource,/candidateDraft\.statusUrl=state\.producer\.status_url/);
});

test('governance lifecycle actions show immediate signer feedback and recover on failure',()=>{
  const start=appSource.indexOf('async function submitDaoAction');
  const end=appSource.indexOf('function setText',start);
  const submission=appSource.slice(start,end);

  assert.ok(start>=0&&end>start,'governance lifecycle submission was not found');
  assert.match(submission,/target\.textContent=currentLanguage==='zh-CN'\?'正在请求钱包签名…':'Requesting wallet signature…'/);
  assert.match(submission,/showToast\(currentLanguage==='zh-CN'\?'正在打开 HuFu 签名窗口…':'Opening the HuFu signer…'\)/);
  assert.match(submission,/catch\(error\)[\s\S]*target\.disabled=false;[\s\S]*target\.innerHTML=label;/);
});

test('proposal checking completes before a separate direct HuFu actions signing click',()=>{
  const prepareStart=appSource.indexOf('async function submitProposal');
  const confirmStart=appSource.indexOf('async function confirmProposal',prepareStart);
  const confirmEnd=appSource.indexOf('function openVoteProposal',confirmStart);
  const preparation=appSource.slice(prepareStart,confirmStart);
  const confirmation=appSource.slice(confirmStart,confirmEnd);

  assert.ok(prepareStart>=0&&confirmStart>prepareStart&&confirmEnd>confirmStart,'two-stage proposal submission was not found');
  assert.match(preparation,/pendingProposalTransaction=\{action,bytes\}/);
  assert.match(preparation,/data-action="dao-propose-confirm"/);
  assert.match(preparation,/authorizeHuFuSigning\(walletSession\)/);
  assert.ok(preparation.indexOf('authorizeHuFuSigning(walletSession)')<preparation.indexOf('sha256Hex('),'HuFu authorization must be the first asynchronous proposal operation');
  assert.doesNotMatch(preparation,/await transact\(/);
  assert.doesNotMatch(preparation,/prepareHuFuSigningTransaction/);
  assert.match(preparation,/actions\.length\?`\$\{bytes\} bytes`:[^;]*'无执行参数'/);
  assert.match(confirmation,/const prepared=pendingProposalTransaction;[\s\S]*await transact\(walletSession,\[prepared\.action\]\)/);
  assert.doesNotMatch(confirmation,/sha256Hex|serializeGovernanceAction/);
});

test('optional BP status tables cannot fail the whole account status card',()=>{
  const helperStart=walletSource.indexOf('function optionalTableRows');
  const helperEnd=walletSource.indexOf('function utcMilliseconds',helperStart);
  const loadStart=walletSource.indexOf('export async function loadBPAccount');
  const loadEnd=walletSource.indexOf('export async function loadProducerRewards',loadStart);
  const helper=walletSource.slice(helperStart,helperEnd);
  const loader=walletSource.slice(loadStart,loadEnd);

  assert.ok(helperStart>=0&&helperEnd>helperStart,'optional table helper was not found');
  assert.match(helper,/\.catch\(\(\)=>\(\{rows:\[\]\}\)\)/);
  for(const table of ['bpstakecfg','bpstakes','bpstkrefund','bpstatus','rewardepoch','global','bpstats']){
    assert.match(loader,new RegExp(`optionalTableRows\\([^;]*table:'${table}'`));
  }
  assert.match(loader,/const requests=\[\s*rpcPost\([^\n]+table:'producers'/);
});

test('wallet sessions require the selected account to exist on the configured chain',()=>{
  assert.match(walletSource,/ACCOUNT_NOT_FOUND_ON_NETWORK/);
  assert.match(walletSource,/async function assertAccountOnChain\(account\)/);
  const restore=walletSource.slice(walletSource.indexOf('export async function restoreWallet'),walletSource.indexOf('export async function connectWallet'));
  const connect=walletSource.slice(walletSource.indexOf('export async function connectWallet'),walletSource.indexOf('export function autoConnectHuFuWallet'));
  const automatic=walletSource.slice(walletSource.indexOf('export function autoConnectHuFuWallet'),walletSource.indexOf('export async function disconnectWallet'));
  assert.match(restore,/assertAccountOnChain/);
  assert.match(connect,/assertAccountOnChain/);
  assert.match(automatic,/assertAccountOnChain/);
  assert.match(appSource,/当前账户不属于此网络/);
});

test('an existing HuFu session does not reopen account selection',()=>{
  const start=walletSource.indexOf("if(session.provider==='hufu'&&provider?.transact)");
  const end=walletSource.indexOf("if(isHuFuApp())throw",start);
  const hufuTransactionBranch=walletSource.slice(start,end);

  assert.ok(start>=0&&end>start,'HuFu transaction branch was not found');
  assert.doesNotMatch(hufuTransactionBranch,/requestAccountsHuFu/);
  assert.match(hufuTransactionBranch,/confirmTransactionSnapshot\(provider,current,session\.chainId\)/);
  assert.doesNotMatch(hufuTransactionBranch,/confirmInjectedChain\(/);
  assert.doesNotMatch(hufuTransactionBranch,/prepareHuFu\(/);
  assert.doesNotMatch(hufuTransactionBranch,/provider\.(?:request|getInfo|getChainId|getChainID)\(/);
  assert.doesNotMatch(hufuTransactionBranch,/waitForHuFuProvider/);
  assert.doesNotMatch(hufuTransactionBranch,/await wait\(/);
  assert.match(hufuTransactionBranch,/if\(config\(\)\.network!==\'mainnet\'\)return provider\.transact\(\{transaction:\{actions:authorized\}\}\)/);
  assert.match(hufuTransactionBranch,/provider\.transact\(\{transaction\}\)/);
  assert.match(hufuTransactionBranch,/HUFU_TRANSACTION_TIMEOUT/);
});

test('the injected HuFu signer uses HuFu native testnet actions without awaiting TAPOS',()=>{
  const start=walletSource.indexOf("if(session.provider==='hufu'&&provider?.transact)");
  const end=walletSource.indexOf("if(isHuFuApp())throw",start);
  const branch=walletSource.slice(start,end);
  const nativeSigner=branch.indexOf('provider.transact({transaction:{actions:authorized}})');

  assert.ok(nativeSigner>=0,'HuFu native transaction path was not found');
  assert.ok(nativeSigner<branch.indexOf('await prepareHuFuTransaction(authorized)'),'testnet must invoke HuFu before any TAPOS preparation');
  assert.doesNotMatch(branch.slice(0,branch.indexOf('const transaction=options.preparedTransaction')),/Promise\.resolve|timeout\(/);
});

test('a prechecked HuFu transaction is passed directly to the injected signer',()=>{
  const prepareStart=walletSource.indexOf('export async function prepareHuFuSigningTransaction');
  const prepareEnd=walletSource.indexOf('export async function transact',prepareStart);
  const preparation=walletSource.slice(prepareStart,prepareEnd);
  assert.doesNotMatch(preparation,/HuFuSwitchChain|abi_json_to_bin/);
  assert.match(preparation,/return prepareHuFuTransaction\(authorized\)/);
  const start=walletSource.indexOf("if(session.provider==='hufu'&&provider?.transact)");
  const end=walletSource.indexOf("if(isHuFuApp())throw",start);
  const branch=walletSource.slice(start,end);
  assert.match(branch,/options\.preparedTransaction\|\|/);
});

test('proposal preflight validates a restored HuFu session without reopening account selection',()=>{
  const start=walletSource.indexOf('export async function authorizeHuFuSigning');
  const end=walletSource.indexOf('export async function transact',start);
  const authorization=walletSource.slice(start,end);
  assert.doesNotMatch(authorization,/requestAccountsHuFu\(\)/);
  assert.match(authorization,/current&&current\.account!==session\.account/);
  assert.match(authorization,/confirmTransactionSnapshot\(provider,current,session\.chainId\)/);
  assert.match(authorization,/assertAccountOnChain\(session\.account\)/);
});

test('proposal creation checks governance power before opening the proposal form and again before signing',()=>{
  const openStart=appSource.indexOf('function openCreateProposal');
  const openEnd=appSource.indexOf('const governanceActionLabels',openStart);
  assert.match(appSource.slice(openStart,openEnd),/proposalPowerRequirement\(\)\.sufficient/);
  const submitStart=appSource.indexOf('async function submitProposal');
  const submitEnd=appSource.indexOf('async function confirmProposal',submitStart);
  assert.match(appSource.slice(submitStart,submitEnd),/proposalPowerRequirement\(\)\.sufficient/);
});

test('HuFu signing matches FullSwap by preferring the existing HuFu parent bridge',()=>{
  const start=walletSource.indexOf('export async function transact(session,actions,options={})');
  const end=walletSource.indexOf("if(isHuFuApp())throw",start);
  const branch=walletSource.slice(start,end);

  assert.match(walletSource,/import \{Client\} from '@fullon\/flonjs'/);
  assert.match(branch,/if\(window\.parent!==window\)/);
  assert.match(branch,/hufuParentClient\|\|=new Client\(\)/);
  assert.match(branch,/return hufuParentClient\.transact\(authorized\)/);
  assert.match(branch,/const provider=window\.HuFu\|\|null/);
  assert.match(branch,/session\.provider==='hufu'&&provider\?\.transact/);
  assert.match(branch,/provider\.transact\(\{transaction\}\)/);
});

test('HuFu WebView signing ABI-serializes actions for the native Flutter channel',()=>{
  const helperStart=walletSource.indexOf('async function serializeHuFuNativeActions(actions)');
  const helperEnd=walletSource.indexOf('function normalizeAccount',helperStart);
  const helper=walletSource.slice(helperStart,helperEnd);
  const transactStart=walletSource.indexOf('export async function transact(session,actions,options={})');
  const transactEnd=walletSource.indexOf("if(isHuFuApp())throw",transactStart);
  const branch=walletSource.slice(transactStart,transactEnd);

  assert.ok(helperStart>=0&&helperEnd>helperStart,'native HuFu channel helper was not found');
  assert.match(helper,/abi_json_to_bin/);
  assert.match(helper,/return \{\.\.\.action,data:binargs\}/);
  assert.match(helper,/callHandler\('FlutterChannel',message\)/);
  assert.match(helper,/type:'pushTransaction'/);
  assert.match(helper,/data:JSON\.stringify\(\{transaction\}\)/);
  assert.match(helper,/onSignEOSSuccessful/);
  assert.match(helper,/onSignEOSError/);
  assert.match(branch,/const serialized=await serializeHuFuNativeActions\(authorized\)/);
  assert.match(branch,/await prepareHuFuTransaction\(serialized\)/);
  assert.match(branch,/return transactHuFuNativeChannel\(transaction\)/);
});

test('wallet restore migrates legacy iframe sessions to the injected provider',()=>{
  const start=walletSource.indexOf('export async function restoreWallet()');
  const end=walletSource.indexOf('export async function connectWallet()',start);
  const branch=walletSource.slice(start,end);

  assert.ok(start>=0&&end>start,'wallet restore branch was not found');
  assert.match(branch,/\(stored\.provider==='hufu'\|\|stored\.provider==='iframe'\)&&isHuFuApp\(\)/);
  assert.match(branch,/return save\(\{\.\.\.stored,provider:'hufu'\}\)/);
  assert.doesNotMatch(branch,/isInIframe|runtimeClient/);
});

test('HuFu discards a cached Anchor session before reconnecting natively',()=>{
  const start=walletSource.indexOf('export async function restoreWallet()');
  const end=walletSource.indexOf('export async function connectWallet()',start);
  const branch=walletSource.slice(start,end);

  assert.match(branch,/if\(stored\.provider==='anchor'\)[\s\S]*if\(isHuFuApp\(\)\)\{forget\(\);return null\}/);
});

test('a cached injected session restores silently without account selection',()=>{
  const restoreStart=walletSource.indexOf('export async function restoreWallet()');
  const restoreEnd=walletSource.indexOf('export async function connectWallet()',restoreStart);
  const restore=walletSource.slice(restoreStart,restoreEnd);
  const autoStart=walletSource.indexOf('export function autoConnectHuFuWallet()');
  const autoEnd=walletSource.indexOf('export async function disconnectWallet()',autoStart);
  const auto=walletSource.slice(autoStart,autoEnd);

  assert.doesNotMatch(restore,/if\(!current\)return null/);
  assert.doesNotMatch(restore,/requestAccountsHuFu/);
  assert.doesNotMatch(auto,/requestAccountsHuFu/);
});

test('HuFu setup selects only the FullOn chain family',()=>{
  const start=walletSource.indexOf('async function captureHuFuChainInfo');
  const end=walletSource.indexOf('function chainIdFrom',start);
  const branch=walletSource.slice(start,end);

  assert.ok(start>=0&&end>start,'HuFu chain inspection branch was not found');
  assert.match(branch,/HuFuGetChain/);
  assert.match(branch,/HuFuSwitchChain\('FLON'\)/);
  assert.doesNotMatch(branch,/HuFuSwitchChain\('STT'\)/);
});

test('HuFu TAPOS uses irreversible block data and chain-derived expiration',()=>{
  const start=walletSource.indexOf('async function prepareHuFuTransaction');
  const end=walletSource.indexOf('function assertFreshChainTime',start);
  const preparation=walletSource.slice(start,end);

  assert.ok(start>=0&&end>start,'HuFu transaction preparation was not found');
  assert.match(preparation,/last_irreversible_block_num/);
  assert.match(preparation,/last_irreversible_block_id/);
  assert.match(preparation,/ref_block_prefix:blockPrefixFromId/);
  assert.match(preparation,/expiration:expirationFromChainTime/);
  assert.match(walletSource,/const hufuExpirationSeconds=300/);
  assert.match(walletSource,/const hufuTransactionTimeoutMilliseconds=60000/);
});
