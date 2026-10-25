import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const walletSource=fs.readFileSync(new URL('./wallet.js',import.meta.url),'utf8');

test('an existing HuFu session signs without reopening account or network discovery',()=>{
  const start=walletSource.indexOf("if(session.provider==='hufu')");
  const end=walletSource.indexOf("const anchorSession=",start);
  const hufuTransactionBranch=walletSource.slice(start,end);

  assert.ok(start>=0&&end>start,'HuFu transaction branch was not found');
  assert.doesNotMatch(hufuTransactionBranch,/requestAccountsHuFu/);
  assert.doesNotMatch(hufuTransactionBranch,/confirmInjectedChain/);
  assert.match(hufuTransactionBranch,/provider\.transact\(\{transaction:\{actions:authorized\}\}\)/);
});
