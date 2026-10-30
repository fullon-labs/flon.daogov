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

### 2026-10-29 Epoch 815 自然封存复测

- PASS：测试链 ID 再次核对通过；采集时 head/LIB 为 `21784738/21784709`。`rewardepoch.next_epoch_to_close=816`，Epoch 815 `closed=1`、`complete_sample=1`、`active_bp_count=21`。
- PASS：`hellotoworld` 的 `pendingvote` 已清理；`voters.votes=930000000001`（即 `9300.00000001 FLON` 本金单位），所投 21 名 BP 与 Active schedule 的 21 名完全一致，21 名 BP 的 `total_votes` 均为 `44285714285`。完整链上快照见 `artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/epoch815-pendingvote-and-schedule-20261029.json`。此前 pendingvote 不消费的发布阻断项已通过新版合约复测解除。
- WAIT：Epoch 815 的 BP 生产率、奖励 GAS 结算和 voter share 守恒尚须独立核算；本次排班和票数复测不等于奖励核算通过。

### 2026-10-29 Epoch 816 与 GAS Epoch 39191 只读核算

- PASS：测试链 ID 再次核对通过；采集时 head/LIB 为 `21785078/21785039`。`rewardepoch.next_epoch_to_close=817`，Epoch 816 已自然封存，`closed=1`、`complete_sample=1`、`active_bp_count=21`、`failed_bp_count=0`、`network_incident=0`。
- PASS：Epoch 816 的 21 名 Active BP 全部满足 `expected_blocks = produced_blocks + missed_blocks`，均为零漏块且 `status=qualified`；`idle_skipped_blocks` 独立记录，未进入出块率分母。完整快照见 `artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/epoch816-rewards-after-20261029T0402Z/`。
- PASS：GAS Epoch 39191 已 `finalized=1`、`funded=1`。25 个 eligible 节点分配合计 `0.00142233 FLON`，精确等于 `active_allocated 0.00137645 + standby_allocated 0.00004588 FLON`，也等于 settlement pool；节点统计同样全部满足 `expected = produced + missed`。
- PASS：当前 voter reward 三层守恒：逐 producer 均满足 `total = allocating + allocated`；global total 与 producer total 均为 `7573.18087944 FLON`；producer allocated 与 voter claimed+unclaimed 均为 `5247.06352568 FLON`。
- WAIT：Epoch 816 的 `epochreward` 表已无行，且本轮没有封存前、无 claim 干扰的 before 快照，因此只能确认封存后的生产统计、GAS 分配和当前 voter reward 守恒，不能据此证明该 Epoch 的 BP 基础奖励增量完整守恒。仍需选择后续 Epoch 在封存前后建立同一基线复测。
- INFO：Keeper 健康接口仍为 `healthy=false`，最近错误仍是 BP claim 等待确认超时；其最近成功时间晚于前一轮检查，说明并非完全停止，但 3 分钟确认窗口与测试网 LIB 延迟仍需修复。本轮未重启或部署 Keeper。

### 2026-10-29 Epoch 817 封存前后核算

- PASS：测试链 ID 核对通过；Epoch 817 已自然封存，`rewardepoch.next_epoch_to_close=818`，且 `closed=1`、`complete_sample=1`、`active_bp_count=21`、`failed_bp_count=0`、`network_incident=0`。
- PASS：21 名 BP 全部满足 `expected_blocks = produced_blocks + missed_blocks`，本 Epoch 总漏块为 0。封存前后证据分别保存在 `artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/epoch817-rewards-before-20261029T0412Z/` 与 `epoch817-rewards-after-20261029T0506Z/`。
- PASS：封存后仍可见 20 名 BP 的 Epoch 817 `prodclaims`，合计 `232.27422629 FLON`；`archimedes` 的同期余额增加 `11.09842719 FLON` 且 claim 行已被消费，合计可重建本 Epoch 21 名 BP 基础奖励为 `243.37265348 FLON`。本轮 21 席的 voter reward producer/global 表均无增量，与其链上 reward share 配置一致。
- PASS（claim-aware 严格门禁）：已采用 `after prodclaims - before prodclaims + 窗口内不可逆基础奖励付款` 重建 Epoch 817。所有 `last_claim_time` 变化账户均有对应 trace，且三个区块均位于快照窗口 `(21785136, 21785410]`、状态为 `irreversible`，交易为 `executed`：`copernicus` 交易 `c412e99b125e1709bedb468b82676851c20264985d3abb35ae07851d0b8bf855`、`curie` 交易 `0aae771b6592863a7f052216b68b8553bc51eb7c507c3affc07f7124fb94af64`、`archimedes` 交易 `c0685c2c12f6f0107abede854a62a559843f28b94db309adb78a7e5916ea8344`。
- PASS：trace 解码分别确认基础奖励付款 `15.85489600/68.96879755/11.09842719 FLON` 均进入对应 BP；`curie` 同笔另有 `0.00006590 FLON` GAS 奖励。三个账户的实际余额增量分别与各自 trace 总付款完全一致，无未解释转账。最终重建 Epoch 817 的 21 BP 基础奖励总额为 `243.37265348 FLON`，逐 BP 应计均非负。
- PASS：严格核算器 `scripts/reconcile-bp-claims.mjs` 已接入 `scripts/testnet-bp-rewards.sh compare`；缺失 `archimedes` trace 和篡改收款人两个负向测试均被拒绝。核算结果见 `artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/epoch817-claim-aware-reconciliation.json`（SHA-256 `d29250db7c4093c046c19cf3d1ce3249751cca55611dfb778db869dae604717f`），原始不可逆 trace 与解码摘要见 `epoch817-claim-traces-20261029/`。
- INFO：此前“必须无 claim 才能核算”的限制由本轮可重建门禁取代，Keeper 自动 claim 不再导致假失败。Keeper 的 3 分钟确认超时健康问题仍是独立运维缺陷，不影响上述已经由不可逆区块 trace 证明的账务结果。

