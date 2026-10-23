import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {ChainClient, type ChainInfo} from './chain.js';
import {loadConfig, type KeeperConfig} from './config.js';
import {adaptivePollDelay, computeEpochState, parseChainTime} from './domain.js';
import {acquireLock} from './lock.js';

type Level = 'info' | 'warn' | 'error';
function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({time: new Date().toISOString(), level, event, ...fields})}\n`);
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  if (signal.aborted) return resolve();
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, {once: true});
});

export interface RuntimeStatus {
  startedAt: string;
  lastCheckAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  chain?: ChainInfo;
  nextEpochToClose?: number;
  currentEpoch?: number;
  mode: 'dry-run' | 'broadcast';
}

async function waitForConfirmation(
  client: ChainClient,
  config: KeeperConfig,
  expectedNextEpoch: number,
  blockNum: number,
  signal: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + config.confirmationTimeoutMs;
  while (!signal.aborted && Date.now() < deadline) {
    const info = await client.getInfo();
    client.validateInfo(info);
    if (info.libBlockNum >= blockNum) {
      const state = await client.getRewardState();
      if (state.nextEpochToClose !== expectedNextEpoch) {
        throw new Error(`irreversible transaction did not advance rewardepoch: expected ${expectedNextEpoch}, received ${state.nextEpochToClose}`);
      }
      return;
    }
    await sleep(config.confirmationPollMs, signal);
  }
  throw new Error(`confirmation timed out for block ${blockNum}`);
}

export async function runKeeper(config = loadConfig()): Promise<void> {
  const controller = new AbortController();
  const status: RuntimeStatus = {
    startedAt: new Date().toISOString(),
    mode: config.broadcast ? 'broadcast' : 'dry-run',
  };
  const releaseLock = await acquireLock(config.lockFile);
  const server = createServer((request, response) => {
    const healthy = !status.lastError && Boolean(status.lastSuccessAt);
    response.statusCode = request.url === '/healthz' && !healthy ? 503 : 200;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(request.url === '/healthz' ? {healthy, ...status} : status));
  });
  server.listen(config.healthPort, '0.0.0.0');

  const stop = (signal: string) => {
    log('info', 'shutdown_requested', {signal});
    controller.abort();
  };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));

  const client = new ChainClient(config);
  let errorBackoff = config.nearPollMs;
  log('info', 'keeper_started', {
    rpc_url: config.rpcUrl,
    expected_chain_id: config.expectedChainId,
    mode: status.mode,
  });

  try {
    while (!controller.signal.aborted) {
      let delay = config.farPollMs;
      try {
        let closed = 0;
        while (!controller.signal.aborted && closed < config.maxCatchupPerCycle) {
          const [info, reward] = await Promise.all([client.getInfo(), client.getRewardState()]);
          client.validateInfo(info);
          const epoch = computeEpochState(
            info.headTimeMs,
            parseChainTime(reward.rewardStartedTime),
            reward.nextEpochToClose,
            config.epochMs,
          );
          Object.assign(status, {
            lastCheckAt: new Date().toISOString(),
            lastSuccessAt: new Date().toISOString(),
            lastError: undefined,
            chain: info,
            nextEpochToClose: epoch.nextEpochToClose,
            currentEpoch: epoch.currentEpoch,
          });
          log('info', 'epoch_checked', {
            head_block_num: info.headBlockNum,
            lib_block_num: info.libBlockNum,
            current_epoch: epoch.currentEpoch,
            next_epoch_to_close: epoch.nextEpochToClose,
            due: epoch.due,
            overdue_ms: epoch.overdueMs,
          });

          if (!epoch.due) {
            delay = adaptivePollDelay(info.headTimeMs, epoch.boundaryMs, false, {
              farMs: config.farPollMs,
              warmMs: config.warmPollMs,
              nearMs: config.nearPollMs,
            });
            break;
          }
          if (!config.broadcast) {
            log('warn', 'closeepoch_due_dry_run', {epoch_id: epoch.nextEpochToClose});
            delay = config.nearPollMs;
            break;
          }

          // Re-read immediately before broadcast. This prevents using stale state
          // when another keeper has already closed the epoch.
          const preflight = await client.getRewardState();
          if (preflight.nextEpochToClose !== epoch.nextEpochToClose) continue;
          const result = await client.closeEpoch(epoch.nextEpochToClose);
          log('info', 'closeepoch_broadcast', {
            epoch_id: epoch.nextEpochToClose,
            transaction_id: result.transactionId,
            block_num: result.blockNum,
          });
          await waitForConfirmation(
            client,
            config,
            epoch.nextEpochToClose + 1,
            result.blockNum,
            controller.signal,
          );
          log('info', 'closeepoch_irreversible', {
            epoch_id: epoch.nextEpochToClose,
            transaction_id: result.transactionId,
          });
          closed += 1;
        }
        if (closed === config.maxCatchupPerCycle) delay = config.nearPollMs;
        errorBackoff = config.nearPollMs;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        status.lastError = message;
        status.lastCheckAt = new Date().toISOString();
        log('error', 'keeper_cycle_failed', {error: message, retry_ms: errorBackoff});
        delay = errorBackoff;
        errorBackoff = Math.min(errorBackoff * 2, config.errorBackoffMaxMs);
      }
      if (!controller.signal.aborted) {
        log('info', 'next_check_scheduled', {delay_ms: delay});
        await sleep(delay, controller.signal);
      }
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await releaseLock();
    log('info', 'keeper_stopped');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  runKeeper().catch((error) => {
    log('error', 'keeper_fatal', {error: error instanceof Error ? error.message : String(error)});
    process.exitCode = 1;
  });
}
