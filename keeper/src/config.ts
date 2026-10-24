import {readFileSync} from 'node:fs';

export interface KeeperConfig {
  rpcUrl: string; expectedChainId: string; contract: string; broadcast: boolean;
  signerActor?: string; signerPermission?: string; privateKey?: string;
  maxHeadAgeMs: number; maxSteps: number; pollMs: number; perProducerDelayMs: number;
  confirmationPollMs: number; confirmationTimeoutMs: number; errorBackoffMaxMs: number;
  healthPort: number; lockFile: string;
}

function positiveInteger(env: NodeJS.ProcessEnv, key: string, fallback: number, max?: number): number {
  const raw = env[key]; const value = raw ? Number(raw) : fallback;
  if (!Number.isSafeInteger(value) || value <= 0 || (max !== undefined && value > max))
    throw new Error(`${key} must be a positive integer${max ? ` no greater than ${max}` : ''}`);
  return value;
}
function boolean(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key]; if (!raw) return fallback;
  if (raw === 'true' || raw === '1') return true; if (raw === 'false' || raw === '0') return false;
  throw new Error(`${key} must be true/false or 1/0`);
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): KeeperConfig {
  const rpcUrl = env.KEEPER_RPC_URL?.replace(/\/$/, '');
  const expectedChainId = env.KEEPER_CHAIN_ID?.toLowerCase();
  if (!rpcUrl) throw new Error('KEEPER_RPC_URL is required');
  try { new URL(rpcUrl); } catch { throw new Error('KEEPER_RPC_URL must be an absolute URL'); }
  if (!expectedChainId || !/^[0-9a-f]{64}$/.test(expectedChainId)) throw new Error('KEEPER_CHAIN_ID must be a 64-character hexadecimal chain ID');
  const broadcast = boolean(env, 'KEEPER_BROADCAST', false);
  const signerActor = env.KEEPER_SIGNER_ACTOR;
  const signerPermission = env.KEEPER_SIGNER_PERMISSION || 'active';
  const privateKeyFile = env.KEEPER_PRIVATE_KEY_FILE;
  const privateKey = privateKeyFile ? readFileSync(privateKeyFile, 'utf8').trim() : undefined;
  if (broadcast && (!signerActor || !privateKey)) throw new Error('broadcast mode requires KEEPER_SIGNER_ACTOR and KEEPER_PRIVATE_KEY_FILE');
  return {
    rpcUrl, expectedChainId, contract: env.KEEPER_CONTRACT || 'flon', broadcast,
    signerActor, signerPermission, privateKey,
    maxHeadAgeMs: positiveInteger(env, 'KEEPER_MAX_HEAD_AGE_MS', 90_000),
    maxSteps: positiveInteger(env, 'KEEPER_MAX_STEPS', 24, 48),
    pollMs: positiveInteger(env, 'KEEPER_POLL_MS', 60 * 60_000),
    perProducerDelayMs: positiveInteger(env, 'KEEPER_PER_PRODUCER_DELAY_MS', 2_000),
    confirmationPollMs: positiveInteger(env, 'KEEPER_CONFIRMATION_POLL_MS', 3_000),
    confirmationTimeoutMs: positiveInteger(env, 'KEEPER_CONFIRMATION_TIMEOUT_MS', 180_000),
    errorBackoffMaxMs: positiveInteger(env, 'KEEPER_ERROR_BACKOFF_MAX_MS', 15 * 60_000),
    healthPort: positiveInteger(env, 'KEEPER_HEALTH_PORT', 8788),
    lockFile: env.KEEPER_LOCK_FILE || '/tmp/flon-daogov-keeper.lock',
  };
}
