# flon.daogov

FullOn Network DAO治理 H5 DApp，可在 HuFu 内置浏览器中打开，也支持普通移动浏览器预览。

页面在手机端使用底部导航，在桌面端自动切换为侧栏和多栏布局。首次访问按浏览器首选语言自动选择界面语言，用户也可从顶部语言菜单切换 English、Français、日本語、한국어、Español、简体中文或繁體中文，选择会保存在当前浏览器中。

## 功能范围

- BP 候选人注册、Active / Standby / Candidate 链上排名
- 不可转让 GLON 治理权及待生效节点分配展示
- 最多选择 30 个 BP，为每个 BP 指定 FLON 票数并批量广播 `flon::votealloc`；分配合计不得超过已锁定投票本金
- 投票人奖励查询并广播 `voter.reward::claimrewards`
- BP 本人或第三方代 BP 查询并广播 `flon::claimrewards(caller, producer, max_steps)`；奖励始终直接支付给 BP
- BP 处罚状态查询及符合条件后的 `flon::resumeprod`
- 从 `dao.gov` 实时读取配置、治理权、提案、附议和选票状态
- 支持信号提案创建、附议、快照投票，以及 permissionless `activate`、`finalize`、`queue`、`execute`、`expire`
- 支持从链上执行白名单选择一个或多个 action，根据目标合约 ABI 自动生成类型化参数输入框，由当前网络 RPC 序列化并在创建时冻结
- 提案正文保存 URI 与 SHA-256，社区讨论通过链上 `discussion_uri` 接入论坛
- GitHub Discussions 通过同源 `/community-api` 和仓库级 DAO Bot 接入；用户无需 GitHub 登录，讨论可一键预填为链上提案
- HuFu 钱包连接、交易解释、签名请求和状态追踪
- PC / 手机响应式布局与浏览器语言自动识别（英文、法文、日文、韩文、西班牙文、简体中文、繁体中文；专业链上术语在缺少本地化时回退英文）
- 内置双语治理帮助中心，并提供 [`docs/governance-help.md`](docs/governance-help.md) 作为完整用户操作说明

当前版本已经把节点排名、钱包账户票权、节点选择、投票人待领奖励、BP 注册和 BP 恢复接到链上 RPC；对应确认页会展示实际 action，并由钱包签名广播。RPC 返回失败时界面显示错误，不回退到伪造数据。

DAO 提案/附议/投票/Timelock/执行使用 `dao.gov`，预算预留与付款使用 `dao.treasury`。前端先校验链上 ABI 和 `config`；治理参数未配置时保持只读，不广播模拟交易。创建提案会先通过 `syncpower` 读取账户实际 GLON，再提交提案。附议同样先同步当前治理权；正式投票严格使用提案激活时的链上快照。历史在线率、论坛评论和全文检索仍需要索引服务或论坛 API。

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
│   ├── governance.js          提案阶段推导与 permissionless 生命周期动作
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

[DAO Governance Keeper（TypeScript）](./keeper/README.md)
