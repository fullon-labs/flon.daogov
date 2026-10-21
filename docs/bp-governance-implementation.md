# FLON Block Producer（BP）投票、奖励、惩罚与 DAO 治理实施方案

## 1. 结论与目标架构

FLON 不需要重做一套独立的 PoS 共识。最稳妥的路径是在现有 DPoS/Antelope 排班上增加“候选人自质押、持币人投票、21 个活跃 BP、备用候选池、按表现发奖、严重作弊罚没、DAO 参数治理”六层机制。

推荐目标状态：

- 21 个活跃 BP 分为 15 个稳定席位、4 个竞争轮换席位和 2 个新秀席位；所有席位都必须先满足相同的技术与绩效门限。
- 30 个备用 BP（参数可治理），持续同步节点并参与监控；活跃 BP 被停权后，下一次排班更新自动递补。
- 候选 BP 必须锁定自有质押并公开网站、X、地区、API/P2P、团队和运维承诺。
- 投票人锁定 FLON 获得 `1 FLON = 1 基础票权`，可投最多 30 个候选人；同一份票平均分配，避免“一票复制给 30 个 BP”放大权重。投票需定期确认，单个 BP 的排名票权设软上限。
- 新增代币按“BP 基础服务奖 + BP 出块绩效奖 + 投票人委托奖 + DAO 国库”分配。
- 普通离线不立即罚本金，先扣发奖励、停权、冷却；可验证的双签或签署冲突状态才罚没本金。
- 节点竞选和 DAO 治理共用质押与快照基础设施，但使用不同投票动作、阈值和执行器。

现有代码已经具备 BP 注册、自质押门限与 21 天退出队列、锁仓投票、按票排名、Active/Standby 资格过滤、确定性出勤统计、恢复状态机和投票人奖励账本。仍需补齐完整注册资料、证据型罚没、DAO 白名单执行器与强制 timelock。

## 2. 公链机制借鉴

### 2.1 NEAR

NEAR 以 epoch 为结算周期，通过质押提案选择验证人。每个 epoch 统计应出与实出区块/分片，低于门限的验证人会被移出后续集合且不获奖励；达标者的奖励同时受质押权重和在线率影响。NEAR 的经济模型还把协议国库单独列为奖励接收方。其规范同时提醒，当前实现中的 slashing 状态与设计描述存在版本差异，因此不应简单复制“离线即罚本金”。

FLON 应借鉴：周期结算、应出/实出计数、低于门限自动退出、奖励随出勤衰减、国库独立分账。

### 2.2 Avalanche

Avalanche 将验证人自质押与他人委托分开，验证人收取委托奖励佣金，并限制最大委托容量。当前主网规则对新验证周期采用 90% 在线门限；未达标时验证人和委托人不获该周期奖励，但本金退回，Avalanche 明确不采用 slashing。

FLON 应借鉴：候选人最低自质押、委托容量与自质押挂钩、佣金率有上下限、在线不足先“零奖励而非罚本金”。

### 2.3 适合 FLON 的组合

| 机制 | FLON 采用方式 |
| --- | --- |
| 活跃集合 | 21 个 BP，沿用现有排班规模 |
| 备用集合 | 未入选的 30 个最高分合格候选人，保持热备并公开健康状态 |
| 候选门限 | 固定最低自质押 + DAO 可治理参数 |
| 用户投票 | `1 FLON = 1 基础票权`；投给多个 BP 时平均分票 |
| 防止头部固化 | 投票定期确认和衰减、单 BP 排名票权软上限、竞争和新秀席位 |
| 低在线率 | 扣奖、停权、冷却、备用递补 |
| 可证明作弊 | 双签/冲突状态证据触发罚没和禁入 |
| DAO | 独立提案、快照投票、timelock 执行 |

## 3. 竞选和投票机制

### 3.1 候选人生命周期

候选人状态：`registered -> qualified -> active/standby -> suspended -> cooling -> qualified`，也可主动进入 `retiring -> withdrawn`。

注册必须同时满足：

1. BP 账户与区块签名密钥有效。
2. 自质押不低于 `min_bp_self_stake`。
3. 资料字段齐全并通过格式校验。
4. 接受服务承诺与惩罚规则的哈希版本。
5. 若启用 Savanna，已注册有效 finalizer key。

