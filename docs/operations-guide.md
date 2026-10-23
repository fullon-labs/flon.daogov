# DAO Governance 链上日常维护操作指南

本文面向 FullOn 网络运营人员、Block Producer（BP）和自动化 Keeper，说明 DAO Governance 上线后需要持续执行的链上维护交易。

这里有两类职责不同的交易：

| Action | 谁提交 | 周期 | 主要作用 |
| --- | --- | --- | --- |
| `flon::closeepoch` | 公共 Keeper；任何账户均可触发 | 每个基础奖励 epoch 结束后 | 结算 BP/Voter 基础奖励、绩效状态和下一 epoch 票权 |
| `flon::standbyproof` | 每个 Standby BP 本人或其专用授权机器人 | 当前 GAS epoch 内定期提交 | 证明该 Standby BP 持续在线并取得当期 GAS Standby 奖励资格 |

两者不能互相代替。公共 Keeper 不应持有 Standby BP 的 `active` 私钥；Standby BP 也不能假设公共 Keeper 会替自己提交在线证明。

## 1. 通用安全规则

每次构造交易前必须完成以下只读检查：

1. RPC 返回的 chain ID 与目标网络配置完全一致；
2. 链头和 Last Irreversible Block（LIB）持续推进；
3. action、账户、permission 和 epoch ID 属于目标网络；
4. 钱包已经解锁正确网络的专用签名权限；
5. 发送前重新读取链上表，不依赖本地缓存或上一次运行结果；
6. 发送后等待不可逆，并通过链上表验证业务状态变化。

交易已签名、已广播、RPC 返回 HTTP 200 或已进入可逆区块，都不能单独作为维护任务完成的证明。

主网和测试网必须使用独立配置、钱包和告警通道。自动化程序应把允许的 chain ID 写入只读配置，并在不匹配时立即停止。

## 2. 基础奖励 epoch：`closeepoch`

### 2.1 为什么需要 Keeper

`closeepoch` 不由 `onblock` 自动执行。`onblock` 只累计逐块奖励和确定性出块统计；完整 epoch 结算包含 BP 绩效判定、状态表扫描、Voter 分享池划拨、inline action 和下一 epoch 票权激活。如果把这些工作放入每块必经的 `onblock`，CPU 超限、转账失败或异常数据可能阻塞共识出块。

因此，协议采用链下 Keeper 发起、链上确定性验证的 permissionless 模式。Keeper 只负责触发，不能修改结算结果。

### 2.2 执行频率

基础奖励 epoch 固定为 6 小时。推荐参数：

| 项目 | 推荐值 |
| --- | --- |
| 常态检查 | 距边界超过 30 分钟时每 15 分钟 |
| 边界预热 | 距边界 30–10 分钟时每 5 分钟 |
| 边界窗口 | 距边界不足 10 分钟，直到成功关闭前每 1 分钟 |
| 正常提交 | epoch 边界后 1–5 分钟 |
| 延迟告警 | 边界后 15 分钟仍未关闭 |
| 严重告警 | 落后一个完整 epoch，即约 6 小时 |
| Keeper 高可用 | 1 个主 Keeper，至少 2 个独立备用监控/补单 Keeper |

查询当前待关闭 epoch：

```bash
fucli -u "$RPC_URL" get info
fucli -u "$RPC_URL" get table flon flon rewardepoch
```

只在 `rewardepoch.next_epoch_to_close` 对应 epoch 已经结束时提交：

```bash
fucli -u "$RPC_URL" push action flon closeepoch \
  '[<NEXT_EPOCH_TO_CLOSE>]'
```

`closeepoch` 是 permissionless action，不应要求公共 Keeper 使用系统账户权限。提交后等待不可逆，再次读取 `rewardepoch`；只有 `next_epoch_to_close` 恰好增加 1 才算成功。

### 2.3 错过一次或多次

错过执行不会销毁奖励。对应 epoch 的 BP 基础奖励和 Voter 分享数据仍保留，可以稍后结算。但是延迟期间：

- BP 和 Voter 尚不能领取该部分奖励；
- `pendingvote` / `votedeltas` 的下一 epoch 票权变化不能及时生效；
- BP 绩效、停权、恢复结果以及 Active schedule 变化会延迟；
- 未结算数据继续占用链上 RAM；
- DApp 会持续显示“待结算”或“待生效”。

如果积压多个 epoch，必须严格串行追赶：

