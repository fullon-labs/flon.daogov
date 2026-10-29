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
- PASS（2026-10-28）：`govvoter1111@active` permissionless execute 提案 #3，交易 `d8962a83ed7ec328695495835a00e4eb026915c4d66a27ca4e08ca46f80a3905`，区块 `21780957`。trace 含 `dao.treasury::reserve` 1 FLON；提案状态变为 7。Treasury liquid 仍为 10 FLON，reserved 由 0 变 1 FLON，grant #1 的 total 为 1 FLON、paid/released 均为 0，故 `reserved = grant total - paid - released = 1 FLON`。已由 LIB `21780962` 确认不可逆。
- PASS（2026-10-28）：72 小时后 `hellotoworld@active` 调用 `flon::voterefund`，交易 `0f3abbb8b941552e39d815b11eaef34a566c2ac0cbbe1a5b5a834f070e9b5b34`，区块 `21780961`。trace 含 `flon.vote` 向本人转账 `0.00000001 FLON`，退款行已删除。重复调用被 `no vote refund found` 拒绝。账户同期有其他交易，不能用两次余额读数单独证明该笔增量，以不可逆交易 trace 为准。已由 LIB `21780962` 确认不可逆。

## 3. Epoch / 出块率 / 奖励核算

### 2026-10-28 补充：BP 不稳定出块样本

- 测试网链 ID 已核对为 `18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f`。只读快照见 `artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/bp-performance-live-20261028T1322Z/`，采集时 head/LIB 为 `21780602/21780572`。
- Epoch 797–801 的所有 `bpstats` 行均满足 `expected_blocks = produced_blocks + missed_blocks`。Epoch 798 已自然封存、样本完整且无网络事故；`miner2222222` 为 `28/35`（80%），漏块 7，最长及尾部连续漏块均为 6，`idle_skipped_blocks=1321` 单列，链上状态码 4、warning_count 1。该 Epoch `failed_bp_count=1`，与唯一异常 BP 一致。
- Epoch 799 的 `hawking` 为 `3/4`、漏块 1；该 Epoch 已封存且样本完整，`failed_bp_count=0`。Epoch 800–801 的 21 个排班 BP 无漏块。Epoch 802 快照中 21 行均满足等式，但仍未封存，不能据此判定最终出块率。
- 上述自然缺块样本已覆盖统计归属与分母检查；仍需以区块头逐 slot 独立重算 Epoch 798，并核对处罚阈值、schedule 变化和奖励扣减，才算完成准确性验证。共享测试网节点暂不主动停机。

- 已在 Reward Epoch 769 封存前保存 before 快照：`bp-rewards-epoch769-before/`。
- PASS：Epoch 769 已由 Keeper 自然封存，`complete_sample=1`、`closed=1`、`active_bp_count=3`、`failed_bp_count=0`、`network_incident=0`。
- PASS：三名 Active BP 均满足 `expected = produced + missed`，且该 Epoch 都为 100% 出块率：`miner3333333 109/109`、`miner2222222 104/104`、`miner1111111 105/105`；三者均为 `qualified`，warning 为 0。`idle_skipped` 分别为 2291、2296、2295，未计入出块率分母。
- PASS：voter reward 当前表满足 producer 逐行、global/producer、voter claimed+unclaimed 三层守恒。
- PASS：Epoch 770 自然封存且样本完整：`active_bp_count=4`、`failed_bp_count=0`、`network_incident=0`。四行均满足 `expected=produced+missed`：`bpflowtest11 91+1=92`、`miner1111111 100+0=100`、`miner2222222 10+0=10`、`miner3333333 101+0=101`；`idle_skipped` 分别为 `2086/2305/207/2299`。其中 `miner2222222 status=5`（样本不足），其余为 warning/qualified 状态且 warning_count 均为 0。
- WAIT：对应 GAS Epoch 39184 尚未生成可用 settlement，暂不能完成 GAS pool 守恒校验。
- INVALID BASELINE：before/after 之间发生了 BP claim（账户余额和 claim row 已变化），因此本次 sealed reward reconciliation 的三行 `FAIL` 不能归因于奖励公式；该 before 快照不满足“只跨越一个封存且无 claim”的比较前提。证据：`bp-rewards-epoch769-after/summary.md` 与 `comparison.md`。需要选择无 claim 干扰的后续完整 Epoch 重新做严格增量核算。

## 4. 尚未完成/时间门控

### 2026-10-29 测试网治理权单位迁移

