# FLON 测试网端到端测试报告（执行中）

## 1. 执行信息

| 项目 | 值 |
|---|---|
| Run ID | `testnet-e2e-20261027T033545Z` |
| 测试网 RPC | `https://t4.flon.network` |
| Chain ID | `18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f` |
| Core | `v0.9.0` |
| 钱包 | 本地 `fuwal` / `flontest`，未导出私钥 |
| 证据目录 | `artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/` |
| 当前结论 | **执行中，尚不能批准主网发布** |

## 2. 已验证结果

### 2.1 安全与脚本

- PASS：RPC chain ID 精确匹配测试网。
- PASS：所有写操作由本地 `fuwal` 签名，未读取或输出私钥。
- PASS：`tpush` 与 E2E 脚本的写 RPC 均切换到 `https://t4.flon.network`。
- PASS：脚本现在检查 `processed.except/error_code`，不会再把 `fucli` 返回码为 0 的链上失败误判为成功。

### 2.2 BP 自质押、注册、退出与奖励

- PASS：注册状态下减少自质押被拒绝：`registered producer must retain the minimum self-stake`。
- PASS：`hellotoworld` 执行 unregister → unstake `1 FLON` → 到期前 claim 拒绝 → cancel refund → 使用原 signing key/URL/location/share 重新注册；最终恢复 `500,000 FLON` 自质押和候选状态。
- PASS：第三方 `govvoter1111` 代 `miner1111111` 调用 `claimrewards`，`73.48744293 FLON` 只转入 BP 账户。交易：`c8d48f00cbc5c95c5d39f4d09fae03bdab0065c637fc9e254cc0b340d237fac0`。
- PASS：无待领奖励的 BP 调用返回 `all rewards claimed`，未发生付款。

### 2.3 节点投票与 GLON 同步

- PASS：`hellotoworld` 新增投票本金 `4,000 FLON`，自动铸造等额 GLON 并调用 `dao.gov::syncpower`。交易：`2453e830a51df4472001483267791a4344200311a233241e3c9de2b6a0443cff`。
- PASS：治理总票权由 `6,799` 自动更新为 `10,799 GLON`，无需管理员手工同步。
- PASS：提交四个 BP 的非等额分配，总额 `9,300 FLON`；`pendingvote.activation_epoch=770`。交易：`e106f441a999cfc6dabd7b75759d35adcfe4770737e8874f80d7feaa067a0eea`。
- FAIL（Epoch 770 封存后）：`rewardepoch.next_epoch_to_close=771` 且 `epochstats[770].closed=1`，但 `flon::pendingvote` 中 `hellotoworld` 的 `activation_epoch=770` 行仍未删除；`flon::voters` 仍显示旧的 `5300 FLON`，Active producer schedule 仍只有 `bpflowtest11/miner1111111/miner3333333` 三席。虽然 `flon::producers.total_votes` 已出现部分变动且四名 producer 的 `active=1`，但不能认定 pending vote 已被完整消费，需定位 Epoch 结算与 schedule 更新链路。
- PASS：重复分配被拒绝：`producer vote allocations did not change`。
- PASS：分配总额不等于锁定 FLON 被拒绝。
- BLOCKED/等待：账户已有 `0.00000001 FLON` voter refund（2026-10-25 11:44:39 UTC），第二次 `subvote` 按规则被拒绝；需等待 72 小时后完成 refund 正向路径。

### 2.4 信号提案

- PASS：低于 100 GLON 的账户创建提案被拒绝：`insufficient governance power to propose`。
- PASS：无附议提案激活被拒绝并由 proposer 取消。
- PASS：提案 #2 完成 propose、setforum、endorse、permissionless activate、延迟后投票和 permissionless finalize。
- PASS：重复附议被拒绝；附议期内激活被拒绝；投票延迟内 castvote 被拒绝。
- PASS：激活快照冻结为 `10,799 GLON`、quorum `5%`、approval `50.01%`。
- PASS：`hellotoworld` 的 `9,300 GLON` 赞成票计入，提案 #2 最终 `status=4`（通过）。finalize 交易：`55bf53c08d495976ae2962e0547bbe9027f9aaf26b5191fd0aa7f089a28b07f2`。

### 2.5 可执行提案与 Treasury

