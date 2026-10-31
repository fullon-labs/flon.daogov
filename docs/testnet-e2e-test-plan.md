# FLON 测试网 BP、投票与 DAO 治理端到端测试计划

## 1. 目标与强制边界

验证 BP 保证金、注册、竞选、节点投票、撤票与赎回，以及 `dao.gov`、`dao.treasury` 包含链上 action 的治理闭环。

- 只允许链 ID `18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f`。
- 所有签名来自本机 `fuwal`；脚本不读取、导入或输出私钥。
- 默认只预检。写交易必须同时使用 `--broadcast` 和确认变量。
- 不修改 Epoch 时长；跨 Epoch、72 小时 voter refund、21 天 BP unstake 按真实时间分阶段执行。
- 共享测试网不执行不可逆 `sealadmin`，不随意修改全局治理、BP 或 GAS 参数。

## 2. 当前测试网基线（2026-10-27 只读核验）

| 项目 | 当前值 |
|---|---|
| RPC | `https://t4.flon.network` |
| BP 最低自质押 / 解锁期 | `500,000 FLON` / 21 天 |
| 提案 / 附议门槛 | `100 GLON` / `1 GLON` |
| 附议期 / 投票延迟 / 投票期 | 5 分钟 / 1 分钟 / 5 分钟 |
| 默认 quorum / 通过门槛 | 10% / 50% |
| Timelock / 执行宽限期 | 5 分钟 / 24 小时 |
| action 限制 | 最多 10 个；单个 4096 bytes；合计 16384 bytes |
| 治理总票权 | `10,799 GLON` |

执行提案还要应用 L1–L4 风险策略，混合 actions 取最高风险。L3/L4 当前最低总票权为 10,000/50,000 GLON；当前 `10,799 GLON` 已满足 L3 总票权门槛，但仍不足以激活 L4 提案。

## 3. 测试角色

- BP candidate：拥有最低自质押 FLON 和独立 block signing public key。
- Voter：拥有投票本金；`addvote` 后获得等额不可转让 GLON。
- Proposer、Endorser、DAO voters：分别满足风险策略门槛，投票账户覆盖 for/against/abstain。
- Executor：任意测试账户，用于证明生命周期 action permissionless。
- Treasury recipient：接收最小额测试付款。

BP block signing key 不得用作账户 owner/active key。建议使用可丢弃测试账户，并在执行前记录余额与权限。

## 4. 执行阶段

1. **T0 预检**：链 ID、RPC、ABI、本地钱包、账户权限、余额、配置、白名单、风险策略和 treasury。
2. **T1 BP 准入**：低于门槛失败 → 自质押 → 注册 → 表校验。
3. **T2 投票竞选**：增加本金 → 自定义分配 → 等自然 Epoch → 排名、Active/Standby、schedule 校验。
4. **T3 BP Performance before**：在目标 Reward/GAS Epoch 封存前保存完整出块、奖励、claim、余额和 voter reward 快照。
5. **T4 自然封存与奖励对账**：不加速 Epoch，等待 Keeper 自然封存；保存 after 快照并完成区块奖励、BP/voter 分成、GAS 池及节点分配核算。
6. **T5 奖励领取与退出**：分别验证 BP 本人、Keeper/第三方、分批 `max_steps`、重复领取；再执行 unregister、unstake、取消退款、重新 unstake 和到期领取。
7. **T6 Voter 撤票**：减少本金、销毁 GLON、重新分配、到期退款，并验证 voter reward 跨 Epoch 归属。
8. **T7 信号提案**：提案、论坛、附议、激活、快照、投票、结算、取消。
9. **T8 可执行提案**：ABI 编码、白名单/风险、action 冻结、queue、Timelock、permissionless execute、expire。
10. **T9 Treasury**：入金、reserve、pay、release、closegrant 与账务守恒。
11. **T10 回归**：LIB、余额、表状态、重复调用、错误分支与 DApp 展示。

### 4.1 BP 竞选专项发布门禁

BP 竞选必须连续覆盖至少两个自然 Reward Epoch，不能只验证单笔 action 成功：

