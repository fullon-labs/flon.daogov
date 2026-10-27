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
- 等待：L3 附议期、投票延迟、投票期和 Timelock 必须按链上真实时间经过，之后验证 permissionless execute 与 Treasury 守恒。

## 3. Epoch / 出块率 / 奖励核算

- 已在 Reward Epoch 769 封存前保存 before 快照：`bp-rewards-epoch769-before/`。
- Epoch 769 自然结束时间约为北京时间 2026-10-27 12:33:39；不得修改 Epoch 时长或手动加速。
- 等待 Keeper 自然封存后抓取 after 快照，复算三名 Active BP 的 expected、produced、missed、idle_skipped、基础奖励、voter share、forfeited、GAS pool 与 voter reward 三层守恒。

## 4. 尚未完成/时间门控

1. 提案 #3：附议期结束 → activate → 延迟后投票 → finalize → queue → 1 小时 Timelock → 任意账户 execute → Treasury grant 校验。
2. Reward Epoch 769 与对应 GAS Epoch 的 after 快照和完整奖励核算。
3. `pendingvote` 在 Epoch 770 消费后的 BP 票数、排名与 schedule 校验。
4. voter refund 72 小时正向领取。
5. BP unstake 21 天正向领取只可在长期测试窗口完成；本轮已覆盖创建、提前领取拒绝、取消与状态恢复。

## 5. 发布门禁

当前不得宣告“可发布主网”。只有第 4 节的核心治理执行闭环、Epoch 奖励核算及 voter refund 完成且无账务差异，才可给出主网发布建议。