- PASS：非白名单 `flon.token::transfer` 提案被拒绝：`proposal action is not allowlisted`。
- PASS：非 `dao.gov` 直接调用 `dao.treasury::reserve` 被拒绝：`missing authority of dao.gov`。
- PASS：Treasury 入金 `10 FLON`，账本为 liquid/received `10 FLON`、reserved/paid `0`。交易：`549fa3ce996b87395b9b5e4b62ddf10dc1c817f69803582dc7e48dd2fbbbefe4`。
- PASS：L3 可执行提案 #3 冻结 `dao.treasury::reserve` 的 78-byte action data，金额 `1 FLON`，并由两个独立账户完成附议。
- PASS：提案 #3 在附议期结束后由 `govvoter1111` permissionless activate，交易 `5a7afb3ca0558ab33f160d24b67d83ffc33310a29cab833c950570f04adedc1d`，区块 `21770734`，已不可逆。激活快照为 `10,799 GLON`，L3 quorum `25%`、approval `67%`；投票开始时间为 2026-10-27 13:13:26（北京时间），结束时间为 13:43:26。
- PASS：投票延迟结束后，`hellotoworld` 使用快照票权投赞成票，交易 `bbd420396025e7776428076af53990c1d5432761fec42eef5d22ce79ef206013`，区块 `21770784`，已不可逆；链上 `for_votes=9,300 GLON`、against/abstain 均为 0。
- PASS：投票期结束后由 `govvoter1111` permissionless finalize，交易 `25ef28f6c2d378e58c42abc1f3358b595177723f07bc593a526b9f152cd2d31b`，已观察至 LIB `21772096`。
- PASS：通过后的提案由 `govvoter1111` permissionless queue，交易 `7fde5683d806469668fd8a98bd2823b04a687fac81e79f13773939410cfc22c2`，已观察至 LIB `21772109`；链上状态为 `6`（queued）。
- PASS：Timelock 时间窗冻结为 `2026-10-27T10:38:12Z` 至 `2026-10-29T10:38:12Z`；执行前 Treasury 为 liquid `10 FLON`、reserved `0`、grants 空。
- 等待：北京时间 2026-10-27 18:38:12 后执行 permissionless `execute`，并验证 reserve 后 liquid/reserved/grant 守恒。

## 3. Epoch / 出块率 / 奖励核算

- 已在 Reward Epoch 769 封存前保存 before 快照：`bp-rewards-epoch769-before/`。
- PASS：Epoch 769 已由 Keeper 自然封存，`complete_sample=1`、`closed=1`、`active_bp_count=3`、`failed_bp_count=0`、`network_incident=0`。
- PASS：三名 Active BP 均满足 `expected = produced + missed`，且该 Epoch 都为 100% 出块率：`miner3333333 109/109`、`miner2222222 104/104`、`miner1111111 105/105`；三者均为 `qualified`，warning 为 0。`idle_skipped` 分别为 2291、2296、2295，未计入出块率分母。
- PASS：voter reward 当前表满足 producer 逐行、global/producer、voter claimed+unclaimed 三层守恒。
- PASS：Epoch 770 自然封存且样本完整：`active_bp_count=4`、`failed_bp_count=0`、`network_incident=0`。四行均满足 `expected=produced+missed`：`bpflowtest11 91+1=92`、`miner1111111 100+0=100`、`miner2222222 10+0=10`、`miner3333333 101+0=101`；`idle_skipped` 分别为 `2086/2305/207/2299`。其中 `miner2222222 status=5`（样本不足），其余为 warning/qualified 状态且 warning_count 均为 0。
- WAIT：对应 GAS Epoch 39184 尚未生成可用 settlement，暂不能完成 GAS pool 守恒校验。
- INVALID BASELINE：before/after 之间发生了 BP claim（账户余额和 claim row 已变化），因此本次 sealed reward reconciliation 的三行 `FAIL` 不能归因于奖励公式；该 before 快照不满足“只跨越一个封存且无 claim”的比较前提。证据：`bp-rewards-epoch769-after/summary.md` 与 `comparison.md`。需要选择无 claim 干扰的后续完整 Epoch 重新做严格增量核算。

## 4. 尚未完成/时间门控

1. 提案 #3：已完成 activate、赞成票、finalize 和 queue；等待北京时间 2026-10-27 18:38:12 Timelock 结束后由 `govvoter1111` permissionless execute，并完成 Treasury grant/余额守恒校验。
2. Reward Epoch 769 的生产统计已通过；GAS settlement 尚未就绪，且 BP claim 干扰了 before/after 奖励增量基线，需在后续完整 Epoch 重做无 claim 干扰的严格奖励核算。
3. BLOCKED/缺陷：Epoch 770 已封存，但 `pendingvote` 未删除、voter 仍是旧票数、active schedule 仍为三席；需修复或确认额外 materialize 触发条件后重测。
4. voter refund 72 小时正向领取。
5. BP unstake 21 天正向领取只可在长期测试窗口完成；本轮已覆盖创建、提前领取拒绝、取消与状态恢复。

## 5. 发布门禁

当前不得宣告“可发布主网”。只有第 4 节的核心治理执行闭环、Epoch 奖励核算及 voter refund 完成且无账务差异，才可给出主网发布建议。
