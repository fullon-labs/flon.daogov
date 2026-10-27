# FLON 测试网 E2E 执行报告

## 运行信息

| 字段 | 值 |
|---|---|
| Run ID | |
| UTC / 北京时间 | |
| RPC | `https://t4.flon.network` |
| Chain ID | `18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f` |
| Head / LIB（开始） | |
| Head / LIB（结束） | |
| Core / contract code hash | |
| 本地 wallet（不记录 key） | `flontest` |
| BP / Voter / Proposer / Endorser / Executor | |

## 用例结果

| Case ID | Pass/Fail/Blocked | Transaction ID | Block / LIB | 执行前后证据 | 精确错误/备注 |
|---|---|---|---|---|---|
| | | | | | |

## Epoch 边界证据

| 项目 | 边界前 | 边界后 |
|---|---|---|
| Epoch ID / close time | | |
| pendingvote / votedeltas | | |
| voter allocations | | |
| producer total_votes | | |
| Active schedule | | |

## BP Performance

| BP | Expected | Produced | Missed | Idle skipped | Rate | Status | Warning/Suspension |
|---|---:|---:|---:|---:|---:|---|---|
| | | | | | | | |

| Epoch 字段 | Before | After |
|---|---|---|
| complete_sample / closed | | |
| network_incident | | |
| rewardseal phase/stage | | |

## 区块基础奖励对账（最小单位）

| BP | Gross | Factor bp | Eligible | BP expected/actual | Voter share expected/actual | Forfeited | Pass/Fail |
|---|---:|---:|---:|---:|---:|---:|---|
| | | | | | | | |

## GAS 奖励对账

| GAS Epoch | Pool | Active pool/allocated | Standby pool/allocated | Node sum | Funded/Finalized | Pass/Fail |
|---:|---:|---:|---:|---:|---|---|
| | | | | | | |

| BP | Role | Expected/Produced/Missed | Eligible/Score | Allocated | Claim before/after |
|---|---|---|---|---:|---|
| | | | | | |

## Voter reward 守恒

| 断言 | Expected | Actual | Pass/Fail |
|---|---:|---:|---|
| producer total = allocating + allocated | | | |
| global total = producer totals | | | |
| producer allocated = voter claimed + unclaimed | | | |

## Claim 验证

| 类型 | 触发账户 | 受益账户 | max_steps | 余额变化 | Claim rows 变化 | 重复领取结果 |
|---|---|---|---:|---:|---|---|
| BP base | | | | | | |
| BP GAS | | | | | | |
| Voter | | | | | | |

## 资产守恒

| 资产/账户 | 开始 | 结束 | 预期变化 | 实际变化 |
|---|---:|---:|---:|---:|
| Voter FLON | | | | |
| Voter GLON | | | | |
| BP self-stake/refund | | | | |
| Treasury liquid/reserved/paid | | | | |

## DAO 提案证据

| 字段 | 值 |
|---|---|
| Proposal ID / type / risk | |
| Frozen action contract/name/hex/hash | |
| Power/policy snapshot | |
| Endorse / vote / finalize times | |
| for / against / abstain / quorum | |
| Timelock / grace deadline | |
| Execute actor / target state diff | |

## 未解决问题与回滚/清理

- 未通过项目：
- 是否为产品缺陷、环境问题或策略预期：
- 可恢复的测试状态：
- 后续动作：
