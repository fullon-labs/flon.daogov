import assert from 'node:assert/strict';
import test from 'node:test';
import {parseAssetAmount, parseChainTime} from './domain.js';

test('parses chain timestamps as UTC when timezone is absent', () => {
  assert.equal(parseChainTime('2026-10-23T06:00:00.000'), Date.parse('2026-10-23T06:00:00.000Z'));
});
test('parses non-negative FLON assets', () => {
  assert.equal(parseAssetAmount('12.34000000 FLON'), 12.34);
  assert.throws(() => parseAssetAmount('-1.00000000 FLON'), /invalid asset/);
});
