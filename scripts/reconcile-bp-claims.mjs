#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function usage(message) {
  if (message) console.error(message);
  console.error('Usage: reconcile-bp-claims.mjs --before DIR --after DIR --claims FILE --epoch ID --out FILE');
  process.exit(2);
}

function argsOf(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) usage(`Invalid argument: ${key ?? ''}`);
    args[key.slice(2)] = value;
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assetUnits(asset) {
  const value = String(asset ?? '0.00000000 FLON').split(' ')[0];
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const units = BigInt(whole) * 100000000n + BigInt((fraction + '00000000').slice(0, 8));
  return negative ? -units : units;
}

function formatUnits(units) {
  const negative = units < 0n;
  const unsigned = negative ? -units : units;
  return `${negative ? '-' : ''}${unsigned / 100000000n}.${String(unsigned % 100000000n).padStart(8, '0')} FLON`;
}

function rows(file) {
  if (!fs.existsSync(file)) return [];
  return readJson(file).rows ?? [];
}

function rowTotal(file) {
  return rows(file).reduce((sum, row) => sum + assetUnits(row.quantity), 0n);
}

function balance(file) {
  if (!fs.existsSync(file)) return 0n;
  return assetUnits(readJson(file)[0] ?? '0.00000000 FLON');
}

function producerRows(directory) {
  for (const name of ['producers.json', 'flon-flon-producers.json']) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) return rows(file);
  }
  throw new Error(`Producer snapshot not found in ${directory}`);
}

function snapshotEndBlock(directory) {
  const metadata = path.join(directory, 'metadata.json');
  if (fs.existsSync(metadata) && readJson(metadata).end_head !== undefined) return Number(readJson(metadata).end_head);
  for (const name of ['get_info-end.json', 'get_info.json']) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) return Number(readJson(file).head_block_num);
  }
  throw new Error(`Snapshot end block not found in ${directory}`);
}

const args = argsOf(process.argv.slice(2));
for (const key of ['before', 'after', 'claims', 'epoch', 'out']) if (!args[key]) usage(`Missing --${key}`);

const beforeDir = path.resolve(args.before);
const afterDir = path.resolve(args.after);
const epoch = Number(args.epoch);
if (!Number.isSafeInteger(epoch) || epoch < 0) usage('Invalid --epoch');

const beforeClaimsDir = path.join(beforeDir, 'prodclaims');
const afterClaimsDir = path.join(afterDir, 'prodclaims');
const accountNames = new Set();
for (const directory of [beforeClaimsDir, afterClaimsDir]) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.json')) accountNames.add(entry.name.slice(0, -5));
  }
}

const traceClaims = readJson(path.resolve(args.claims));
if (!Array.isArray(traceClaims)) throw new Error('Claim summary must be an array');
for (const claim of traceClaims) accountNames.add(claim.producer);

const tracesByProducer = new Map();
for (const claim of traceClaims) {
  const transfers = claim.transfers ?? [];
  const invalidRecipient = transfers.some(transfer => transfer.to !== claim.producer);
  const base = transfers.filter(transfer => transfer.from === 'flon' && transfer.memo === 'producer base rewards')
    .reduce((sum, transfer) => sum + assetUnits(transfer.quantity), 0n);
  const gas = transfers.filter(transfer => transfer.from === 'flon.gas' && transfer.memo === 'producer GAS rewards')
    .reduce((sum, transfer) => sum + assetUnits(transfer.quantity), 0n);
  const previous = tracesByProducer.get(claim.producer) ?? { base: 0n, gas: 0n, total: 0n, valid: true, transactions: [], blocks: [] };
  previous.base += base;
  previous.gas += gas;
  previous.total += transfers.reduce((sum, transfer) => sum + assetUnits(transfer.quantity), 0n);
  previous.valid &&= claim.block_status === 'irreversible' && claim.transaction_status === 'executed' && !invalidRecipient;
  previous.transactions.push(claim.transaction_id);
  previous.blocks.push(Number(claim.block_num));
  tracesByProducer.set(claim.producer, previous);
}