推荐首期参数（均为建议值，上线前应由经济仿真确定）：

| 参数 | 建议初值 |
| --- | ---: |
| 活跃 BP 数 | 21 |
| 备用 BP 数 | 30 |
| BP 最低自质押 | 首期 `500,000 FLON`，由 `setbpstake` 治理调整 |
| 用户最短投票锁定 | 7 天 |
| BP 退出等待 | 21 天 |
| 单账户最多投票 BP | 30 |
| BP 委托容量 | `min(自质押 × 20, 全网投票质押 × 5%)` |
| 佣金率 | 5%–20%，修改后 7 天生效 |
| 投票确认周期 | 90 天 |
| 投票完全失效时间 | 180 天未确认 |
| 单 BP 排名票权软上限 | 全网有效票权的 5% |
| 席位组成 | 15 个稳定 + 4 个竞争 + 2 个新秀 |
| 新秀毕业期 | 180 天 |

首期使用链上参数 `min_self_stake = 500,000 FLON`，不是编译期常量。DAO 应结合币价、流通量和候选数量定期评估；后续版本可升级为“绝对下限与流通量比例取大值”。

### 3.2 投票权重

首期采用线性锁仓，明确 `1 FLON = 1 基础票权`，不增加持币时间倍增。同一账户选择多个 BP 时平均分票：

```text
account_base_power = locked_FLON
freshness = freshness_factor(last_vote_confirmed_at, now)
account_effective_power = account_base_power × freshness
vote_weight_per_bp = account_effective_power / selected_bp_count
raw_bp_weight = bp_self_stake + sum(vote_weight_per_bp)
ranking_bp_weight = min(raw_bp_weight, total_effective_vote_power × 5%)
ranking_score = ranking_bp_weight × performance_factor
```

投票新鲜度建议采用分段衰减：

| 距离上次确认 | 计入排名的票权 |
| --- | ---: |
| 0–90 天 | 100% |
| 91–120 天 | 75% |
| 121–150 天 | 50% |
| 151–180 天 | 25% |
| 超过 180 天 | 0% |

确认投票只更新时间戳，不重新锁仓、不产生额外票权。软上限仅限制 BP 排名权重，超过上限的真实委托仍保留所有权和奖励记账，避免没收投票人的经济权益。

`performance_factor` 使用最近 30 天已经链上结算的出勤率，不能由运营方人工评分：

| 最近 30 天出勤率 | 绩效系数 |
| --- | ---: |
| `>= 99.5%` | 1.00 |
| `99%–99.5%` | 0.98 |
| `97%–99%` | 0.90 |
| `95%–97%` | 0.75 |
| `< 95%` | 0，失去排班资格 |

节点在单个 epoch 内低于 90% 时直接停权；30 天绩效系数用于区分仍然合格的节点，避免头部 BP 仅凭历史票仓长期占位。

用户更改投票对象时，先结算旧奖励再修改权重；撤票进入 7 天解锁队列。BP 自质押进入 21 天退出队列，且处于调查或罚没流程时不得提取。

为防止临界时刻借币投票，排班使用 epoch 结束时的链上权重快照，而不是交易发生瞬间的排名。建议一个 epoch 为 6 小时；连续 4 个 epoch 的指数移动平均用于排名，可减少 BP 频繁进出。

### 3.3 排班与备用递补

每个 epoch 结束时先形成合格候选池，再分配席位：

1. 排除资料失效、自质押不足、冷却中或被停权的候选人。
2. 按投票衰减和 5% 软上限计算排名票权，乘以 30 天绩效系数，再对连续 4 个 epoch 做平滑。
3. 按平滑后的 `ranking_score` 排名前 15 名进入稳定席位。
4. 排名 16–35 的节点进入竞争队列，按 `ranking_score` 分档后使用链上轮换游标选出 4 个竞争席位；同一节点最多连续占用竞争席位 4 个 epoch。
5. 从注册不超过 180 天、达到最低票数且完成至少 7 天备用观测的节点中，按账户名和上次入选 epoch 形成确定性轮换队列，选出 2 个新秀席位；到期后自动进入普通候选池。
6. 未入选且排名最高的 30 个合格节点标记为备用 BP。
7. 活跃 BP 在 epoch 中被紧急停权时，排班更新函数跳过该 BP，按确定性备用顺序递补。

