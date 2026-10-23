# flon.daogov

FullOn Network 治理中心 H5 DApp，可在 HuFu 内置浏览器中打开，也支持普通移动浏览器预览。

页面在手机端使用底部导航，在桌面端自动切换为侧栏和多栏布局。首次访问按浏览器首选语言选择中文或英文，用户也可在右上角手动切换，选择会保存在当前浏览器中。

## 功能范围

- BP 候选人注册、Active / Standby / Candidate 链上排名
- 不可转让 GLON 治理权及待生效节点分配展示
- 最多选择 30 个 BP，总票权平均分配并广播 `flon::voteproducer`
- 投票人奖励查询并广播 `voter.reward::claimrewards`
- BP 处罚状态查询及符合条件后的 `flon::resumeprod`
- HuFu 钱包连接、交易解释、签名请求和状态追踪
- PC / 手机响应式布局与浏览器语言自动识别（简体中文、英文）

当前版本已经把节点排名、钱包账户票权、节点选择、投票人待领奖励、BP 注册和 BP 恢复接到链上 RPC；对应确认页会展示实际 action，并由钱包签名广播。RPC 返回失败时界面显示错误，不回退到伪造数据。

尚未接入的功能会明确保持只读：DAO 提案/附议/投票/Timelock/执行需要确定 Governance V2 合约 ABI 和部署账户；FLON 加票/撤票需要确认生产网 `addvote` / `subvote` ABI 与资产精度；历史在线率和治理记录需要索引服务。界面不会为这些功能广播模拟交易。

## 开发

要求 Node.js 20+。

```bash
npm install
npm run dev
```

默认访问：

```text
http://127.0.0.1:4173
```

生产构建：

```bash
npm run build
npm run preview
```

生产环境通过 `/config.js` 注入链环境，不需要为主网和测试网分别编译前端。`deploy/app-host/` 包含两个容器实例的运行时配置，`deploy/edge-host/` 包含网关反向代理配置。

## 项目结构

```text
flon.daogov/
├── index.html                 H5 入口与页面结构
├── src/
│   ├── app.js                 页面交互、链上状态呈现与签名流程
│   ├── wallet.js              RPC、HuFu / Anchor 钱包与交易适配
│   └── styles.css             HuFu 移动端视觉实现
├── public/assets/fonts/       自托管字体
└── docs/governance-design.md  产品、合约与实施设计
```

## 后续工程化边界

- `src/chain/`：FLON RPC、ABI、表读取与交易构造
- `src/wallet/`：HuFu H5 Bridge 和外部钱包适配
- `src/features/nodes/`：BP 注册、排名、投票和奖励
- `src/features/governance/`：提案、附议、投票与执行
- `src/services/indexer/`：历史 Epoch、在线率与提案检索

私钥必须留在 HuFu 钱包。DApp 只构造交易并请求签名，不保存助记词或私钥。

## 钱包连接

- HuFu 内嵌 iframe：使用 `@fullon/flonjs` Client 读取当前账户
- HuFu App/WebView：使用注入的 `window.HuFu` Provider 请求账户
- 普通浏览器：使用 Anchor Link 和 HuFu 转发服务展示二维码
- 会话按主网、测试网分别存储，恢复时校验 Chain ID
- 断开连接会清除本地会话；DApp 不读取或保存私钥

## 文档

[治理中心产品与实施设计](./docs/governance-design.md)

[链上日常维护操作指南：closeepoch 与 standbyproof](./docs/operations-guide.md)