### 2026-10-29 BP Status Page 链上字段与 DApp 发布

- PASS：按固定流程在本机进入 `flonv` 后执行容器内 `ut`，`flontest` 钱包成功解锁；未读取、记录或输出钱包密码及私钥。写操作前再次核对 chain ID 为 `18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f`。
- PASS：`flon.system` 升级交易 `70601bd0e22755881eaef362dfe3d07dfa1554785dadc2d28fac5562fc67b7c1` 在区块 `21785034` 执行成功，并由 LIB `21785034` 确认不可逆。部署 WASM SHA-256 为 `88bf9110d6fa2e138434e0d11ca484c006be961c066a7ab2480b29cbeab340cf`。
- PASS：链上 ABI 的 `regproducer` 与 `producer_info` 均新增尾部可选字段 `status_url:string$`，旧客户端与旧表行保持可解码。升级前后 `producers` 均为 26 行；owner、票数、签名公钥、active、官网 URL、location、producer authority、分成比例及 revision 等核心字段逐行一致。ABI 与表快照见 `artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/flon-system-status-url-get-abi-20261029.json` 和 `flon-system-status-url-producers-after-20261029.json`。
- PASS：仅测试网 DApp 服务切换为 `local/flon-daogov:status-url-20261029-r1`，镜像 ID `sha256:0ec513389458b0642976dd38ec72b16fba8dd18bfef1fefecbe900fc90129394`；主网容器 ID 与镜像 `local/flon-daogov:0c0f72c` 保持不变。
- PASS：公网 `https://daogov-t.flon.network/` 返回 HTTP 200，引用 `/assets/index-CGLA0pgo.js`。公网与容器内 JS SHA-256 均为 `0d1e824c85cde67b26669b393b76564591b2d1bc4c03491c44756f038ffd6149`；bundle 含 `status_url` 交易/展示逻辑且 `GLON` 出现次数为 0，公开 `config.js` 的测试网 chain ID 正确。

### 2026-10-29 BP 注销与 30 分钟全额 unstake

- PASS：写操作前确认测试链 ID 为 `18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f`，`flontest` 钱包已解锁；未读取或输出私钥。操作前 `hellotoworld` 为 active BP，自质押 `500000.00000000 FLON`，无待领取退款，链上 `unstake_delay_sec=1800`。
- PASS：`hellotoworld@active` 执行 `flon::unregprod`，交易 `73d9c56c59e2ae00c5ef8d2b46375ba54da6902c3b22cbfe203d0ccf737bd1c9`。随后链上 `is_active=0`、producer key 清空；状态验证锚点 head `21786094` 已由 LIB `21786095` 覆盖。
- PASS：注销不可逆后执行 `flon::unstakebp` 全额退出 `500000.00000000 FLON`，交易 `19f6ffedec59ac36df96f4f981ce4fe778ffc27eaf915e49f74f90d8903d97a7`。链上 `bpstakes.staked=0`，生成同额 `bpstkrefund`，`available_at=2026-10-29T07:57:34`（北京时间 15:57:34）；状态验证锚点 head `21786127` 已由 LIB `21786127` 覆盖。
- PASS：30 分钟门槛后执行 `flon::claimbpstake`，交易 `2607752514ec1beb98b894b67c89085c4fac3e39467c6d06a21fab3310224367`。trace 显示 `flon.stake` 向 `hellotoworld` 精确转账 `500000.00000000 FLON`；账户余额由 `490654.34407317` 增至 `990654.34205427 FLON`，净增与本金扣除交易 GAS 一致。退款行已删除，状态验证锚点 head `21786319` 已由 LIB `21786319` 覆盖。
- PASS：重复调用 `claimbpstake` 被 `BP self-stake refund not found` 拒绝，失败交易 ID `b0dab06da7a23f180ec88c2636b60419c0f794fbce253ca0833b61f462359334`。BP 注销、全额 unstake、30 分钟门槛、到账、退款行删除和重复领取拒绝闭环完成。证据摘要见 `artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/bp-full-unstake-hellotoworld-20261029/summary.md`。