1. 读取链上的 `next_epoch_to_close`；
2. 只提交该 epoch 的 `closeepoch`；
3. 等待不可逆并确认链上值增加 1；
4. 重新读取状态；
5. 如果新的 `next_epoch_to_close` 也已结束，再处理下一笔。

不能跳号、不能并发关闭多个 epoch，也不要预签一批固定 epoch ID。两名 Keeper 同时提交相同 epoch 时，后到交易通常会被 `reward epochs must be closed sequentially` 拒绝。该拒绝不会破坏状态，但会浪费资源并产生无效告警。

每次 action 只结算一个 epoch；积压不会自动合并为一笔大交易。因此通常可以安全地逐个追赶，奖励不会丢失。若单个 epoch 因 BP/奖励行过多出现 CPU 或 NET 超限，应停止盲目重试，保存错误、交易 ID 和相关表状态，并评估将结算升级为有界、可续跑的状态机。

### 2.4 Keeper 自动化

```text
根据链上时间计算下一边界
  ├─ 距边界 > 30 分钟：每 15 分钟校准一次
  ├─ 距边界 30–10 分钟：每 5 分钟检查一次
  └─ 距边界 < 10 分钟或已有积压：每 1 分钟检查
       ├─ chain ID 不匹配 / 链未同步：停止并告警
       ├─ next_epoch_to_close 尚未结束：等待下一轮
       └─ epoch 已结束：提交 closeepoch(next_epoch_to_close)
       ├─ 等待不可逆
       ├─ 验证 next_epoch_to_close == 原值 + 1
       └─ 如果仍有积压，串行处理下一 epoch
```

进程启动、重启或网络恢复时应立即完成一次全量检查，再进入自适应周期。链头/LIB、节点进程和 P2P 健康监控可以独立保持较高频率，但不需要因此每分钟查询或提交 `closeepoch`。

自动化必须使用“读链后决定”，不能简单设置成每 6 小时无条件广播一笔交易。

## 3. Standby 在线证明：`standbyproof`

### 3.1 谁负责提交

`standbyproof` 要求 `require_auth(owner)`，所以必须由该 Standby BP 自己提交，或由该 BP 明确授权的在线证明机器人提交。

推荐为机器人创建只允许调用 `flon::standbyproof` 的专用 permission，不要把 BP 的 owner/active 私钥交给基金会、公共 Keeper 或第三方监控服务。公共 Keeper 可以监控和提醒，但不能无授权地代交证明。

只有当前 GAS epoch 快照中角色为 Standby 的节点可以证明。Active BP、普通 Candidate、已暂停节点或不在本 epoch 快照内的账户提交都会被链上拒绝。

### 3.2 默认频率和时间窗口

当前默认 GAS 参数为：

| 参数 | 默认值 | 含义 |
| --- | ---: | --- |
| `epoch_slots` | 43,200 slots | 约 6 小时 |
| `standby_min_proofs` | 12 | 当期获得 Standby GAS 奖励资格需要的证明数 |
| 最小证明间隔 | `epoch_slots / standby_min_proofs` | 默认 3,600 slots，约 30 分钟 |
| proof 区块有效窗口 | 最近 240 块 | 按 0.5 秒出块约为最近 2 分钟 |

这些是链上默认值，DApp 和机器人必须优先读取当前 epoch 的 `gasepochcfg`，不能永久写死。

推荐执行节奏：

- GAS epoch 开始后 1–5 分钟提交第一次；
- 之后每 31–32 分钟提交一次，为区块时间和任务调度留出余量；
- 每次提交前重新读取 `gasnodestats`；
- 达到 `standby_min_proofs` 后立即停止该 epoch 的任务；
- epoch 切换后重新读取新快照，确认自己仍是 Standby，再从 0 开始。

12 次证明之间至少需要 11 个最小间隔，默认约 5.5 小时。因此第一次证明必须尽早提交；如果超过 epoch 开始约 30 分钟才提交，通常已无法在 6 小时结束前完成 12 次。

### 3.3 构造证明

先读取当前 GAS epoch 配置和本节点状态：

```bash
fucli -u "$RPC_URL" get table flon flon gasepochcfg
fucli -u "$RPC_URL" get table flon <CURRENT_GAS_EPOCH_ID> gasnodestats
fucli -u "$RPC_URL" get info
```

证明应引用最近的 canonical block。运营上推荐使用最新 LIB 的 block number 和 block ID，且必须保证它距离当前链头不超过 240 块。