竞争和新秀席位不是降低技术标准。其节点必须与稳定席位满足完全相同的自质押、密钥、同步状态和出块绩效门限。首版使用可重放的轮换游标，不使用 BP 可能影响的区块哈希充当随机数；只有未来引入协议级 VRF 后，才考虑不可预测的加权抽签。

现有 `update_elected_producers` 已每分钟尝试更新一次排班并取前 21 名，可以扩展过滤条件和备用状态，无需修改底层共识的排班接口。

## 4. GAS 收入与 FLON 奖励分配

### 4.1 奖励上限

节点 GAS 奖励不生成 ELON，也不建立 ELON 兑付负债。`onblock` 读取累计 GAS 费用对应的 FLON 价值，只记录相邻区块差额；完成 Epoch 后再分批结算。

```text
epoch_gas_flon = cumulative_gas_value_flon(end) - cumulative_gas_value_flon(start)
epoch_reward_cap = floor(epoch_gas_flon × 10%)
```

默认最多释放当期 GAS 对应 FLON 的 10%，其余 90% 留在 `flon.gas`。DAO 只能对未来 Epoch 在预设安全范围内调整比例，不能追溯修改已结算奖励。

### 4.2 分配比例

建议初始分配：

| 接收方 | 占 10% 奖励池 | 占当期 GAS 对应 FLON | 计算基础 |
| --- | ---: | ---: | --- |
| Active BP | 80% | 上限 8% | 按 21 个目标席位归一化；内部 40% 等额基础服务、60% 按出块绩效 |
| Standby BP | 20% | 上限 2% | 按 30 个目标席位归一化；满足在线证明门限者等额分配 |
| 留在 `flon.gas` | — | 90% 加未释放额度 | 默认锁定，等待 DAO 决定合规用途 |

早期只有少量 Active BP 时不能瓜分完整 8%。结算上限为：

```text
active_cap  = reward_cap × 80% × eligible_active_count / 21
standby_cap = reward_cap × 20% × eligible_standby_count / 30
```

未释放额度和整数舍入余额继续留在 `flon.gas`，不能补发给其他 BP 或成为后续意外收益。3 个合格 Active BP 加 30 个合格 Standby BP 时，最多释放当期 GAS 对应 FLON 的 `8% × 3/21 + 2% = 3.142857%`。

### 4.3 FLON 结算闭环

GAS 节点奖励和投票人分享奖励是两条独立账路：

1. `flon.system` 从 `flon.gas` 只转出归一化后实际释放的 FLON到 `gas.reward`。
2. `gas.reward` 记录各 BP 的累计已分配、已领取和待领取余额。
3. Active 和 Standby BP 调用 `gas.reward::claimrewards` 领取，错过 Epoch 不会丢失。
4. 原有生产者奖励可按 BP 注册的分享比例进入 `voter.reward`；GAS 节点奖励默认不自动产生投票人权益。
5. 所有面向最终受益人的 FLON 奖励统一采用主动领取：Epoch 结算只入账，不向 BP、Standby BP 或投票人自动空投。`gas.reward::claimrewards`、`flon.system::claimrewards` 和 `voter.reward::claimrewards` 均须由对应受益账户授权；不支持第三方代领，未领取余额持续累计且不因跨 Epoch 失效。
5. 如果未来要把 GAS 奖励分享给投票人，必须另行定义不可变的 Epoch 历史票权快照。

## 5. 出勤与作弊惩罚

### 5.1 可客观验证的数据

只使用链上可重放的数据决定经济惩罚：每个 BP 的 `expected_blocks`、`produced_blocks`、连续漏块、签名冲突证据和排班状态。外部监控的 CPU、磁盘、API 延迟只用于告警和公开评分，不直接罚币。

```text
availability = produced_blocks / expected_blocks
```

建议按 epoch 执行：

