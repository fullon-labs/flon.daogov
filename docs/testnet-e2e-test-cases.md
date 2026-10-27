# FLON 测试网端到端测试用例

## A. 安全预检

| ID | 场景 | 预期 |
|---|---|---|
| SAFE-01 | 正确测试网 `preflight` | chain ID 精确匹配，保存 ABI/表快照 |
| SAFE-02 | RPC 指向其他链 | 签名前拒绝 |
| SAFE-03 | 本地 wallet 锁定 | 拒绝，不导入 key |
| SAFE-04 | 写命令无 `--broadcast` | 拒绝，无交易 |
| SAFE-05 | 缺少 mutation ACK | 拒绝，无交易 |

## B. BP 自质押、注册与竞选

| ID | 场景 | 预期 |
|---|---|---|
| BP-01 | stake 低于 `min_self_stake` 后注册 | 注册拒绝 |
| BP-02 | 达到门槛 `stakebp` | FLON 扣减，`bpstakes` 增加；不计为 voter stake |
| BP-03 | 再次增加质押 | 数量累加、余额守恒 |
| BP-04 | 无效 key/URL/location/share | 分项拒绝 |
| BP-05 | 正常 `regproducer` | producer key、URL、location、share 准确 |
| BP-06 | 投票后跨 Epoch | total_votes 更新，按规则成为 Active/Standby |
| BP-07 | Active 实际出块 | schedule、节点日志和 slot stats 一致 |
| BP-08 | BP 自投 | 允许；报告中与社区支持分开展示 |
| BP-09 | `unregprod` | `is_active=0`，后续 schedule 移除 |
| BP-10 | active 状态 unstake | 拒绝或不得低于门槛 |
| BP-11 | 退出后 `unstakebp` | 创建 `bpstkrefund`，不立即到账 |
| BP-12 | `cancelbpref` | refund 删除，金额回到 self-stake |
| BP-13 | 21 天前 `claimbpstake` | 拒绝 |
| BP-14 | 到期领取 | FLON 到账、refund 删除、重复领取拒绝 |
| BP-15 | `resumeprod` | 条件满足时恢复；不满足时精确拒绝 |
| BP-16 | 第三方 `claimrewards` | permissionless 触发，款项只到正确受益方 |

```bash
scripts/testnet-e2e.sh bp-stake --env /tmp/flon-testnet-e2e.env --broadcast
scripts/testnet-e2e.sh bp-register --env /tmp/flon-testnet-e2e.env --broadcast
scripts/testnet-e2e.sh bp-unregister --env /tmp/flon-testnet-e2e.env --broadcast
scripts/testnet-e2e.sh bp-unstake --env /tmp/flon-testnet-e2e.env --broadcast
scripts/testnet-e2e.sh bp-claim-refund --env /tmp/flon-testnet-e2e.env --broadcast
```

## C. 节点投票、撤票与赎回

| ID | 场景 | 预期 |
|---|---|---|
| VOTE-01 | addvote 超余额 | 拒绝 |
| VOTE-02 | 正常 `addvote` | FLON 托管、铸造等额 GLON、DAO power 自动同步 |
| VOTE-03 | A=20、B=30、C=50 | `votealloc` 成功，合计等于 locked stake |
| VOTE-04 | allocations 总额不等 | 拒绝 |
| VOTE-05 | 重复或未按账户名排序 | 拒绝 |
| VOTE-06 | 0/负数/超过 30 个 | 拒绝 |
| VOTE-07 | 未注册或 inactive producer | 拒绝 |
| VOTE-08 | 重复相同分配 | no-op 拒绝 |
| VOTE-09 | 下一自然 Epoch | pending 被消费，allocations/producer votes 精确更新 |
| VOTE-10 | 部分 `subvote` | 等额 GLON 销毁、power 降低、生成 refund |
| VOTE-11 | 第二笔未结退款 | 再次 subvote 拒绝 |
| VOTE-12 | 72 小时前 `voterefund` | 拒绝 |
| VOTE-13 | 到期赎回 | FLON 返回 owner，退款记录删除 |

```bash
scripts/testnet-e2e.sh vote-add --env /tmp/flon-testnet-e2e.env --broadcast
scripts/testnet-e2e.sh vote-allocate --env /tmp/flon-testnet-e2e.env --broadcast
scripts/testnet-e2e.sh vote-sub --env /tmp/flon-testnet-e2e.env --broadcast
scripts/testnet-e2e.sh vote-refund --env /tmp/flon-testnet-e2e.env --broadcast
```

