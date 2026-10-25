import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountExplorerUrl } from './explorer.js';

test('account links use the corresponding chain explorer', () => {
  assert.equal(accountExplorerUrl('testnet', 'bpflowtest11'), 'https://testnet.flonscan.io/account/bpflowtest11');
  assert.equal(accountExplorerUrl('mainnet', 'bpflowtest11'), 'https://flonscan.io/account/bpflowtest11');
  assert.equal(accountExplorerUrl('unknown', 'bpflowtest11'), null);
});