| 条件 | 处理 |
| --- | --- |
| `>= 99%` | 100% 绩效奖励 |
| `95%–99%` | 绩效奖按线性系数折减 |
| `90%–95%` | BP 与投票人当期奖励为零，记 1 次警告 |
| `< 90%` | 零奖励、停权、备用递补，冷却期后必须主动申请恢复 |
| 重复停权 | 冷却期依次为 1、2、4、8 个 epoch，最高 48 小时 |
| 试运行连续漏掉 12 个应出 slot | 立即再次停权，下一备用 BP 递补 |

网络整体故障时必须有“系统异常保护”：若同一 epoch 超过三分之一的活跃 BP 同时低于门限，不执行个体惩罚，只记录数据并交 DAO 复核，避免网络分区造成大面积误罚。

### 5.2 链上确定性实现

“绩效不达标直接失去资格”不能依赖中心化监控服务器提交在线率。所有全节点必须仅凭相同区块历史得到相同的 `expected_blocks`、`produced_blocks` 和资格状态。

FLON 当前每个 BP 连续负责 12 个 slot，链核心按以下规则计算计划生产者：

```text
scheduled_index = (slot % (active_producer_count × 12)) / 12
scheduled_producer = active_schedule[scheduled_index]
```

链核心提供只读、确定性的出块统计 intrinsic，而不是让普通预言机报告结果：

```text
get_producer_slot_stats(from_slot, to_slot)
  -> [{
       producer,
       expected,
       produced,
       missed,
       longest_missed_streak,
       leading_missed_streak,
       trailing_missed_streak
     }]
```

该 intrinsic 的输入只来自控制器已经验证过的活跃排班、区块时间戳、实际签名者和排班版本。它不访问网络、历史块数据库、外部服务或本地时钟，因此所有验证节点执行 `onblock` 时结果一致。允许查询的范围被严格限制在“当前链头之后、当前待处理区块之前”，以保证其中除待处理区块外的 slot 都确定为漏块。单次最多统计 100,000 个 slot，长时间停链由合约分块调用；前导和尾随漏块长度用于无损合并跨分块的连续漏块。

该 intrinsic 已加入 `flon-core` 的 genesis intrinsic 注册表，并在 `flon-cdt` 提供 C API 与 C++ `std::vector<producer_slot_stats>` 包装。主网启用属于共识升级，必须要求所有验证节点在同一激活高度前升级兼容二进制，不能只升级系统合约。

每个实际区块执行 `flon.system::onblock` 时：

1. 从区块头取得当前 `timestamp.slot` 和实际 `producer`。
2. 对上一个已处理 slot 到当前 slot 的区间调用统计 intrinsic；中间没有区块的 slot 计为对应计划 BP 的 missed。
3. 更新 `bpstats`：`expected_blocks`、`produced_blocks`、`missed_blocks`、`consecutive_missed`。
4. 只累计数据，不在每个区块里遍历全部 BP 或立即罚没。
5. 到 epoch 边界由系统内联动作 `closeepoch(epoch_id)` 结算，写入不可变的 `epochstats`。

建议表结构：

```text
bpstats:
  producer, epoch_id, expected_blocks, produced_blocks,
  missed_blocks, longest_missed_streak, status, warning_count

epochstats:
  epoch_id, start_slot, end_slot, schedule_hash,
  active_bp_count, failed_bp_count, network_incident, closed
```

结算顺序必须固定：

```text
availability = produced_blocks / expected_blocks

if expected_blocks < min_expected_blocks:
    status = INSUFFICIENT_SAMPLE       // 不处罚
else if failed_bp_count * 3 > active_bp_count:
    status = NETWORK_INCIDENT          // 全网异常保护，只记录不处罚
else if availability < 90%:
    status = SUSPENDED
    suspension_count += 1
    cooldown_epochs = min(2 ** (suspension_count - 1), 8)
    suspended_until = epoch_id + cooldown_epochs + 1
else:
    status = QUALIFIED
```

`update_elected_producers` 构造下一排班时排除 `SUSPENDED` 节点。即使其票数第一，也由下一名合格 Standby BP 递补。冷却期到期不会自动恢复资格；BP 必须使用自身权限调用 `resumeprod(producer)`，合约验证冷却期和注册状态后将其置为 `PROBATION`。若排名未变，它可在下一次确定性 schedule 更新后进入试运行，但不会因提交恢复交易而立即出块。

