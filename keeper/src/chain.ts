import {
  Action,
  APIClient,
  PrivateKey,
  SignedTransaction,
  Transaction,
  type ABI,
} from '@fullon/flon-core';
import type {KeeperConfig} from './config.js';
import {parseChainTime} from './domain.js';

export interface ChainInfo {
  chainId: string;
  headBlockNum: number;
  libBlockNum: number;
  headTime: string;
  headTimeMs: number;
}

export interface RewardState {
  rewardStartedTime: string;
  nextEpochToClose: number;
}

export interface CloseResult {
  transactionId: string;
  blockNum: number;
}

function asNumber(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`invalid ${field}: ${String(value)}`);
  return number;
}

export class ChainClient {
  private readonly api: APIClient;
  private readonly privateKey?: PrivateKey;
  private abi?: ABI.Def;

  constructor(private readonly config: KeeperConfig) {
    this.api = new APIClient({url: config.rpcUrl});
    this.privateKey = config.privateKey ? PrivateKey.from(config.privateKey) : undefined;
  }

  async getInfo(): Promise<ChainInfo> {
    const info = await this.api.v1.chain.get_info();
    return {
      chainId: String(info.chain_id).toLowerCase(),
      headBlockNum: Number(info.head_block_num),
      libBlockNum: Number(info.last_irreversible_block_num),
      headTime: String(info.head_block_time),
      headTimeMs: info.head_block_time.toMilliseconds(),
    };
  }

  async getRewardState(): Promise<RewardState> {
    const [globalRows, epochRows] = await Promise.all([
      this.api.v1.chain.get_table_rows({
        code: this.config.contract,
        scope: this.config.contract,
        table: 'global',
        json: true,
        limit: 1,
      }),
      this.api.v1.chain.get_table_rows({
        code: this.config.contract,
        scope: this.config.contract,
        table: 'rewardepoch',
        json: true,
        limit: 1,
      }),
    ]);
    const global = globalRows.rows[0] as Record<string, unknown> | undefined;
    const epoch = epochRows.rows[0] as Record<string, unknown> | undefined;
    if (!global?.reward_started_time) throw new Error('flon::global.reward_started_time is unavailable');
    if (!epoch) throw new Error('flon::rewardepoch is unavailable');
    return {
      rewardStartedTime: String(global.reward_started_time),
      nextEpochToClose: asNumber(epoch.next_epoch_to_close, 'next_epoch_to_close'),
    };
  }

  async closeEpoch(epochId: number): Promise<CloseResult> {
    const info = await this.api.v1.chain.get_info();
    if (!this.abi) {
      const response = await this.api.v1.chain.get_abi(this.config.contract);
      if (!response.abi) throw new Error(`${this.config.contract} ABI is unavailable`);
      this.abi = response.abi;
    }
    const action = Action.from({
      account: this.config.contract,
      name: 'closeepoch',
      authorization: [{
        actor: this.config.signerActor!,
        permission: this.config.signerPermission!,
      }],
      data: {epoch_id: epochId},
    }, this.abi);
    const transaction = Transaction.from({
      ...info.getTransactionHeader(120),
      actions: [action],
    });
    if (!this.privateKey) throw new Error('keeper signing key is unavailable');
    const signature = this.privateKey.signDigest(transaction.signingDigest(info.chain_id));
    const signed = SignedTransaction.from({...transaction, signatures: [signature]});
    const result = await this.api.v1.chain.push_transaction(signed);
    return {
      transactionId: result.transaction_id,
      blockNum: result.processed.block_num,
    };
  }

  validateInfo(info: ChainInfo): void {
    if (info.chainId !== this.config.expectedChainId) {
      throw new Error(`chain ID mismatch: expected ${this.config.expectedChainId}, received ${info.chainId}`);
    }
    if (info.headBlockNum <= info.libBlockNum) throw new Error('chain head is not ahead of LIB');
    const age = Date.now() - parseChainTime(info.headTime);
    if (age < -30_000 || age > this.config.maxHeadAgeMs) {
      throw new Error(`chain head is stale or clock is skewed: age_ms=${age}`);
    }
  }
}
