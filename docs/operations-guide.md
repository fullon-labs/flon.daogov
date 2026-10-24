# DAO Governance 链上日常维护操作指南

本文面向 FullOn 网络运营人员、Block Producer（BP）和自动化 Keeper。当前协议的 Epoch 封存由 `onblock` 有界状态机自动推进，不再依赖外部 `closeepoch`。

这里有两类职责不同的交易：

| Action | 谁提交 | 周期 | 主要作用 |
| --- | --- | --- | --- |
| `flon::claimrewards` | BP 本人或公共 Keeper 代触发 | 建议每小时检查；BP 可按天自行领取 | 同时领取该 BP 已封存的基础和 GAS 奖励 |
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

## 2. BP 奖励 Keeper：`claimrewards`

### 2.1 为什么仍保留 Keeper

Epoch 边界和奖励封存已经由 `onblock` 自动处理。Keeper 只帮助长期没有主动领取的 BP 发起 pull claim，不参与奖励计算，不能更改收款账户，也不持有 BP 私钥。

### 2.2 执行频率和安全边界

默认每小时扫描一次所有已注册且仍 active 的 BP。只有 `unclaimed_rewards`、`prodclaims` 或 `gasclaims` 存在可领取记录时才广播交易。每个 BP 独立调用：

```bash
fucli -u "$RPC_URL" push action flon claimrewards \
  '["<KEEPER>","<PRODUCER>",24]' -p <KEEPER>@claimer
```

`max_steps=24` 对应最多处理约一天的一小时奖励行；积压更多时会在后续周期继续领取。BP 即使按天自行领取也不会丢失奖励，不要求 Keeper 每小时必然在线。

Keeper 的专用 permission 必须只 link 到 `flon::claimrewards`。合约固定把资金转给 `producer`，`caller` 不能重定向资产。每笔交易等待 LIB 后才处理下一 BP；chain ID 不匹配、链头过旧或签名异常时停止本轮并告警。

本项目实现见 [`keeper/`](../keeper/README.md)。主网默认 dry-run；测试网可单独启用广播。

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

- 最近一次扫描时间、链头和 LIB；
- 当前检测到的可领取 BP；
- 最近一次代领取的 BP、交易 ID 和不可逆状态；
- dry-run / broadcast 模式及失败告警。

### Standby BP 面板

- 当前 GAS epoch 和节点快照角色；
- 当期已提交次数 / 所需次数；
- 下次最早可提交时间；
- 当前 epoch 剩余时间；
- 按剩余时间计算是否仍可能达到门限；
- 最近 proof 区块和交易状态；
- 错过当期只影响 GAS Standby 奖励、不自动取消排名的明确说明。

DApp 可以帮助构造和解释交易，但不能托管 BP 私钥，也不能在用户不知情时自动使用钱包权限签名。无人值守 proof agent 应作为 BP 自主管理的独立服务部署，并使用最小权限密钥。

## 5. 自动封存与主动领取

基础奖励和 GAS 奖励各自按链上配置记录，但封存与内部结算都由 `onblock` 有界推进。BP 最终通过同一个 `flon::claimrewards` 拉取两类奖励；`standbyproof` 仍只负责 Standby 在线证明。外部 Keeper 不再调用 `closeepoch`、`beginsettle`、`settlenext` 或 `finalizeepoch`。