启动期 Active BP 目标数量由 `flon::setbpquorum(active_bp_quorum)` 配置，参数必须处于 3–21。停权过滤后的合格集合允许缩小 schedule，不能因为新集合小于旧集合而保留已停权 BP。若相邻区块间隔超过单次链上统计安全上限，合约跳过该异常大区间并将受影响 epoch 视为不完整样本，避免 `onblock` 因无界补算耗尽 CPU；不完整样本不得触发个体处罚。

试运行使用链上出块结果证明真实可用性，而不是网站、API 探测或操作者声明。`PROBATION` 节点连续漏掉 12 个确定性分配的 slot（一个完整生产轮次）时，`onblock` 通过同一 intrinsic 立即将其再次标记为 `SUSPENDED`；连续值保存在 `bpstatus.probation_missed_streak`，跨 epoch 不会重置。正常 schedule 更新最多约一分钟检查一次资格并提出替补排班。重复违规的冷却期为 1、2、4、8 个 epoch（6、12、24、48 小时），上限为 8 个 epoch。若在 epoch `N` 首次违规，最早在 `N+2` 调用恢复；后续对应最早为 `N+3`、`N+5`、`N+9`。

epoch 级网络异常保护仍先于个体批量处罚执行。快速熔断只针对已经主动申请恢复的试运行节点，因此不会把普通候选人或未被排班的 Standby 误判为漏块。排班变更仍通过标准生产者 schedule 提议、确认和激活流程完成。

#### 不修改链核心的保守版本

系统合约可以通过 `get_active_producers` 获取当前活跃账户，并按 slot 公式推算漏块，但无法安全覆盖“两个实际区块之间恰好发生排班切换”的全部边界。若先做合约版 MVP：

- 合约保存 `active_schedule_hash` 和 `last_processed_slot`。
- 排班哈希未变化时才根据 slot 间隔计算漏块。
- 发现排班变化的整个过渡区间只记录、不处罚。
- 任何无法唯一归属的 missed slot 都不得计入个体惩罚。

这一版本可以支持奖励折减和公开统计，但主网上线“自动失去资格”前，仍建议完成链核心 intrinsic，使历史重放测试能够逐 slot 验证统计结果。

### 5.3 本金罚没仅针对可证明作弊

建议只对以下情况罚本金：

- 同一高度、同一轮次签署两个冲突区块。
- 签署可验证的冲突 finality 证明。
- 提交伪造的链上证明并被合约验证失败。

处理流程：`submit evidence -> 自动验证 -> 冻结 -> 48 小时挑战期 -> 执行罚没`。证据验证必须是确定性的链上逻辑；DAO 只能处理边界争议，不能凭多数票认定密码学事实。

建议首期罚没 5% 自质押；一年内第二次 20%；第三次永久禁入。罚没资金 50% 销毁、40% 安全储备、10% 奖励有效举报者，且举报奖励设上限。

## 6. BP 注册信息

系统表建议新增 `bpmetadata`，大字段以内容哈希和 URI 存储，链上保留关键索引：

```text
owner, display_name, website, x_account, logo_uri,
country_code, region_code, org_name,
p2p_endpoint, api_endpoint, node_version,
email_hash, terms_hash, metadata_hash,
commission_rate, updated_at, verified_at
```

规则：

- `website` 必须为 HTTPS，`x_account` 必填。
- 网站需在约定路径发布由 BP active key 签名的声明，证明网站归属。
- 资料变更链上留历史事件；签名密钥、佣金、网站变更均有延迟生效期。
- `email_hash` 仅用于验证，不在链上公开邮箱明文。
- 资料超过 90 天未重新确认，候选人保持注册但失去 `qualified` 资格。

## 7. DAO 治理

### 7.1 治理范围

DAO 可治理：竞选参数、奖励比例、门限、国库支出、合约升级提案和紧急委员会成员。不能通过普通提案直接转移用户质押、回滚已结算奖励或绕过 timelock。

建议三类提案：