### 2026-10-29 Epoch 798 逐 slot 独立重算

- FAIL（发布阻断）：按不可逆区块头及每块隐式 `flon::onblock` trace 独立重算，Epoch 798 范围内共有 303 个已生产区块，且每个 onblock payload 均与前一不可逆区块头吻合；链上 `bpstats.produced_blocks` 合计仅 302。
- 差异为 `bpflowtest11` 实际 57、表内 56；其余三名 BP 实际生产数与表内一致。链表同时给 `miner2222222` 多记 1 个 miss。总 slot 仍满足 `expected + idle_skipped = 7200`，逐行仍满足 `expected = produced + missed`，但生产者归属不满足独立证据。
- 差异集中在 Epoch 内 schedule version `4 -> 5` 切换附近。必须解释或修复 schedule 切换时的 slot resolver/统计归属，并在包含 Active schedule 变化的新自然 Epoch 复测通过，方可解除门禁。证据见 `artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/epoch798-slot-recompute-20261029/summary.md`。
- ROOT CAUSE / LOCAL PASS：Core v2 的旧逻辑把 head-state slot resolver 同时用于空 slot 与已提交区块；IF proposer-policy 切换边界缺少完整历史 policy 时，resolver 将一个实际由 `bpflowtest11` 提交的区块解析给 `miner2222222`，真实区块因 producer 不匹配被转成 miss。补丁仅修改 v2：空 slot 继续由 resolver 归属，唯一 produced slot 以共识已接受区块头的 `actual_producer` 为权威；v0 保持不变。
- PASS（补丁模型回放）：用新规则回放同一不可逆证据后，`bpflowtest11.produced=57`、`miner2222222` 多出的 1 个 miss 被移除，区块头/onblock 与统计 produced 总数均为 303，且 `expected + idle_skipped = 7200` 不变。Core 的 `eosio_chain` 编译成功；5 个 v2/transition 专项用例共 29 个断言全部通过，包括新增 stale-resolver 回归用例。
- INFO：仓库全量 monolithic `unit_test` 仍被既有 `block_tests.cpp` 编译错误阻断（`tester`/`legacy_tester` 无 `head_block_num()`）；完整八用例运行还暴露一个既有 v0 schedule 覆盖断言，v0 源码未被本补丁修改。这两项不归因于本次 v2 修复，但应另行清理。
- WAIT / 发布阻断仍未解除：Epoch 798 已封存，链上旧表不可改。必须将修复后的 Core 部署到测试网节点，并在新的自然 Epoch 发生 Active schedule 切换后，重新执行不可逆区块头 + onblock trace + `bpstats` 三方逐 slot 核算。当前只完成源码修复、历史回放与本地专项测试，未自动重启或部署节点。

### 2026-10-30 Epoch 838 只读异常复查

- 链 ID 核对通过；采集时 head/LIB 为 `21791674/21791673`。此前 TLS 失败由本地 HTTP 代理链路造成，使用 `NO_PROXY=t4.flon.network` 直连后 RPC 正常，测试网网关故障判断撤销。
- FAIL（发布阻断）：`get_producer_schedule` 显示 Active schedule version `7` 仅有 `bpflowtest11` 一席；Epoch 838 同样记录 `active_bp_count=1`，当前 `bpflowtest11` 为 `expected=313 / produced=313 / missed=0 / idle_skipped=6887`。这与 Epoch 815/816/817 已验证的 21 席状态相比发生了实质性退化。
- ROOT CAUSE（链上状态）：链上 `producers` 表仍有 25 名 `is_active=1` 且自质押满足门槛，但除 `bpflowtest11.total_votes=100000000` 外其余 producer 票数均为 0。`hellotoworld` 当前 `voters.votes=100000000`，且 `voteallocs` 仅把全部票投给 `bpflowtest11`；其他有治理票的 voter 均没有 producer allocation。因而 schedule version 7 缩为一席是当前投票分配的确定性结果，并非候选注册或自质押过滤错误。
- WAIT：需确认这是否为 active/standby 切换测试的预期中间态；若是，应按既定 21 BP 清单恢复多席投票并等待自然 schedule/epoch 生效，再完成逐 slot 独立复测。恢复前不得宣告可发布主网。
- 快照证据：`artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/heartbeat-20261030T0136Z/`。本轮仅只读采集，未提交交易、未修改 Epoch/治理配置、未重启节点。

