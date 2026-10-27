# BP Performance & Rewards 独立测试用例

## 1. 统计口径

- Reward Epoch 出块率：`produced_blocks / expected_blocks`。
- `expected_blocks = produced_blocks + missed_blocks`。
- `idle_skipped_blocks` 是因调度空闲被跳过的 slot，单独展示，**不进入 missed，也不进入出块率分母**。
- 区块基础奖励直接累计到实际出块 BP 的 `flon::producers.unclaimed_rewards`。
- GAS reward 是独立奖励池，通过 `gasnodestats` 和 `gassettles` 分配给符合条件的 Active/Standby。
- BP voter-sharing、voter reward 与 BP 自留奖励必须分别核对，不能把 `unclaimed_rewards` 当成全部参与者收入。

状态码报告必须同时显示数字和文本映射：正常、warning、probation、suspended、insufficient sample 等；映射以当前合约实现为准。

## 2. Epoch 前后快照

| ID | 场景 | 检查项 | 预期 |
|---|---|---|---|
| PERF-01 | Epoch 开始/中途快照 | `epochstats.closed`、bpstats 增长 | closed=false；统计单调增加 |
| PERF-02 | 自然封存后快照 | complete_sample、closed | 完整 Epoch 为 true/true |
| PERF-03 | 三个 Active 正常轮转 | expected/produced/missed | expected=produced，missed=0 |
| PERF-04 | idle slot | idle_skipped | 单列增长，不增加 missed |
| PERF-05 | 单个 BP 漏块 | missed、longest/trailing streak | 只归属应出块 BP，其他 BP 不受污染 |
| PERF-06 | 不完整样本 | complete_sample=false | 状态为 insufficient sample，不错误处罚 |
| PERF-07 | 网络事故 | network_incident=true | 按策略 hold/豁免，不产生错误 suspension |
| PERF-08 | warning/probation | bpstatus | warning_count、probation epoch 与阈值一致 |
| PERF-09 | suspension | bpstatus/producers/schedule | 到期 Epoch、次数、schedule 调整一致 |
| PERF-10 | 恢复 | resumeprod 后下一阶段 | 满足条件才恢复，不回改历史统计 |

禁止为了构造 PERF-05/07/09 而关闭共享测试网 BP。这些负向场景应由自然事件取证，或在隔离测试节点执行。

## 3. 区块基础奖励

| ID | 场景 | 检查项 | 预期 |
|---|---|---|---|
| BLOCK-RWD-01 | BP 出块 | global/producers delta | `total_produced_rewards` 和对应 BP 未领取额按规则增加 |
| BLOCK-RWD-02 | 未出块 BP | unclaimed delta | 不获得该区块基础奖励 |
| BLOCK-RWD-03 | 多 BP 比例 | produced 与奖励 | 100% 按合格实际出块量分配，无固定 Active 基础份额 |
| BLOCK-RWD-04 | missed | 奖励变化 | missed slot 不产生该 BP 区块奖励 |
| BLOCK-RWD-05 | 减半边界 | block reward | 边界前后奖励符合 315,360,000 奖励区块减半策略 |
| BLOCK-RWD-06 | 总预算 | 累计发行 | 不超过固定挖矿预算和精度规则 |
| BLOCK-RWD-07 | reward share | BP 自留/voter pool | `reward_shared_ratio` 精确拆分，和为原奖励 |
| BLOCK-RWD-08 | 四舍五入 | 最小单位余数 | 无凭空增发，余数按合约规则处理 |

## 4. BP 领取奖励

| ID | 场景 | 预期 |
|---|---|---|
| CLAIM-01 | BP 本人触发 claimrewards | 分步结算并到账，unclaimed/claim rows 更新 |
| CLAIM-02 | Keeper/第三方代触发 | 允许触发，资金仍进入正确 BP/voter 受益账户 |
| CLAIM-03 | max_steps 小于待结算量 | 只处理上限，后续调用可继续且不重算 |
| CLAIM-04 | 多次直到完成 | 所有 epoch 只结算一次 |
| CLAIM-05 | 无可领取奖励 | 无转账，按合约定义拒绝或安全 no-op |
| CLAIM-06 | 重放相同交易/重复领取 | 不重复支付 |
| CLAIM-07 | 领取前后守恒 | BP 到账 + voter pool + 剩余 = 领取前总额 |

## 5. GAS Active/Standby 奖励

| ID | 场景 | 预期 |
|---|---|---|
| GAS-01 | GAS epoch 配置快照 | epoch_slots/pool/share 等与 `gasepochcfg` 一致 |
| GAS-02 | Active 合格 | production rate >= active_min，eligible=true |
| GAS-03 | Active 不合格 | eligible=false，不瓜分 Active pool |
| GAS-04 | Active 按绩效 | allocated 与 score 比例及舍入一致 |
| GAS-05 | Standby 合格 | 有效 proof 达门槛，进入 Standby 分配 |
| GAS-06 | standbyproof 重复/错误 | 拒绝，不增加 proof 计数 |
| GAS-07 | pool 拆分 | active_pool + standby_pool = pool |
| GAS-08 | allocation 守恒 | active/standby allocated 与各节点 allocated 合计一致 |
| GAS-09 | settlement | funded/finalized/phase、参与人数一致 |
| GAS-10 | incident hold | incident_hold 时不错误付款 |
| GAS-11 | claim | gasclaims 只增加一次，领取前后余额守恒 |

## 6. Voter reward

| ID | 场景 | 预期 |
|---|---|---|
| VOTER-RWD-01 | 参与获奖 BP | 按该 BP 分享池和 voter 有效票权获得奖励 |
| VOTER-RWD-02 | 未投该 BP/待生效投票 | 不追溯获得历史 Epoch 奖励 |
| VOTER-RWD-03 | 多 BP 分配 | 各来源相加准确，无重复计算 |
| VOTER-RWD-04 | 撤票跨 Epoch | 旧 Epoch 仍可领，新 Epoch 使用新快照 |
| VOTER-RWD-05 | claimrewards | 只给受益 voter 本人，未领取额可跨 Epoch 累积 |
| VOTER-RWD-06 | Keeper 下线 | 用户自行触发仍能领取 |

## 7. 快照执行方法

在 Epoch 开始或测试窗口内保存 before：

```bash
cd /Users/ray/work/flon/flon.daogov
EPOCH_ID=768 GAS_EPOCH_ID=39184 \
  scripts/testnet-bp-rewards.sh capture --label before
```

等待自然 Epoch 封存、Keeper 完成结算，再保存 after。必须沿用同一 `EPOCH_ID`/`GAS_EPOCH_ID`：

```bash
EPOCH_ID=768 GAS_EPOCH_ID=39184 \
  scripts/testnet-bp-rewards.sh capture --label after
```

比较两份快照：

```bash
BEFORE_DIR=/absolute/path/to/before \
AFTER_DIR=/absolute/path/to/after \
  scripts/testnet-bp-rewards.sh compare
```

脚本保存：链头/LIB、reward epoch、`bpstats`、`bpstatus`、producers、producer claims、GAS config、node stats、settlement 和 GAS claims，并生成 `summary.md`/`comparison.md`。脚本全程只读。