| 类型 | 通过门槛 | 法定人数 | 执行延迟 |
| --- | ---: | ---: | ---: |
| 普通参数 | 赞成票 > 50% | 总投票权 10% | 3 天 |
| 国库/合约升级 | 赞成票 >= 66.7% | 总投票权 20% | 7 天 |
| 紧急暂停 | 5/7 安全委员会多签 | 不适用 | 立即；7 天自动失效 |

投票权使用提案创建前一 epoch 的快照，防止闪电贷和提案期间临时借票。提案需缴纳保证金；达到法定人数后退还，垃圾提案或恶意载荷可按明确规则部分扣除。

### 7.2 从 `mdao.contracts` 复用什么

可复用的设计：

- `mdao.stg` 的可配置投票/提案资格策略。
- `mdao.propose` 的提案、选项、投票记录与截止时间结构。
- `mdao.gov` 的治理配置、通过门槛和投票周期。
- `mdao.stake` 的用户锁仓、解锁时间和按 DAO 汇总方式。
- `mdao.treasury` 的资产登记思路。

不应原样部署：

- 当前代码主要面向 AMAX 生态，包含 AMAX token/NFT 类型和固定账户名。
- 投票期校验、执行动作和宏命名需要重新审计，不能直接承担 FLON 系统权限。
- 缺少面向系统参数的白名单执行器和强制 timelock。
- 节点出勤与惩罚属于链系统域，不能放入通用 DAO 提案合约。

推荐拆成 `flon.gov`、`flon.proposal`、`flon.treasury`、`flon.timelock` 四个合约；投票策略代码可从 mDAO 移植，但账户、token、NFT 和权限全部 FLON 化。

## 8. 合约和链核心改造

### 8.1 `flon.system`

已实现：

- `regproducer` / `regproducer2` 共用内部 `check_min_bp_self_stake` 门限检查。
- `setbpstake(enforce_schedule, min_self_stake, unstake_delay_sec)`：治理配置；默认建议 `500,000 FLON`、21 天。
- `stakebp` / `unstakebp` / `claimbpstake`：自质押、延迟退出和到期主动申领。
- `bpstakecfg` / `bpstakes` / `bpstkrefund`：配置、本金和待退款链上状态表。
- `update_elected_producers` 与 Standby 快照在 `enforce_schedule=true` 时共同排除自质押不足者。

仍需新增或扩展：

- `regproducer2`：补充佣金和 metadata 哈希。
- `setbpmeta` / `confirmmeta`。
- `voteproducer`：改为平均分票并记录 epoch 快照。
- `closeepoch`：结算出勤、排名、奖励和惩罚。
- `resumeprod(producer)`：BP 冷却期结束后以自身权限申请恢复，进入链上试运行；停权由确定性统计自动执行。
- `submitevid` / `challenge` / `execslash`。
- `update_elected_producers`：过滤不合格候选人并记录 active/standby 状态。

待新增表：`bpmetadata`、`penalties`、`evidence`；绩效、Epoch、奖励快照及自质押表已由当前系统合约维护。

部署时采用两阶段迁移：先执行 `setbpstake(false, "500000.0000 FLON", 1814400)`，立即约束新注册或重新注册的候选人，同时允许现有排班成员补足自质押；宽限期结束后再由治理执行 `setbpstake(true, ...)`，从下一次排班与 Standby 快照开始过滤不足者，避免一次升级导致活跃集合骤减。

### 8.2 `voter.reward`

保留现有累计 `rewards_per_vote` 模型，增加：

- epoch 和 BP 维度的奖励来源审计字段。
- BP 佣金结算。
- 不合格 BP 的奖励屏蔽。
- 精度、乘法溢出、舍入余数和零票场景测试。
- `claimrewards` 仅允许受益投票人本人授权；旧 `claimfor` 接口必须限制为 `claimer == voter`，不得用于第三方代领。

### 8.3 链核心与历史索引

`onblock` 能看到当前实际出块者，但“应出块者”不能仅靠实际区块推断。需要链核心或确定性系统逻辑提供每个 slot 的计划生产者及漏块跨度，形成可重放统计。若无法在首期安全完成，则第一阶段只做奖励扣减和外部健康评分，不做自动本金罚没。

