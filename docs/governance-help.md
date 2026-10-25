# FullOn DAO 用户帮助

## 治理资产

用户使用 FLON 参与节点投票，并获得等额、不可转让的 GLON。GLON 是治理权凭证，不是支付代币。发起提案、附议和投票只检查治理权，不会把 GLON 转入 `dao.gov`，也不会消耗 GLON。

## 节点投票与 Epoch

- 用户最多选择 30 个 BP，并为每个 BP 分别分配 FLON。
- 所有分配之和不能超过账户持有的可用 FLON 与已锁定投票本金。
- 投票变更先进入 pending 状态，在下一 Epoch 边界生效。
- Epoch 用于确定 BP 排名、治理快照、出块绩效和奖励归属。

## DAO 提案流程

1. 提案人满足最低 GLON 治理权并创建提案。
2. 达到附议数量和附议门槛。
3. `activate` 冻结治理权快照并确定投票窗口。
4. 用户以快照时的 GLON 对提案投赞成、反对或弃权票。
5. `finalize` 检查 quorum 与通过比例。
6. 可执行提案通过后由 `queue` 进入 Timelock。
7. Timelock 到期后，任何账户都可以调用 `execute`。

`activate`、`finalize`、`queue`、`execute` 和 `expire` 都是 permissionless 操作。触发账户不能修改创建提案时已经冻结的 action。

## 奖励领取

奖励不会主动空投。链上完成结算后，未领取余额可以跨 Epoch 累积。

- Voter：受益账户本人调用 `voter.reward::claimrewards`。
- BP：调用 `flon::claimrewards(caller, producer, max_steps)`。
- BP 奖励允许第三方代为触发，但收款人始终是 `producer`，触发者不能截留或更改奖励。

## epoch.keeper 与容错

`epoch.keeper` 对应的 Keeper 程序会定期触发 Epoch 关闭、BP 奖励领取等 permissionless 操作。Keeper：

- 不持有 BP 的出块或账户私钥；
- 不托管任何奖励；
- 不能修改奖励收款账户；
- 不是共识或奖励系统的单点依赖。

如果 Keeper 下线，BP 本人或任何其他用户仍可从 DApp 手动触发 `flon::claimrewards`。奖励会直接进入链上记录的 BP 账户。

## 安全检查

签名前必须核对网络、Chain ID、签名账户、合约、action、参数和实际收款人。DApp 的帮助说明不是交易授权，最终以钱包确认页展示并签名的交易内容为准。
