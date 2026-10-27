import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const walletSource=fs.readFileSync(new URL('./wallet.js',import.meta.url),'utf8');

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
  assert.doesNotMatch(hufuTransactionBranch,/config\(\)\.network==='mainnet'/);
  assert.match(hufuTransactionBranch,/const transaction=await prepareHuFuTransaction\(authorized\)/);
  assert.match(hufuTransactionBranch,/provider\.transact\(\{transaction\}\)/);
  assert.match(hufuTransactionBranch,/HUFU_TRANSACTION_TIMEOUT/);
});

test('HuFu testnet uses chain-derived TAPOS before opening the native signer',()=>{
  const start=walletSource.indexOf("if((session.provider==='hufu'||session.provider==='iframe')&&provider?.transact)");
  const end=walletSource.indexOf("if(session.provider==='iframe')",start);
  const branch=walletSource.slice(start,end);
  const preparation=branch.indexOf('await prepareHuFuTransaction(authorized)');
  const nativeSigner=branch.indexOf('provider.transact({transaction})');

  assert.ok(preparation>=0&&nativeSigner>preparation,'HuFu chain-derived TAPOS path was not found');
  assert.doesNotMatch(branch,/\{actions:authorized\}/);
});

test('the iframe transport is used only by an iframe wallet session',()=>{
  const start=walletSource.indexOf('export async function transact(session,actions)');
  const end=walletSource.indexOf("if(session.provider==='hufu')throw",start);
  const branch=walletSource.slice(start,end);

  assert.ok(start>=0&&end>start,'transaction dispatch was not found');
  assert.match(branch,/session\.provider==='iframe'&&runtimeClient\.isInIframe\(\)/);
  assert.match(branch,/runtimeClient\.transact\(authorized\)/);
  assert.match(branch,/HUFU_IFRAME_TRANSACTION_TIMEOUT/);
});

test('an iframe-authenticated HuFu session prefers the full-transaction bridge',()=>{
  const start=walletSource.indexOf('export async function transact(session,actions)');
  const end=walletSource.indexOf("if(session.provider==='hufu')throw",start);
  const branch=walletSource.slice(start,end);
  const injected=branch.indexOf("session.provider==='hufu'||session.provider==='iframe'");
  const legacyIframe=branch.indexOf("session.provider==='iframe'&&runtimeClient.isInIframe()");

  assert.ok(injected>=0&&legacyIframe>injected,'full-transaction HuFu bridge must precede the legacy iframe fallback');
  assert.match(branch,/const transaction=await prepareHuFuTransaction\(authorized\)/);
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