索引器/API 应提供：候选列表、活跃/备用排名、自质押、委托票、佣金、近 24 小时/30 天出勤、警告、罚单、奖励历史、资料验证状态和 DAO 提案。

## 9. 产品页面

最小页面集合：

1. 节点榜单：活跃、备用、全部候选；显示票数、自质押、佣金、出勤和风险状态。
2. 节点详情：注册资料、历史出勤、奖励、惩罚、委托容量和投票入口。
3. 成为节点：硬件检查、资料填写、签名验证、自质押、注册交易、运行状态确认。
4. 我的投票：锁仓、选择节点、收益、撤票队列和风险提示。
5. DAO：提案列表、创建、投票、执行队列和国库。
6. 透明度：epoch 数据、奖励铸造、销毁、罚没和参数变更历史。

产品必须明确区分“预计奖励”和“已结算可领取奖励”，并提示投票人：所选 BP 不达在线门限时，当期可能没有奖励。

蓝湖“节点竞选”链接在本次核验时返回连接关闭，页面内容未纳入以上字段映射；恢复访问后应补一份“蓝湖页面 -> 链上动作/API/合约表”的逐页映射。

## 10. 分阶段实施

### 阶段 0：参数和仿真，1–2 周

- 用主网流通量、前 100 地址分布和现有 BP 数据跑集中度仿真。
- 确定最低自质押、委托容量、通胀、奖励比例和在线门限。
- 输出经济模型不变量和升级/回滚方案。

### 阶段 1：竞选与公开信息，3–4 周

- 增加自质押、metadata、佣金、active/standby 状态。
- 沿用现有投票锁仓和 21 BP 排班，改为平均分票。
- 完成榜单、详情、成为节点和我的投票页面。
- 暂不铸造新币，只用测试奖励金库验证账本。

### 阶段 2：奖励与出勤，3–5 周

- 实现 epoch、应出/实出统计、奖励指数和 claim。
- 上线扣奖、停权、冷却和备用递补。
- 先在测试网连续运行至少 30 天，做总供应、奖励守恒和故障注入测试。

### 阶段 3：DAO，3–4 周

- 移植 mDAO 策略、提案和质押模型。
- 增加 FLON 白名单执行器、timelock 和国库。
- 治理初期只开放非安全关键参数；合约升级仍使用多签加 timelock。

### 阶段 4：作弊证据与罚没，4–6 周

- 仅在双签/冲突 finality 证据能够链上确定性验证后启用。
- 安全审计、公开测试网攻击演练和赔付/误罚恢复流程完成后再上主网。

## 11. 上线验收条件

- 任一时刻奖励铸造不超过 epoch 与年度上限。
- BP、投票人、国库、销毁四方之和与实际铸造严格守恒。
- 排名前 21 的合格 BP 与实际排班一致，备用递补可在目标时间内完成。
- 漏块统计可由独立节点从区块历史重放得到相同结果。
- 网络整体故障不会触发大面积本金罚没。
- 改票、撤票、BP 退出、佣金变化和资料变化均遵守延迟期。
- DAO 不能执行白名单外系统动作，timelock 不能被普通提案绕过。
- 主网升级前保留旧表迁移、双读核对、暂停开关和可验证回滚点。

## 12. 参考资料

- NEAR Protocol Specification, Economics: https://nomicon.io/Economics/Economics.html
- NEAR Protocol Specification, EpochManager: https://nomicon.io/BlockchainLayer/EpochManager/
- Avalanche Builder Hub, How to Stake: https://docs.avax.network/docs/primary-network/validate/how-to-stake
- Avalanche Builder Hub, Validator Manager Contracts: https://build.avax.network/docs/avalanche-l1s/validator-manager/contract
- FLON system voting: `unittests/system_contracts/contracts/flon.system/src/voting.cpp`
- FLON block rewards: `unittests/system_contracts/contracts/flon.system/src/producer_pay.cpp`
- FLON voter rewards: `contracts/voter.reward/src/voter.reward.cpp`
- mDAO reference: `/Users/ray/work/wasm.contracts/amc/mdao.contracts`
