export const DEFAULT_EPOCH_MS = 6 * 60 * 60 * 1000;

export interface EpochState {
  currentEpoch: number;
  nextEpochToClose: number;
  boundaryMs: number;
  due: boolean;
  overdueMs: number;
}

export function parseChainTime(value: string): number {
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`invalid chain timestamp: ${value}`);
  return parsed;
}

export function computeEpochState(
  headTimeMs: number,
  rewardStartMs: number,
  nextEpochToClose: number,
  epochMs = DEFAULT_EPOCH_MS,
): EpochState {
  if (!Number.isSafeInteger(nextEpochToClose) || nextEpochToClose < 0) {
    throw new Error('next_epoch_to_close must be a non-negative safe integer');
  }
  if (!Number.isFinite(rewardStartMs) || headTimeMs < rewardStartMs) {
    throw new Error('producer rewards have not started');
  }
  if (!Number.isSafeInteger(epochMs) || epochMs <= 0) throw new Error('epoch duration must be positive');

  const currentEpoch = Math.floor((headTimeMs - rewardStartMs) / epochMs);
  const boundaryMs = rewardStartMs + (nextEpochToClose + 1) * epochMs;
  const due = currentEpoch > nextEpochToClose;
  return {
    currentEpoch,
    nextEpochToClose,
    boundaryMs,
    due,
    overdueMs: due ? headTimeMs - boundaryMs : 0,
  };
}

export interface PollIntervals {
  farMs: number;
  warmMs: number;
  nearMs: number;
}

export function adaptivePollDelay(
  headTimeMs: number,
  boundaryMs: number,
  due: boolean,
  intervals: PollIntervals,
): number {
  if (due) return intervals.nearMs;
  const remaining = boundaryMs - headTimeMs;
  if (remaining <= 10 * 60 * 1000) return intervals.nearMs;
  if (remaining <= 30 * 60 * 1000) return intervals.warmMs;
  return intervals.farMs;
}
