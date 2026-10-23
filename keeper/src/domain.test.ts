import assert from 'node:assert/strict';
import test from 'node:test';
import {adaptivePollDelay, computeEpochState, parseChainTime} from './domain.js';

const intervals = {farMs: 900_000, warmMs: 300_000, nearMs: 60_000};

test('parses chain timestamps as UTC when timezone is absent', () => {
  assert.equal(parseChainTime('2026-10-23T06:00:00.000'), Date.parse('2026-10-23T06:00:00.000Z'));
});

test('epoch becomes due at the first complete epoch boundary', () => {
  const start = Date.parse('2026-10-23T00:00:00Z');
  assert.equal(computeEpochState(start + 6 * 60 * 60 * 1000 - 1, start, 0).due, false);
  assert.equal(computeEpochState(start + 6 * 60 * 60 * 1000, start, 0).due, true);
  const due = computeEpochState(start + 12 * 60 * 60 * 1000, start, 0);
  assert.equal(due.due, true);
  assert.equal(due.currentEpoch, 2);
});

test('adaptive polling gets faster near a boundary', () => {
  const boundary = 1_000_000_000;
  assert.equal(adaptivePollDelay(boundary - 31 * 60_000, boundary, false, intervals), intervals.farMs);
  assert.equal(adaptivePollDelay(boundary - 20 * 60_000, boundary, false, intervals), intervals.warmMs);
  assert.equal(adaptivePollDelay(boundary - 9 * 60_000, boundary, false, intervals), intervals.nearMs);
  assert.equal(adaptivePollDelay(boundary + 1, boundary, true, intervals), intervals.nearMs);
});