1. 保存 `producers/voters/voteallocs/pendingvote/electconfig`、active schedule、链头和 LIB 基线。
2. 对同一 voter 连续执行“新增本金 → 三个 BP 非等额分配 → 修改为四个 BP → 撤去一个 BP → 部分撤回本金”，每轮分配都必须按账户名排序并等于当轮锁定本金。
3. 每笔 `votealloc` 只创建下一 Epoch 的待生效状态；边界前旧票数和 schedule 不得提前变化。
4. 自然封存后，待生效行必须被消费；逐 BP 验证 `new_total_votes = old_total_votes - old_allocation + new_allocation`，并核对 voter、allocation、排名、Active/Standby 和 schedule。
5. 对入选 Active 的每个 BP，从节点日志、active schedule、`bpstats` 三处交叉验证实际出块；不得仅根据 `producers.is_active` 推断正在出块。
6. 再跨一个完整 Epoch 验证变更稳定，避免只在封存瞬间读取过渡状态。

任何 `pendingvote` 到期未消费、票数增量不精确、schedule 与席位规则不一致，或 `expected != produced + missed`，均为主网发布阻断。

## 5. BP Performance & Rewards 完整核算

### 5.1 出块率与状态

Reward Epoch 的有效出块率定义为：

```text
production_rate = produced_blocks / expected_blocks
expected_blocks = produced_blocks + missed_blocks
```

`idle_skipped_blocks` 是未分配给该 BP 的空闲 slot，必须单独展示，不得计入 `missed_blocks` 或出块率分母。每个 Epoch 同时验证：

- `epochstats.complete_sample`、`closed`、`network_incident`。
- `bpstats.expected/produced/missed/idle_skipped`。
- longest/trailing missed streak。
- `bpstatus` 的 qualified、degraded、warning、suspended、insufficient sample、network incident、probation。
- warning count、suspension count、cooldown 和恢复后的 schedule。

### 5.2 区块基础奖励

每个 BP 按最小单位复算：

```text
gross                = 该 Epoch 实际出块产生的基础奖励
performance_factor   = 合约根据完整样本、网络事故和出块率计算的 basis points
eligible             = floor(gross × performance_factor / 10000)
voter_share          = floor(eligible × reward_shared_ratio / 10000)
producer_reward      = eligible - voter_share
forfeited            = gross - eligible
```

核对关系：

- `producer_reward` 必须等于该 BP、该 Epoch 的 `prodclaims.quantity`。
- `voter_share` 必须等于 `voter.reward::producers.total_rewards` 的对应增量。
- `producer_reward + voter_share + forfeited = gross`。
- `global.total_produced_rewards`、`global.total_unclaimed_rewards` 与各 BP 行、claim 和转账变化一致。
- missed slot 不产生基础奖励；基础奖励只归实际合格出块 BP，不存在 Active 固定基础份额。
- 跨 315,360,000 奖励区块减半边界时，检查固定 5 亿 FLON 总预算、整数精度和累计发行上限。

### 5.3 Voter reward 守恒

逐层校验：

```text
每个 producer: total_rewards = allocating_rewards + allocated_rewards
global.total_rewards = sum(producer.total_rewards)
sum(producer.allocated_rewards)
  = sum(voter.claimed_rewards + voter.unclaimed_rewards)
```

投票变更只从约定的下一 Reward Epoch 生效，不得追溯领取历史奖励。撤票前产生但尚未领取的奖励必须保留。

### 5.4 GAS Active/Standby 奖励

独立于区块基础奖励校验：

- `gasepochcfg` 必须冻结当期 epoch slots、Active 门槛、pool 和 share 参数。
- Active score、eligible、allocated 必须与实际出块绩效一致。
- Standby 只有有效 `standbyproof` 达到规则要求才进入 Standby 分配；重复或错误证明不得增加计数。
- `active_pool + standby_pool = pool`。
- `sum(gasnodestats.allocated) = active_allocated + standby_allocated`。
- settlement 的 funded、finalized、phase、incident hold 和参与节点数一致。
- `gasclaims` 只能消费一次；领取前后 `flon.gas`、BP 余额和 claim rows 守恒。

### 5.5 Claim 行为

分别验证：

- BP 本人触发和 Keeper/任意第三方代触发，收益始终进入指定 BP/voter。
- `max_steps` 较小时允许分批继续，不得跳过或重复 Epoch。
- 无奖励、重复领取、重放交易不会重复付款。
- claim 前后同时记录账户余额、`unclaimed_rewards`、`prodclaims`、`gasclaims`、voter claimed/unclaimed。
- Keeper 在快照窗口内自动 claim 时，不再要求重做无 claim 窗口；必须保存对应不可逆 block trace，核对 `claimrewards` 为 executed、所有 transfer 收款人绑定正确 BP，并用 `after prodclaims - before prodclaims + 窗口内不可逆基础奖励付款` 重建本 Epoch 应计奖励。
- 所有 `last_claim_time` 发生变化的 BP 必须逐一存在 trace；trace 区块必须落在 before/after 快照区间，trace 总付款必须与 BP 实际账户入账精确一致。漏 trace、错误收款人、未达 LIB或余额不符均为 FAIL。
- Keeper 下线时，用户自行触发仍可完成领取。