const beforeEndBlock = snapshotEndBlock(beforeDir);
const afterEndBlock = snapshotEndBlock(afterDir);
const beforeProducerMap = new Map(producerRows(beforeDir).map(row => [row.owner, row]));
const afterProducerMap = new Map(producerRows(afterDir).map(row => [row.owner, row]));
const changedClaimAccounts = [...new Set([...beforeProducerMap.keys(), ...afterProducerMap.keys()])]
  .filter(producer => beforeProducerMap.get(producer)?.last_claim_time !== afterProducerMap.get(producer)?.last_claim_time)
  .sort();

const accounts = [...accountNames].sort().map(producer => {
  const beforeClaimFile = path.join(beforeClaimsDir, `${producer}.json`);
  const afterClaimFile = path.join(afterClaimsDir, `${producer}.json`);
  const beforeOutstanding = rowTotal(beforeClaimFile);
  const afterOutstanding = rowTotal(afterClaimFile);
  const targetOutstandingAfter = rows(afterClaimFile).filter(row => Number(row.epoch_id) === epoch)
    .reduce((sum, row) => sum + assetUnits(row.quantity), 0n);
  const trace = tracesByProducer.get(producer) ?? { base: 0n, gas: 0n, total: 0n, valid: true, transactions: [], blocks: [] };
  const accruedBase = afterOutstanding - beforeOutstanding + trace.base;
  const beforeBalance = balance(path.join(beforeDir, 'balances', `${producer}.json`));
  const afterBalance = balance(path.join(afterDir, 'balances', `${producer}.json`));
  const balanceDelta = afterBalance - beforeBalance;
  const hasTrace = trace.transactions.length > 0;
  return {
    producer,
    before_outstanding: formatUnits(beforeOutstanding),
    after_outstanding: formatUnits(afterOutstanding),
    irreversible_base_payout: formatUnits(trace.base),
    irreversible_gas_payout: formatUnits(trace.gas),
    accrued_base_reward: formatUnits(accruedBase),
    target_epoch_outstanding_after: formatUnits(targetOutstandingAfter),
    account_balance_delta: formatUnits(balanceDelta),
    trace_total_paid: formatUnits(trace.total),
    trace_transactions: trace.transactions,
    trace_blocks: trace.blocks,
    trace_valid: trace.valid,
    account_entry_exact: !hasTrace || balanceDelta === trace.total,
    nonnegative_accrual: accruedBase >= 0n,
  };
});

const totalAccrued = accounts.reduce((sum, row) => sum + assetUnits(row.accrued_base_reward), 0n);
const result = {
  epoch,
  method: 'after prodclaims - before prodclaims + irreversible base-reward transfers',
  total_accrued_base_reward: formatUnits(totalAccrued),
  traced_claim_count: traceClaims.length,
  assertions: {
    every_changed_last_claim_has_trace: changedClaimAccounts.every(producer => tracesByProducer.has(producer)),
    all_trace_blocks_within_snapshot_window: traceClaims.every(claim => Number(claim.block_num) > beforeEndBlock && Number(claim.block_num) <= afterEndBlock),
    all_claim_traces_irreversible_executed_and_recipient_bound: accounts.every(row => row.trace_valid),
    all_traced_account_entries_exact: accounts.every(row => row.account_entry_exact),
    all_reconstructed_accruals_nonnegative: accounts.every(row => row.nonnegative_accrual),
  },
  snapshot_window: { after_block_exclusive: beforeEndBlock, through_block_inclusive: afterEndBlock },
  changed_last_claim_accounts: changedClaimAccounts,
  accounts,
};
result.pass = Object.values(result.assertions).every(Boolean);

fs.writeFileSync(path.resolve(args.out), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ epoch: result.epoch, total: result.total_accrued_base_reward, assertions: result.assertions, pass: result.pass }, null, 2));
if (!result.pass) process.exitCode = 1;
