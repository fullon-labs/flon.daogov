import {DEFAULT_EPOCH_MS} from './domain.js';

export interface KeeperConfig {
  rpcUrl: string;
  expectedChainId: string;
  contract: string;
  broadcast: boolean;
  epochMs: number;
  maxHeadAgeMs: number;
  maxCatchupPerCycle: number;
  confirmationPollMs: number;
  confirmationTimeoutMs: number;
  farPollMs: number;
  warmPollMs: number;
  nearPollMs: number;
  errorBackoffMaxMs: number;
  healthPort: number;
  lockFile: string;
}

function positiveInteger(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${key} must be a positive integer`);
  return value;
}

function boolean(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`${key} must be true/false or 1/0`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): KeeperConfig {
  const rpcUrl = env.KEEPER_RPC_URL?.replace(/\/$/, '');
  const expectedChainId = env.KEEPER_CHAIN_ID?.toLowerCase();
  if (!rpcUrl) throw new Error('KEEPER_RPC_URL is required');
  try {
    new URL(rpcUrl);
  } catch {
    throw new Error('KEEPER_RPC_URL must be an absolute URL');
  }
  if (!expectedChainId || !/^[0-9a-f]{64}$/.test(expectedChainId)) {
    throw new Error('KEEPER_CHAIN_ID must be a 64-character hexadecimal chain ID');
  }

  return {
    rpcUrl,
    expectedChainId,
    contract: env.KEEPER_CONTRACT || 'flon',
    broadcast: boolean(env, 'KEEPER_BROADCAST', false),
    epochMs: positiveInteger(env, 'KEEPER_EPOCH_MS', DEFAULT_EPOCH_MS),
    maxHeadAgeMs: positiveInteger(env, 'KEEPER_MAX_HEAD_AGE_MS', 90_000),
    maxCatchupPerCycle: positiveInteger(env, 'KEEPER_MAX_CATCHUP_PER_CYCLE', 16),
    confirmationPollMs: positiveInteger(env, 'KEEPER_CONFIRMATION_POLL_MS', 3_000),
    confirmationTimeoutMs: positiveInteger(env, 'KEEPER_CONFIRMATION_TIMEOUT_MS', 180_000),
    farPollMs: positiveInteger(env, 'KEEPER_FAR_POLL_MS', 15 * 60_000),
    warmPollMs: positiveInteger(env, 'KEEPER_WARM_POLL_MS', 5 * 60_000),
    nearPollMs: positiveInteger(env, 'KEEPER_NEAR_POLL_MS', 60_000),
    errorBackoffMaxMs: positiveInteger(env, 'KEEPER_ERROR_BACKOFF_MAX_MS', 15 * 60_000),
    healthPort: positiveInteger(env, 'KEEPER_HEALTH_PORT', 8788),
    lockFile: env.KEEPER_LOCK_FILE || '/tmp/flon-daogov-keeper.lock',
  };
}