### 2026-10-30 FullOn Core v0.9.1 Active/Standby 与 slot resolver 复测

- PASS：测试链 ID 与节点版本分别核对为 `18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f`、`v0.9.1-aaf6b7c3a81e6d818fd0b224c82a6769d7999428`。未触碰主网、未调用 `closeepoch`、未修改 Epoch 配置、未重启节点。
- PASS：`hellotoworld` 将精确 `100000000` 票权从单席 `bpflowtest11` 恢复分配至原 21 席；前 16 席各 `4761905`、后 5 席各 `4761904`，合计严格为 `100000000`。交易 `c0a6707ac510d8b592c0b9798a947200b155d78e3e9b2a31453c31b8050a8d0f`，区块 `21791954`，已由 LIB 确认。
- PASS：Epoch 839 在 schedule v7 下以 `bpflowtest11` 单席自然封存，统计 `303/303`、零 miss；Epoch 840 内 Active schedule 自然切换为 v8 的原 21 席。封存后 `pendingvote/pendallocs/votedeltas` 均已消费，`voteallocs`、`voters.producers` 和 21 席 `total_votes` 与请求逐项精确一致，`bpflowtest11.total_votes=0` 且已退出 Active schedule。Active/Standby 专项闭环通过。
- PASS（逐 slot 独立门禁）：Epoch 840 范围 `[1693285638,1693292837]` 共 7200 slots，独立读取不可逆区块 `21791964..21792268` 得到 305 个 produced header；每个 header 均与下一不可逆区块 trace 的隐式 `flon::onblock` 二进制载荷吻合，缺失/不匹配均为 0。逐 producer header 数与链上 `bpstats.produced_blocks` 的 22 行完全一致，总计 `305 produced + 0 missed + 6895 idle = 7200`。
- PASS：历史空 slot 的 proposer-policy 生效边界为 slot `1693287397`（v7 区块 `21792038`）；该区块头独立携带 `new_producer_schedule.version=8` 及精确 21 席 policy，并非根据 `bpstats` 循环反推。它比首个 v8 已提交区块 slot `1693287445` 早 48 slots。空 slot 按该 policy 边界解析、produced slot 按已提交区块头 producer 解析后，22 名 producer 的 `expected/produced/missed/idle_skipped` 全部逐行精确匹配，score 0。Epoch 798 的“真实 produced 少记一块并转成他人 miss”未复现，slot resolver 发布阻断项解除。
- 证据：`artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/v091-active-standby-restore-20261030/` 与 `v091-epoch840-slot-recompute-20261030/`。

### 2026-10-28 18:00 UTC 只读复查

- 测试链 ID 核对通过；head/LIB 为 `21782084/21782054`。快照见 `artifacts/testnet-e2e/testnet-e2e-20261027T033545Z/live-check-20261028T1800Z/`。
- `flon::global.last_producer_schedule_size` 已变为 21，`hellotoworld` 的 `voters.votes` 已变为 `9300 FLON`；这表明此前“三席、旧票数”的观察已不再代表当前链状态，但尚不能证明 Epoch 770 的待生效票被正确消费。
- `rewardepoch.next_epoch_to_close=807`，而 `pendingvote` 仍有四行，`activation_epoch=799`，包括 `hellotoworld`。这些行已跨过多个自然封存 Epoch，待查其是否为重复生成、清理失败或正常队列语义；在定位前仍按发布阻断处理。此轮未提交交易、未修改配置。

1. 提案 #3：execute 和 Treasury grant/预留核对已通过，交易已不可逆。
2. Reward Epoch 769 的生产统计已通过；GAS settlement 尚未就绪，且 BP claim 干扰了 before/after 奖励增量基线，需在后续完整 Epoch 重做无 claim 干扰的严格奖励核算。
3. PASS：新版 `flon.system` 下 Epoch 815 自然封存后，新增投票的 `pendingvote` 被消费，精确票数与 21 席 Active schedule 均核对通过。旧 pendingvote 发布阻断项解除。
4. voter refund 72 小时正向领取与重复领取拒绝已通过，正向交易已不可逆。
5. PASS：BP unstake 延迟为 30 分钟；注销 BP、全额 `500000 FLON` unstake、门槛后领取到账、退款行删除及重复领取拒绝均已完成，正向交易已不可逆。

## 5. 发布门禁

当前不得宣告“可发布主网”。只有第 4 节的核心治理执行闭环、Epoch 奖励核算及 voter refund 完成且无账务差异，才可给出主网发布建议。