- 链 ID 每笔交易前均核对为 `18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f`；使用本地已解锁的 `flontest` 钱包，未读取私钥。迁移前备份：`artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/governance-power-immediately-before-migrate-20261029/`。
- 临时 `dao.gov` 上链交易 `5deb7478165813987c6a7ff3e14c5725ed5f4cc84c5a040d74a75f87b14b066b`，区块 `21784028`；链上 WASM 哈希与一次性产物 `de0f6e963e6f6ebb40ee79bde66d96e3a3fa403b0ef40c7522ff64d4a950676f` 一致，后续 LIB 已超过该区块。
- `flon.system` 上链交易 `62ab15d9d194912a0125a06a258961fb26a7482e76c3b522eb3046617f48df38`，区块 `21784061`；链上 WASM 哈希与构建产物 `037129e1f1c42e6a4fee5251c74aa9b476dcf0bd03306bddfc65eef1784d485e` 一致，后续 LIB 已超过该区块。
- 一次性 `dao.gov::migrateunit` 交易 `f2c09a61ffcd6d7d7a5c5ba8df8ada01bb6a2b8fad07d73c53221de7f52f4fe0`，区块 `21784097`，后续 LIB 已超过该区块。迁移前后 16 组治理表逐字段比较通过：仅资产单位 `GLON → POWER`，4 个账户治理权合计仍为 `10,799`，3 个历史提案及其投票数保持不变。迁移后备份：`artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/governance-power-after-migrate-20261029/`。
- 干净的 `dao.gov` 上链交易 `65065c548390ee53c792bc6e2295a064f945222df18327d5648e2239f7415eac`，区块 `21784131`；链上 WASM 哈希为 `b665f7670419ec676ea367771998d6f17da4925b6b65f39aca564a40b2ca507f`，ABI 不含 `syncpower` 或 `migrateunit`。后续 LIB 已超过该区块。
- `hellotoworld@active` 调用 `flon::addvote` 增加 `0.00000001 FLON`，交易 `11791e9c55c873377b92f3b9b74e3bba9c0b1ed1b5e0f7ec9764725dce01f7b4`，区块 `21784169`，后续 LIB `21784173` 确认不可逆。账户治理权从 `9300` 精确增加到 `9300.00000001 POWER`；全网治理权从 `10799` 增至 `10799.00000001 POWER`，4 个账户之和守恒。待生效节点票进入 Epoch 815，需在自然封存后确认 `pendingvote` 被清理。旧测试网 GLON token 供给仍为 `10799`，未随新增投票而铸造；仅保留旧测试网 token 合约阻止历史 GLON 转账。
- 测试网 DApp 在 app-host 构建并仅重建 `flon-daogov-testnet`。全量前端测试初次运行发现两条新增文案未覆盖全部语言，已补齐后 39 项全通过，再构建 `local/flon-daogov:power-20261029-r2`。公网 `https://daogov-t.flon.network/` 返回 HTTP 200，引用最终 JS `assets/index-akjyXKBN.js`，公开 JS 无 GLON 文案，`config.js` 链 ID 正确；测试网容器 healthy，主网 DApp 容器仍为 `local/flon-daogov:0c0f72c`。
- 测试网 Keeper 容器在本轮只读检查时为 `unhealthy`：健康检查返回 HTTP 503，日志连续出现 BP claim 广播后 3 分钟确认超时。链上 LIB 本轮约需 5–6 分钟追上交易区块，可能使 Keeper 将最终成功的交易判为超时；需单独核对 Keeper 确认逻辑及奖励结算，未重启或改动 Keeper。

### 2026-10-28 18:00 UTC 只读复查

- 测试链 ID 核对通过；head/LIB 为 `21782084/21782054`。快照见 `artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/live-check-20261028T1800Z/`。
- `flon::global.last_producer_schedule_size` 已变为 21，`hellotoworld` 的 `voters.votes` 已变为 `9300 FLON`；这表明此前“三席、旧票数”的观察已不再代表当前链状态，但尚不能证明 Epoch 770 的待生效票被正确消费。
- `rewardepoch.next_epoch_to_close=807`，而 `pendingvote` 仍有四行，`activation_epoch=799`，包括 `hellotoworld`。这些行已跨过多个自然封存 Epoch，待查其是否为重复生成、清理失败或正常队列语义；在定位前仍按发布阻断处理。此轮未提交交易、未修改配置。

1. 提案 #3：execute 和 Treasury grant/预留核对已通过，交易已不可逆。
2. Reward Epoch 769 的生产统计已通过；GAS settlement 尚未就绪，且 BP claim 干扰了 before/after 奖励增量基线，需在后续完整 Epoch 重做无 claim 干扰的严格奖励核算。
3. BLOCKED/待复测：旧的三席与 `5300 FLON` 观察已被后续 21 席排班、`9300 FLON` 覆盖；新的 `flon.system` 已部署，旧待生效行已清理。本轮新增投票在 Epoch 815 生效前保留 `pendingvote` 属于预期；必须在自然封存后验证其被消费、voter 票数及 21 席 schedule 一致，才能解除该门禁。
4. voter refund 72 小时正向领取与重复领取拒绝已通过，正向交易已不可逆。
5. BP unstake 21 天正向领取只可在长期测试窗口完成；本轮已覆盖创建、提前领取拒绝、取消与状态恢复。

## 5. 发布门禁

当前不得宣告“可发布主网”。只有第 4 节的核心治理执行闭环、Epoch 奖励核算及 voter refund 完成且无账务差异，才可给出主网发布建议。
