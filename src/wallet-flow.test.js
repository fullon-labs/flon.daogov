import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const walletSource=fs.readFileSync(new URL('./wallet.js',import.meta.url),'utf8');

test('an existing HuFu session follows the proven HuFu signing flow without reopening account selection',()=>{
  const start=walletSource.indexOf("if(session.provider==='hufu')");
  const end=walletSource.indexOf('const info=await rpcInfo()',start);
  const hufuTransactionBranch=walletSource.slice(start,end);

  assert.ok(start>=0&&end>start,'HuFu transaction branch was not found');
  assert.doesNotMatch(hufuTransactionBranch,/requestAccountsHuFu/);
  assert.match(hufuTransactionBranch,/confirmTransactionSnapshot\(provider,current,session\.chainId\)/);
  assert.doesNotMatch(hufuTransactionBranch,/confirmInjectedChain\(/);
  assert.doesNotMatch(hufuTransactionBranch,/prepareHuFu\(/);
  assert.doesNotMatch(hufuTransactionBranch,/provider\.(?:request|getInfo|getChainId|getChainID)\(/);
  assert.doesNotMatch(hufuTransactionBranch,/await rpcInfo\(\)/);
  assert.doesNotMatch(hufuTransactionBranch,/waitForHuFuProvider/);
  assert.doesNotMatch(hufuTransactionBranch,/await wait\(/);
  assert.match(hufuTransactionBranch,/provider\.transact\(\{transaction:\{actions:authorized\}\}\)/);
  assert.match(hufuTransactionBranch,/HUFU_TRANSACTION_TIMEOUT/);
});

test('HuFu transact is invoked before asynchronous RPC validation',()=>{
  const hufuBranch=walletSource.indexOf("if(session.provider==='hufu')");
  const providerTransact=walletSource.indexOf('provider.transact({transaction:{actions:authorized}})',hufuBranch);
  const rpcValidation=walletSource.indexOf('const info=await rpcInfo()',hufuBranch);

  assert.ok(hufuBranch>=0&&providerTransact>hufuBranch,'HuFu transact call was not found');
  assert.ok(rpcValidation>providerTransact,'RPC validation must not precede the native HuFu approval request');
});
