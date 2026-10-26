import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const walletSource=fs.readFileSync(new URL('./wallet.js',import.meta.url),'utf8');

test('an existing HuFu session does not reopen account selection',()=>{
  const start=walletSource.indexOf("if(session.provider==='hufu')");
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
  assert.match(hufuTransactionBranch,/config\(\)\.network==='mainnet'/);
  assert.match(hufuTransactionBranch,/\? await prepareHuFuTransaction\(authorized\)/);
  assert.match(hufuTransactionBranch,/: \{actions:authorized\}/);
  assert.match(hufuTransactionBranch,/provider\.transact\(\{transaction\}\)/);
  assert.match(hufuTransactionBranch,/HUFU_TRANSACTION_TIMEOUT/);
});

test('HuFu testnet reaches the native signer without awaiting RPC TAPOS preparation',()=>{
  const start=walletSource.indexOf("if(session.provider==='hufu')");
  const end=walletSource.indexOf("if(session.provider==='iframe')",start);
  const branch=walletSource.slice(start,end);
  const networkChoice=branch.indexOf("config().network==='mainnet'");
  const nativeSigner=branch.indexOf('provider.transact({transaction})');

  assert.ok(networkChoice>=0&&nativeSigner>networkChoice,'HuFu network-specific transaction path was not found');
  assert.match(branch.slice(networkChoice,nativeSigner),/: \{actions:authorized\}/);
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
});
