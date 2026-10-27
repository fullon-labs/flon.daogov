import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');

test('voter reward claims match the deployed claimrewards ABI',()=>{
  const start=appSource.indexOf('async function submitClaimRewards(target)');
  const end=appSource.indexOf('async function openBPClaimSheet',start);
  const branch=appSource.slice(start,end);

  assert.ok(start>=0&&end>start,'voter reward claim flow was not found');
  assert.match(branch,/account:'voter\.reward',name:'claimrewards'/);
  assert.match(branch,/data:\{caller:walletSession\.account,voter:walletSession\.account,max_steps:30\}/);
  assert.match(branch,/showToast\(walletErrorMessage\(error\)\)/);
});
