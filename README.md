# flon.daogov

FullOn Network 治理中心 H5 DApp，可在 HuFu 内置浏览器中打开，也支持普通移动浏览器预览。

页面在手机端使用底部导航，在桌面端自动切换为侧栏和多栏布局。首次访问按浏览器首选语言选择中文或英文，用户也可在右上角手动切换，选择会保存在当前浏览器中。

## 功能范围

- BP 候选人注册、Active / Standby / Candidate 排名
- FLON 投票本金和不可转让 GLON 治理权展示
- 最多选择 30 个 BP，总票权平均分配
- 当前与下一 Epoch 待生效票权
- BP 与投票人奖励查询、领取
- DAO 提案、附议、正式投票、Timelock 和执行
- HuFu 钱包连接、交易解释、签名请求和状态追踪
- PC / 手机响应式布局与浏览器语言自动识别（简体中文、英文）

当前版本是可交互的 H5 高保真前端。页面中的演示数据尚未连接测试链，签名按钮不会广播真实交易。

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
│   ├── app.js                 页面交互与演示状态
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

## 文档

[治理中心产品与实施设计](./docs/governance-design.md)
