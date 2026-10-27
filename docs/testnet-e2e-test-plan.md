# FLON 测试网 BP、投票与 DAO 治理端到端测试计划

## 1. 目标与强制边界

验证 BP 保证金、注册、竞选、节点投票、撤票与赎回，以及 `dao.gov`、`dao.treasury` 包含链上 action 的治理闭环。

- 只允许链 ID `18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f`。
- 所有签名来自本机 `fuwal`；脚本不读取、导入或输出私钥。
- 默认只预检。写交易必须同时使用 `--broadcast` 和确认变量。
- 不修改 Epoch 时长；跨 Epoch、72 小时 voter refund、21 天 BP unstake 按真实时间分阶段执行。
- 共享测试网不执行不可逆 `sealadmin`，不随意修改全局治理、BP 或 GAS 参数。

## 2. 当前测试网基线（2026-10-27 只读核验）

| 项目 | 当前值 |
|---|---|
| RPC | `https://t4.flon.network` |
| BP 最低自质押 / 解锁期 | `500,000 FLON` / 21 天 |
| 提案 / 附议门槛 | `100 GLON` / `1 GLON` |
| 附议期 / 投票延迟 / 投票期 | 5 分钟 / 1 分钟 / 5 分钟 |
| 默认 quorum / 通过门槛 | 10% / 50% |
| Timelock / 执行宽限期 | 5 分钟 / 24 小时 |
| action 限制 | 最多 10 个；单个 4096 bytes；合计 16384 bytes |
| 治理总票权 | `6,799 GLON` |

执行提案还要应用 L1–L4 风险策略，混合 actions 取最高风险。L3/L4 当前最低总票权为 10,000/50,000 GLON；在当前 6,799 GLON 下被拒绝是预期策略结果。

## 3. 测试角色

- BP candidate：拥有最低自质押 FLON 和独立 block signing public key。
- Voter：拥有投票本金；`addvote` 后获得等额不可转让 GLON。
- Proposer、Endorser、DAO voters：分别满足风险策略门槛，投票账户覆盖 for/against/abstain。
- Executor：任意测试账户，用于证明生命周期 action permissionless。
- Treasury recipient：接收最小额测试付款。

BP block signing key 不得用作账户 owner/active key。建议使用可丢弃测试账户，并在执行前记录余额与权限。

## 4. 执行阶段

1. **T0 预检**：链 ID、RPC、ABI、本地钱包、账户权限、余额、配置、白名单、风险策略和 treasury。
2. **T1 BP 准入**：低于门槛失败 → 自质押 → 注册 → 表校验。
3. **T2 投票竞选**：增加本金 → 自定义分配 → 等自然 Epoch → 排名、Active/Standby、schedule 校验。
4. **T3 奖励退出**：claim rewards、unregister、unstake、取消退款、再次 unstake、到期领取。
5. **T4 Voter 撤票**：减少本金、销毁 GLON、重新分配、到期退款。
6. **T5 信号提案**：提案、论坛、附议、激活、快照、投票、结算、取消。
7. **T6 可执行提案**：ABI 编码、白名单/风险、action 冻结、queue、Timelock、permissionless execute、expire。
8. **T7 Treasury**：入金、reserve、pay、release、closegrant 与账务守恒。
9. **T8 回归**：LIB、余额、表状态、重复调用、错误分支与 DApp 展示。

## 5. 通过标准与证据

每个写交易保存 action/actor、transaction ID、包含区块、LIB 时间、执行前后快照和精确错误。满足以下条件才算通过：

- 交易达到 LIB；仅返回 submitted 不算完成。
- FLON/GLON、BP stake/refund、treasury liquid/reserved/paid 守恒。
- Epoch 边界前后 `pendingvote/votedeltas/voteallocs/producers` 一致。
- DAO power/policy 在激活时冻结，之后 add/sub vote 不追溯改变该提案权重。
- action bytes、风险等级和权限冻结；执行结果严格等于冻结内容。
- 负向用例断言具体合约错误，不只判断非零退出码。

## 6. 使用测试脚本

```bash
cd /Users/ray/work/flon/flon.daogov
cp scripts/testnet-e2e.env.example /tmp/flon-testnet-e2e.env
# 编辑 /tmp 文件，只填测试账户、public key 和数量；不要写私钥。
scripts/testnet-e2e.sh preflight --env /tmp/flon-testnet-e2e.env

export TESTNET_MUTATION_ACK=I_UNDERSTAND_TESTNET_STATE_WILL_CHANGE
scripts/testnet-e2e.sh bp-stake --env /tmp/flon-testnet-e2e.env --broadcast
```

脚本按阶段运行，不会伪造时间或自动跨越等待期。证据写入 `artifacts/testnet-e2e/<UTC run id>/`。详细步骤见 [测试用例](./testnet-e2e-test-cases.md)。

