import {Action, APIClient, PrivateKey, SignedTransaction, Transaction, type ABI} from '@fullon/flon-core';
import type {KeeperConfig} from './config.js';
import {parseAssetAmount, parseChainTime} from './domain.js';

export interface ChainInfo { chainId: string; headBlockNum: number; libBlockNum: number; headTime: string; headTimeMs: number; }
export interface ProducerClaim {producer: string; baseAmount: number; producerRows: boolean; gasRows: boolean;}
export interface PushResult {transactionId: string; blockNum: number;}

export class ChainClient {
  private readonly api: APIClient; private readonly privateKey?: PrivateKey; private abi?: ABI.Def;
  constructor(private readonly config: KeeperConfig) { this.api = new APIClient({url: config.rpcUrl}); this.privateKey = config.privateKey ? PrivateKey.from(config.privateKey) : undefined; }
  async getInfo(): Promise<ChainInfo> { const i = await this.api.v1.chain.get_info(); return {chainId:String(i.chain_id).toLowerCase(),headBlockNum:Number(i.head_block_num),libBlockNum:Number(i.last_irreversible_block_num),headTime:String(i.head_block_time),headTimeMs:i.head_block_time.toMilliseconds()}; }
  async listClaimableProducers(): Promise<ProducerClaim[]> {
    const response = await this.api.v1.chain.get_table_rows({code:this.config.contract,scope:this.config.contract,table:'producers',json:true,limit:1000});
    const claims: ProducerClaim[] = [];
    for (const raw of response.rows as Record<string, unknown>[]) {
      if (Number(raw.is_active) !== 1) continue;
      const producer = String(raw.owner); const baseAmount = parseAssetAmount(raw.unclaimed_rewards);
      const [producerRows, gasRows] = await Promise.all([this.hasRows('prodclaims', producer), this.hasRows('gasclaims', producer)]);
      if (baseAmount > 0 || producerRows || gasRows) claims.push({producer, baseAmount, producerRows, gasRows});
    }
    return claims;
  }
  private async hasRows(table: string, scope: string): Promise<boolean> { const r = await this.api.v1.chain.get_table_rows({code:this.config.contract,scope,table,json:true,limit:1}); return r.rows.length > 0; }
  async claimRewards(producer: string): Promise<PushResult> {
    const info = await this.api.v1.chain.get_info();
    if (!this.abi) { const r = await this.api.v1.chain.get_abi(this.config.contract); if (!r.abi) throw new Error(`${this.config.contract} ABI is unavailable`); this.abi = r.abi; }
    const action = Action.from({account:this.config.contract,name:'claimrewards',authorization:[{actor:this.config.signerActor!,permission:this.config.signerPermission!}],data:{caller:this.config.signerActor!,producer,max_steps:this.config.maxSteps}},this.abi);
    const transaction = Transaction.from({...info.getTransactionHeader(120),actions:[action]});
    if (!this.privateKey) throw new Error('keeper signing key is unavailable');
    const signature = this.privateKey.signDigest(transaction.signingDigest(info.chain_id));
    const result = await this.api.v1.chain.push_transaction(SignedTransaction.from({...transaction,signatures:[signature]}));
    return {transactionId:result.transaction_id,blockNum:result.processed.block_num};
  }
  validateInfo(info: ChainInfo): void { if (info.chainId !== this.config.expectedChainId) throw new Error(`chain ID mismatch: expected ${this.config.expectedChainId}, received ${info.chainId}`); if (info.headBlockNum <= info.libBlockNum) throw new Error('chain head is not ahead of LIB'); const age=Date.now()-parseChainTime(info.headTime); if(age < -30_000 || age > this.config.maxHeadAgeMs) throw new Error(`chain head is stale or clock is skewed: age_ms=${age}`); }
}