## 6. 通过标准与证据

每个写交易保存 action/actor、transaction ID、包含区块、LIB 时间、执行前后快照和精确错误。满足以下条件才算通过：

- 交易达到 LIB；仅返回 submitted 不算完成。
- FLON/GLON、BP stake/refund、treasury liquid/reserved/paid 守恒。
- Epoch 边界前后 `pendingvote/votedeltas/voteallocs/producers` 一致。
- 完整 Reward Epoch 满足 `expected = produced + missed`，`idle_skipped` 不污染 missed 和出块率。
- 每个 BP 的 gross、绩效系数、自留、voter share、forfeited 和 `prodclaims` 精确到 `10^-8 FLON`。
- GAS pool、Active/Standby 子池、节点 allocated 及 claims 精确守恒。
- voter reward 的 global、producer、voter 三层账目精确守恒。
- 若 before/after 跨越多个 Epoch，结果标记 Blocked 并重新选择单 Epoch 窗口。单 Epoch 内发生 claim 时，只有完成 `prodclaims + 不可逆 trace + 账户入账` 重建且无其他无法解释的转账，才可判定通过。
- DAO power/policy 在激活时冻结，之后 add/sub vote 不追溯改变该提案权重。
- action bytes、风险等级和权限冻结；执行结果严格等于冻结内容。
- 负向用例断言具体合约错误，不只判断非零退出码。

## 7. 使用测试脚本

```bash
cd /Users/ray/work/flon/flon.daogov
cp scripts/testnet-e2e.env.example /tmp/flon-testnet-e2e.env
# 编辑 /tmp 文件，只填测试账户、public key 和数量；不要写私钥。
scripts/testnet-e2e.sh preflight --env /tmp/flon-testnet-e2e.env

export TESTNET_MUTATION_ACK=I_UNDERSTAND_TESTNET_STATE_WILL_CHANGE
scripts/testnet-e2e.sh bp-stake --env /tmp/flon-testnet-e2e.env --broadcast
```

脚本按阶段运行，不会伪造时间或自动跨越等待期。证据写入 `artifacts/testnet-e2e/<UTC run id>/`。详细步骤见 [测试用例](./testnet-e2e-test-cases.md)。

节点出块率、区块基础奖励、GAS Active/Standby 奖励、BP/Voter 领取和 Epoch 前后快照，见 [BP Performance & Rewards 独立用例](./testnet-bp-performance-rewards-cases.md)。

目标 Epoch 封存前后分别执行只读快照，并始终显式复用相同 Epoch ID：

```bash
EPOCH_ID=768 GAS_EPOCH_ID=39184 \
  scripts/testnet-bp-rewards.sh capture --label before

# 等待链上自然封存及 Keeper 结算，不修改 Epoch 参数。

EPOCH_ID=768 GAS_EPOCH_ID=39184 \
  scripts/testnet-bp-rewards.sh capture --label after

BEFORE_DIR=/absolute/path/to/before \
AFTER_DIR=/absolute/path/to/after \
  scripts/testnet-bp-rewards.sh compare
```

`comparison.md` 必须包含逐 BP 基础奖励拆分、voter share 实际增量、claim rows、余额变化，以及 Reward/GAS/voter 三类守恒断言。开放 Epoch 只能报告等待封存，不能提前判定奖励核算失败。

## 8. 完成定义

只有以下全部满足，才能宣布测试链完整流程通过：

1. BP 自质押、注册、投票、竞选、schedule、退出和退款均达到 LIB。
2. 至少一个完整 Reward Epoch 和一个已 finalized/funded GAS Epoch 对账通过。
3. BP block reward、GAS reward、voter reward 至少各完成一次合法 claim，并验证重复领取被阻止。
4. 信号提案至少覆盖 succeeded 和 defeated；可执行提案完成 endorse、vote、queue、Timelock、permissionless execute。
5. Treasury 至少完成一次 reserve → pay，以及一次 reserve → release/close 路径。
6. 所有负向用例保存精确合约错误；没有主网交易、私钥泄露、Epoch 参数加速或共享测试网危险配置修改。

