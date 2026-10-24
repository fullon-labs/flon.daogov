import assert from 'node:assert/strict';
import test from 'node:test';
import {loadConfig} from './config.js';

const chainId = 'a'.repeat(64);

test('keeper is dry-run by default', () => {
  const config = loadConfig({KEEPER_RPC_URL: 'https://rpc.example', KEEPER_CHAIN_ID: chainId});
  assert.equal(config.broadcast, false);
  assert.equal(config.epochMs, 21_600_000);
});

test('invalid chain IDs fail closed', () => {
  assert.throws(
    () => loadConfig({KEEPER_RPC_URL: 'https://rpc.example', KEEPER_CHAIN_ID: 'testnet'}),
    /64-character hexadecimal chain ID/,
  );
});

test('broadcast mode requires an explicit signer and key file', () => {
  assert.throws(
    () => loadConfig({
      KEEPER_RPC_URL: 'https://rpc.example',
      KEEPER_CHAIN_ID: chainId,
      KEEPER_BROADCAST: 'true',
    }),
    /requires KEEPER_SIGNER_ACTOR and KEEPER_PRIVATE_KEY_FILE/,
  );
});
