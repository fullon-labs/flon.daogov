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
  const start=walletSource.indexOf("if((session.provider==='hufu'||session.provider==='iframe')&&provider?.transact)");
  const end=walletSource.indexOf("if(session.provider==='iframe')",start);
  const hufuTransactionBranch=walletSource.slice(start,end);

  assert.ok(start>=0&&end>start,'HuFu transaction branch was not found');
  assert.doesNotMatch(hufuTransactionBranch,/requestAccountsHuFu/);
  assert.match(hufuTransactionBranch,/confirmTransactionSnapshot\(provider,current,session\.chainId\)/);
  assert.doesNotMatch(hufuTransactionBranch,/confirmInjectedChain\(/);
  assert.doesNotMatch(hufuTransactionBranch,/prepareHuFu\(/);
  assert.doesNotMatch(hufuTransactionBranch,/provider\.(?:request|getInfo|getChainId|getChainID)\(/);
  assert.doesNotMatch(hufuTransactionBranch,/waitForHuFuProvider/);
  assert.doesNotMatch(hufuTransactionBranch,/await wait\(/);
  assert.match(hufuTransactionBranch,/const transaction=config\(\)\.network==='mainnet'/);
  assert.match(hufuTransactionBranch,/provider\.transact\(\{transaction\}\)/);
  assert.match(hufuTransactionBranch,/HUFU_TRANSACTION_TIMEOUT/);
});

test('the injected HuFu signer uses HuFu native testnet actions without awaiting TAPOS',()=>{
  const start=walletSource.indexOf("if((session.provider==='hufu'||session.provider==='iframe')&&provider?.transact)");
  const end=walletSource.indexOf("if(session.provider==='iframe')",start);
  const branch=walletSource.slice(start,end);
  const nativeSigner=branch.indexOf('provider.transact({transaction})');

  assert.ok(nativeSigner>=0,'HuFu native transaction path was not found');
  assert.match(branch,/config\(\)\.network==='mainnet'\?await prepareHuFuTransaction\(authorized\):\{actions:authorized\}/);
});

test('an authenticated HuFu session prefers the iframe native signer when framed',()=>{
  const start=walletSource.indexOf('export async function transact(session,actions)');
  const end=walletSource.indexOf("if(isHuFuApp())throw",start);
  const branch=walletSource.slice(start,end);

  assert.ok(start>=0&&end>start,'transaction dispatch was not found');
  assert.match(branch,/isHuFuApp\(\)&&runtimeClient\.isInIframe\(\)/);
  assert.match(branch,/runtimeClient\.transact\(authorized\)/);
  assert.match(branch,/HUFU_IFRAME_TRANSACTION_TIMEOUT/);
});

test('an iframe session reaches Client transact before the injected bridge',()=>{
  const start=walletSource.indexOf('export async function transact(session,actions)');
  const end=walletSource.indexOf("if(isHuFuApp())throw",start);
  const branch=walletSource.slice(start,end);
  const iframeSigner=branch.indexOf('runtimeClient.transact(authorized)');
  const injected=branch.indexOf("if((session.provider==='hufu'||session.provider==='iframe')&&provider?.transact)");

  assert.ok(iframeSigner>=0&&injected>iframeSigner,'iframe Client signer must precede the injected HuFu bridge');
  assert.match(branch,/const provider=window\.HuFu\|\|null/);
  assert.doesNotMatch(branch,/await prepareHuFu\(\)/);
  assert.match(branch,/provider\.transact\(\{transaction\}\)/);
});

test('wallet restore does not treat iframe geometry as wallet authorization',()=>{
  const start=walletSource.indexOf('export async function restoreWallet()');
  const end=walletSource.indexOf('export async function connectWallet()',start);
  const branch=walletSource.slice(start,end);

  assert.ok(start>=0&&end>start,'wallet restore branch was not found');
  assert.match(branch,/stored\.provider==='iframe'&&runtimeClient\.isInIframe\(\)/);
  assert.ok(branch.indexOf("stored.provider==='iframe'&&runtimeClient.isInIframe()")<branch.indexOf("stored.provider==='hufu'"));
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
  assert.match(restore,/injectedAuthorizationReady=true/);
  assert.doesNotMatch(auto,/requestAccountsHuFu/);
  assert.match(auto,/injectedAuthorizationReady=true/);
});

test('HuFu chain inspection never switches the wallet network on page load',()=>{
  const start=walletSource.indexOf('async function captureHuFuChainInfo');
  const end=walletSource.indexOf('async function prepareHuFu()',start);
  const branch=walletSource.slice(start,end);

  assert.ok(start>=0&&end>start,'HuFu chain inspection branch was not found');
  assert.match(branch,/HuFuGetChain/);
  assert.doesNotMatch(branch,/HuFuSwitchChain/);
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
});