```bash
fucli -u "$RPC_URL" push action flon standbyproof \
  '["<STANDBY_BP>",<CURRENT_GAS_EPOCH_ID>,<BLOCK_NUM>,"<BLOCK_ID>"]' \
  -p <STANDBY_BP>@<PROOF_PERMISSION>
```

提交后等待不可逆，并验证对应 `gasnodestats` 行：

- `standby_proofs` 增加 1；
- `last_proof_slot` 更新；
- `last_proof_block` 等于本次引用区块；
- 达到门限后，后续结算能够把该 Standby 标记为奖励合格。

### 3.4 错过证明的后果

| 情况 | 结果 |
| --- | --- |
| 偶尔延迟几分钟 | 通常可继续，但必须仍满足最小间隔和剩余时间要求 |
| 错过一次 | 不能立即连发两笔补回；过早提交会报 `standby proof submitted too soon` |
| 重复同一区块 | 被 `duplicate proof block` 拒绝 |
| proof 区块超过 240 块或非 canonical | 被 `proof block is not recent` 或 `proof block id is not canonical` 拒绝 |
| 使用旧/未来 epoch | 被 `proof must target the current epoch` 拒绝 |
| 已达到门限后继续提交 | 被 `standby proof threshold already reached` 拒绝 |
| epoch 结束时未达到最低次数 | 失去该 GAS epoch 的 Standby 在线服务奖励资格 |

旧 epoch 的证明不能在新 epoch 补交，未完成次数也不能结转。错过当期证明不会直接取消 Candidate 注册、投票或 Standby 排名，不会自动扣除自有质押，也不会永久禁止下一个 epoch 参与；主要影响是失去当期 GAS Standby 奖励和对应在线证明记录。

下一 epoch 开始后，节点必须重新确认自己的快照角色。如果仍为 Standby，可以重新从 0 开始完成当期证明。

### 3.5 Standby proof agent 自动化

```text
每分钟读取当前 GAS epoch 和本节点 gasnodestats
  ├─ 本节点不是当前 epoch 的 Standby：不提交
  ├─ standby_proofs 已达到门限：停止本 epoch
  ├─ 距上次 proof 不足最小间隔：等待
  └─ 条件满足：
       读取最近 LIB block number / block ID
       验证区块距链头不超过 240 块
       提交 standbyproof
       等待不可逆
       验证 standby_proofs 增加 1
```

机器人必须记录 epoch ID、引用区块、交易 ID、入块高度、不可逆高度和失败原因。签名或广播结果不明确时，应先查询链上 `last_proof_block`，不能盲目重发。

## 4. DApp 在线说明要求

DAO Governance DApp 应分别为 Keeper 和 Standby BP 展示以下信息：

### Keeper 面板

- 当前基础奖励 epoch 与 `next_epoch_to_close`；
- 最近一次成功关闭时间和交易 ID；
- 是否存在积压及积压数量；
- “尚未结束 / 可以关闭 / 等待不可逆 / 已积压 / 执行失败”状态；
- 严格按顺序追赶的说明和告警。

### Standby BP 面板

- 当前 GAS epoch 和节点快照角色；
- 当期已提交次数 / 所需次数；
- 下次最早可提交时间；
- 当前 epoch 剩余时间；
- 按剩余时间计算是否仍可能达到门限；
- 最近 proof 区块和交易状态；
- 错过当期只影响 GAS Standby 奖励、不自动取消排名的明确说明。

DApp 可以帮助构造和解释交易，但不能托管 BP 私钥，也不能在用户不知情时自动使用钱包权限签名。无人值守 proof agent 应作为 BP 自主管理的独立服务部署，并使用最小权限密钥。

## 5. 基础奖励与 GAS 奖励是独立状态机

基础奖励 epoch 从 `reward_epoch_start` 开始编号；GAS epoch 使用绝对 block slot 与 `epoch_slots` 计算。两套 epoch ID、表和结算流程互不等价：

- `closeepoch` 处理基础挖矿奖励、Voter 分享、BP 绩效和待生效票权；
- `standbyproof` 只记录当前 GAS epoch 的 Standby 在线证明；
- GAS 奖励还需要独立执行 `beginsettle`、分批 `settlenext` 和 `finalizeepoch`；
- 完成基础 `closeepoch` 不代表 GAS epoch 已结算；
- 完成 `standbyproof` 也不代表奖励已进入 `gas.reward` 待领取账本。

监控、告警和运维脚本必须把两套状态机分别实现，严禁混用 epoch ID。