## D. DAO 信号提案

| ID | 场景 | 预期 |
|---|---|---|
| DAO-01 | power 低于门槛 propose | 拒绝 |
| DAO-02 | signal propose | endorsement 状态，actions 为空 |
| DAO-03 | setforum | 仅 proposer 且 endorsement 阶段成功 |
| DAO-04 | 低门槛/重复 endorse | 拒绝 |
| DAO-05 | 合法 endorse | count/power 准确 |
| DAO-06 | 过早/到期 activate | 前者拒绝；后者任意 executor 成功 |
| DAO-07 | 激活快照 | total power、个人 power、policy sequence 冻结 |
| DAO-08 | delay 内 castvote | 拒绝 |
| DAO-09 | for/against/abstain | 分别累计；重复投票拒绝 |
| DAO-10 | 投票中 power 改变 | 不追溯改变已冻结权重 |
| DAO-11 | 过早/到期 finalize | 前者拒绝；后者 permissionless |
| DAO-12 | quorum/approval 边界 | 覆盖 defeated/succeeded |
| DAO-13 | cancel | 仅 proposer 在 endorsement 阶段允许 |

调用顺序：`dao-propose-signal` → `dao-set-forum` → `dao-endorse` → 等附议期 → `dao-activate` → 等延迟 → `dao-vote` → 等投票期 → `dao-finalize`。

## E. 带 action 的可执行提案

| ID | 场景 | 预期 |
|---|---|---|
| EXEC-01 | 未分类 action | propose 拒绝 |
| EXEC-02 | 未启用/不在 allowlist | 拒绝 |
| EXEC-03 | action 数、单个 bytes、总 bytes 越界 | 分项拒绝 |
| EXEC-04 | 合法 action | `abi_json_to_bin` 后原始 bytes 冻结 |
| EXEC-05 | 混合风险 | 采用最高 risk level |
| EXEC-06 | min total power 不足 | 拒绝；属于策略正常生效 |
| EXEC-07 | signal 携带 action / executable 无 action | 拒绝 |
| EXEC-08 | queue 非 succeeded executable | 拒绝 |
| EXEC-09 | Timelock 前 execute | 拒绝 |
| EXEC-10 | permissionless execute | 任意 executor 成功，副作用等于冻结 bytes |
| EXEC-11 | queue 后禁用 allowlist | execute 复检并拒绝 |
| EXEC-12 | 重复 execute | 拒绝，无重复副作用 |
| EXEC-13 | grace 后 execute/expire | execute 拒绝，expire 成功 |

```bash
scripts/testnet-e2e.sh dao-propose-action --env /tmp/flon-testnet-e2e.env --broadcast
# endorse -> activate -> vote -> finalize -> queue -> 等 Timelock -> execute
```

## F. Treasury 全功能

| ID | 场景 | 预期 |
|---|---|---|
| TR-01 | 支持资产入金 | liquid/total_received 与 token balance 增加 |
| TR-02 | 不支持资产入金 | 按合约规则拒绝且不记账 |
| TR-03 | 非 dao.gov 直接 reserve/pay/release | 权限拒绝 |
| TR-04 | 治理 reserve | liquid 减、reserved 增，grant 字段准确 |
| TR-05 | 超额 reserve | 拒绝，余额不变 |
| TR-06 | 治理 pay | recipient 收款；reserved/paid/count 准确 |
| TR-07 | memo hash 错、超额、超次数 | 拒绝，无资金变化 |
| TR-08 | 治理 release | 剩余 reserved 回 liquid |
| TR-09 | closegrant | 仅合法终态/过期成功，重复关闭拒绝 |
| TR-10 | 总账守恒 | liquid、reserved、paid、累计入金和 token balance 一致 |

`reserve/pay/release` 当前是 L3，而现有总治理权低于 L3 的 10,000 GLON 门槛。必须通过正常 `addvote` 增加真实 GLON power，不得用管理员临时 `setpower` 绕过。

## G. 共享测试网禁止自动执行

- 不可逆 `dao.gov::sealadmin`。
- 成功修改治理阈值、allowlist、risk policy、BP quorum/self-stake、GAS 参数。
- 故意制造大量 missed 触发 BP suspension。

这些成功路径放到合约单元测试或独立测试合约账户；共享测试网只验证当前配置及其拒绝路径。
