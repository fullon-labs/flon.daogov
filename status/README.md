# FULLON BP Status

独立、无第三方依赖的 Node 24 服务。不会读取 flond 管理接口、环境密钥、钱包或签名器。前端与 `/api/status.json` 同源，服务端按配置探测；没有用户提供 URL 的入口。

## 启动

```sh
cd /Users/ray/work/flon/flon.daogov/status
cp config.example.json config.json
# 编辑 config.json 中 bps 数组，每个 BP 设置 network、chainId、producer、rpc、referenceRpc 和 services
npm start
```

默认只监听 `127.0.0.1:8787`。`PORT`、`HOST`、`STATUS_CONFIG`、`STATUS_DATA` 可覆盖。config.json 与 data/ 已忽略，不应提交私有端点。配置后需重启。每个 BP 使用独立 data/status.sqlite 中按 bp_id 隔离的记录。主网与测试网使用不同 BP id，变更网络或探针时更换 id，避免混入旧历史。旧版单 BP 配置仍可读取，id 默认为 default；旧版 data/<id>/samples.json 首次启动时事务导入一次；原始单 BP data/samples.json 不自动迁移，避免误归属。

通过 HTTPS 反向代理公开页面与 JSON；无需开放本服务以外的管理端口。推荐与被监测节点分离运行。Sites Worker 不支持 raw TCP，故完整 P2P 监测服务需部署到支持 TCP 出站连接的服务器，不能仅上传静态页面。Dockerfile 可用于常驻部署；将配置只读挂载至 /config/config.json、持久化目录挂载至 /data（node 用户可写）。

## 数据语义与边界

- 必须配置预期完整 chainId 才可确认网络；参考节点链 ID 必须相同。没有参考节点时 sync lag 为 null，链头年龄另列。RPC 探针验证 get_info，不等于出块或签名就绪。
- Active / Standby 来自当前 active schedule，角色不来自票数推断。无配置账号或无 schedule 时为 unknown。
- bpstats 来自最新已观测 epochstats 的 scope；最新 Epoch 未必已封存、也未必是按当前时间计算的 Epoch。趋势最多读取 30 期，标明封存状态；缺失数据不补零。
- expected = produced + missed；只有 expected > 0 且统计一致才计算出块率。idle_skipped 独立显示。Standby 无出块不会被判宕机。
- producer 全表分页读取后按 total_votes 排名；票差仅作数值展示（浮点投票权重，不是代币数量），不保证下一排班。自质押、GAS eligible / score / allocated 直接读取链上值。allocated 不表示已领取或实时到账。
- TCP 探测只验证连接建立，不验证 P2P 协议握手、chain ID 或同步。HTTP 探测只验证 2xx，不验证 History 查询或 Snapshot 完整性。私有目标地址不返回前端或错误详情。
- 90 天时间条与 24h/7d/30d/90d 可用率由本服务实际采样累计。可用率是已知样本中的 operational 比例，degraded 按非正常样本计算；同时显示时间覆盖率。没有历史、监测器停机的空档不补为在线。维护不纳入可用率分母。服务重启保留历史。
- 未配置、网络未验证、链上表读取失败、采集过期均不会冒充 operational。当前实现不自动将探测变化写成事故；incidents / maintenance 由运营者在配置录入，未录入不代表没有事故。
- 当前实现尚未接入可靠的“最后成功出块”、签名就绪探针、Finalizer、P2P peers、最低自质押验证、协议版本、奖励领取台账、投票历史、Standby proof 规则识别，均显示 unknown/null 或不作判断。当前合约源码保留的 proof 字段已废弃，不能拿它判过期。
- 本页面不会因外部监测自动执行惩罚、投票、签名、奖励领取或链上交易。

事故示例：`{"title":"RPC degraded","started_at":"2026-10-29T05:00:00Z","resolved_at":"2026-10-29T05:10:00Z","impact":"部分 RPC 查询超时"}`。
维护示例：`{"title":"节点升级","starts_at":"2026-10-30T01:00:00Z","ends_at":"2026-10-30T02:00:00Z","description":"滚动升级"}`。维护仅在无故障且其他状态均正常时将 overall 标为 maintenance，不覆盖真实故障。

执行 `npm test` 检查关键统计边界。JSON 返回 stale 标志，调用方应同时检查 updated_at 和 stale；HTTP 服务自身无法监测自身完全停机，应另设外部探针。

## 多 BP 门户 · status.flon.network

统一域名为 `https://status.flon.network`，DNS 指向运行本服务的部署主机（并非直接指向多个 BP）。页面选择器切换不同 BP 的状态；域名下每个 BP 可独立配置 mainnet/testnet、Chain ID、RPC、参考 RPC、P2P、事故和维护计划。探测地址保留在服务端。

- `/?bp=mainnet-bp-1`：可分享的 BP 直达链接；浏览器前进/后退同步选择。
- `/api/bps.json`：脱敏 BP 列表、每个 BP 的整体状态和默认选择。
- `/api/status.json?bp=mainnet-bp-1`：所选 BP 完整状态。
- `/api/status.json`：`defaultBp` 的状态，兼容旧调用方。
- 不存在的 BP 返回 404，不回退到其他 BP；不同 BP 采集独立执行，慢探测不会阻塞其他 BP 的后续采集，同一 BP 不重叠采集。

配置示例见 config.example.json；示例中的两个 BP 为未配置占位条目，不代表真实节点。`id` 只允许最多 64 位小写字母/数字/连字符且必须唯一。`publicOrigin` 声明预期域名，不代表完成了 DNS 或部署。`nginx.example.conf` 提供此域名的反向代理与 HTTPS 配置；需要先确定部署主机、配置 DNS 和取得证书才能启用。

## SQLite 与本机配置界面

运行时使用 Node 24 内置 `node:sqlite`，不需要安装数据库服务器。`data/status.sqlite` 保存 BP 配置、事故/维护记录及 90 天探测样本；使用 WAL 与 `(bp_id, at)` 索引，重启保留历史。配置文件仅作为首次种子，SQLite 中已有同 ID 的记录不会被覆盖。数据库含探测目标地址，应与私有配置一样保护，不能通过 Web 提供下载。

本机打开 `http://127.0.0.1:8788`，输入 BP account、RPC URL（含 IP / Port）、网络及 Chain ID，另可填 P2P IP / Port 和独立参考 RPC。保存后直接加入列表并开始采集，无需重启。新增 ID 必须唯一，改变监测目标时使用新 ID，避免历史混淆。管理端只绑定 127.0.0.1，校验 Host 与写入 Origin；不要通过 status.flon.network 反向代理此端口。远程管理可用 SSH 本地隧道。`STATUS_ADMIN_PORT=off` 可关闭管理端，或设置其他本地端口。Docker 内此端口同样只监听容器回环；可通过私有配置种子管理，不应直接发布管理端。

公开接口仍仅提供脱敏的状态数据。配置入口由本机管理员使用，未对匿名访客开放任意目标探测。

`rpcScope: "reference"` 表示用公共 RPC 观察链上 BP 账号，页面会说明链同步数值来自观察 RPC，整体状态保持 unknown，不能当作 BP 本身在线证明。只有确认 RPC 归属后才选择 `bp`；此标签是操作人员声明，不构成密码学身份验证。

当前本地测试配置选择测试网 `einstein`，已验证它在当前 Active schedule 中；使用现有测试网公共观察 RPC，尚未确认该 BP 的专属 RPC/P2P，因此不据此判断其节点同步或签名就绪。

## 接入资格与 30 分钟上限

未验证目标仅允许从首次观察起保留 **30 分钟**。期限存入 SQLite，重启不延期；同 RPC 换记录 ID、账号或参考 RPC 不会获得新的试用窗口。到期停止采集，公开 API 不再返回历史，清理配置、样本、事故与旧 JSON 历史；保留不可逆的目标哈希及期限，防止重复添加续期。清理任务每秒运行，读接口和样本写入也检查期限。这里是应用记录删除，不保证抹除外部备份或存储介质残留。

长期观察必须同时满足：

1. 在操作人员配置的可信网络 RPC 上核对 Chain ID，并查到 `flon::producers` 中同名且 `is_active` 的 BP（Active 和 Standby 均可）。
2. 操作人员独立核实该 BP 与所填端点的归属，并在私有资格文件中绑定精确目标哈希、证据说明与有效期。网页里的 `rpcScope=bp` 不是验证依据。

设置 `STATUS_ADMISSION_POLICY=/absolute/private/admission-policy.json`，格式参考 admission-policy.example.json。仅本机管理接口 `/api/configs` 返回用于绑定的 `target_key`；公开接口不返回它或证据细节。确认归属后，私有文件中可加入：

```json
{"target_key":"管理接口提供的精确哈希","verified_at":"核验时间 ISO8601","valid_until":"核验到期时间 ISO8601","evidence":"管理员独立核验的依据"}
```

不得只因账号真实存在就签发端点证明。状态服务不收集 BP 私钥，也不通过尝试出块验证身份。没有归属证据的节点（包括当前公共 RPC 观察测试账号）维持临时资格。

资格每 30 秒复核一次；取消注册、证据过期或可信查询失败会撤回长期资格，并进入一次不续期的 30 分钟清理窗口。已过期的临时目标不能靠重启、改 ID 或普通表单再次添加。数据库迁移时，已有目标优先按最早采样时间计算临时期限，不给旧记录重新延长 30 分钟。

## 自动发现 Active / Standby

选择器每 30 秒从所配置网络读取完整 `flon::producers`（分页）及 `get_producer_schedule`。当前 active schedule 内为 Active，其余有效注册 BP 为 Standby；退出注册且不在当前排班的账号不列入。排班过渡期间仍在 schedule 的账号保留显示。票数排名不用于推断角色。

推荐在私有 config.json 的顶层设置 `discovery` 数组，每项包含 `network`、`chainId`、`rpc`。未配置时，从启动配置的 bps 中提取网络来源（同一网络与 Chain ID 去重）。也支持 `bps: []` 配合 discovery，只运行链上目录。发现来源作为网络基础配置，不受单个临时节点过期影响。各网络均核对预期 Chain ID；查询失败时保留上一次列表并标记过期，不编造角色变更。

自动发现记录仅在内存中保存公开链上账号及共享的链上统计，不创建节点探测目标、端点历史或长期节点监测资格。没有专属端点时明确标注“链上自动发现”，整体健康为 Unknown。此前“未验证端点最多保留 30 分钟”的规则仍适用于手工接入的节点探测。已接入节点与同网络、同链 ID、同账号的发现记录合并，避免重复下拉条目。自动发现不会抓取 BP 网站或自动探测未经核验的 IP / P2P 端口。

选择器按网络和 Active / Standby 分组，显示两类数量；浏览器中也每 30 秒更新名单。自动发现列表和详情均通过原有 `/api/bps.json`、`/api/status.json?bp=<network>-<account>` 提供；API 不返回网络发现 RPC 地址。历史 Epoch 数据由每个网络共享批量查询，避免按 BP 重复扫描。

页面顶部提供 Mainnet / Testnet 切换，BP 列表及数量只显示所选网络，切回时恢复该网络上次选择的 BP。直达链接携带 `network` 和 `bp` 参数，支持浏览器前进/后退。没有配置发现来源的网络显示空状态，不沿用另一网络的链数据。示例：`/?network=testnet&bp=testnet-einstein`。

DAO Gov 的 BP 详情中提供紧凑版 Epoch 卡片（最新链上 Epoch、实出/应出、漏块、idle skipped、最近 30 期趋势），数据通过 DAO Gov 当前网络的同源 RPC 直接读取并校验 Chain ID。详情中的状态站入口统一生成 `https://status.flon.network/?network=<mainnet|testnet>&bp=<network>-<account>`，不依赖 BP 自行填写的状态页地址。卡片查询失败不阻塞详情中的其他信息，不将缺失统计或零应出块显示为 100%。

## 早期基金会 BP 与第三方独立 IP

早期账号只通过私有启动配置的 `foundationBps` 白名单授予共享资格，每项包含 network、chainId、producer。名单是管理员确认的固定快照，不随 active schedule 轮换自动增加。当前本地白名单依据已确认的测试网 21 个 Active 账号生成；未在名单内的后续第三方账号不能声明自己为基金会节点。

管理页可填写共享节点组 ID、RPC IP:Port、P2P IP:Port，并批量填写该组实际服务的 BP 账号。点击“填入当前网络基金会白名单”仅帮助填写账号，管理员仍需按真实部署情况分组；不是要求 21 个账号全部绑定到同一节点。同组的 RPC 和 P2P 配置必须一致。保存整批记录时先校验全部账号，任何一个不合法则不落库。

同一个物理端点的服务探测在短缓存窗口内共享，链上 BP 统计与各账号的观测历史仍分别保存；任何 IP、共享组标识和映射详情仅在本机管理端显示，不加入公开状态 JSON。

第三方专属节点必须使用同一个字面 IP 的 RPC 与 P2P，并独占该 IP；不同端口、IPv6 展开写法和 IPv4-mapped IPv6 不能绕过重复检查。IP 约束覆盖本服务已接入的专属节点记录，不能识别尚未登记的其他服务，也不能证明节点处在独立物理机。公共参考 RPC 仍是观察来源，不取得专属节点资格。

白名单基金会账号经本机管理员绑定端点后，仍需从可信网络 RPC 确认 BP 有效注册，并核对绑定 RPC 的 Chain ID，才能取得长期观察资格。此为早期基金会节点的管理员核验例外；第三方仍需原有端点归属证据，不能因账号出现在排班中自动升级。未通过核验的目标继续受 30 分钟上限约束。已到期的普通试用不续期；后续有独立核验依据的真实 BP 可以被正式接入，不按试用重新计时。

## Finalizer readiness

`/finalizers?network=testnet`（或 mainnet）提供账户、公钥登记、active/pending policy 身份、最后 QC 投票区块与区块时间，以及限时在线证明。页面入口位于状态站顶部。数据来自对应网络的 `flon::finkeys`、`flon::finalizers`、`get_finalizer_info`，先核对 Chain ID，policy 身份按当前登记公钥匹配，不按 description 猜测。

- **仅准备公钥**：登记公钥不证明节点持有私钥、在线或已进入 policy。
- **QC 投票证据**：节点 RPC 从已接受区块 QC 中追踪的投票，本服务再核对对应区块 ID、高度和区块时间。服务不独立验整份 QC 聚合签名，接口标记 `independently_verified_signature=false`；观察过的记录持久化，不把“缓存为空”判成离线，也不将最后区块时间冒充签名时间。RPC 必须是运营方配置的可信节点；公开接口不接受自报投票作为证据。
- **有时效的在线证明**：只证明此密钥在响应挑战时可用，并在挑战有效期内展示；不证明具体 IP、持续在线或整台节点完整就绪。默认有效期 5 分钟，到期、密钥轮换或链状态无法核对时撤下 ready。该服务不接收、保存或代管私钥。

机器接口：

- `GET /api/finalizers.json?network=testnet`
- `POST /api/finalizers/challenge`，JSON 为 `{"network":"testnet","account":"BP_ACCOUNT"}`。
- `POST /api/finalizers/proof`，JSON 只能含 `challenge_id` 和 `signature`。
- `GET /api/finalizers/proof.json?network=testnet&account=BP_ACCOUNT`。

挑战采用 UTF-8 消息 `FULLON_FINALIZER_READINESS_V1\n` 加服务器给出的 canonical JSON。消息绑定 domain、audience、network、chain_id、account、当前登记 public_key、LIB block_num/block_id、issued_at、expires_at 和随机 nonce；不要自行重排或重建字段。服务器只接受自己签发、未到期且未消费的挑战，提交时重新核对公钥与链状态。挑战成功验签后原子消费，拒绝重放；失败签名不会发布结果。challenge 与 proof 持久化在私有 `data/finalizer.sqlite`，公开的签名、原文及验证时间可供第三方复核。

在**持钥节点本地**保存下载的 challenge.json，运行：

```sh
cd status
node sign-readiness.mjs --challenge challenge.json --key-file /private/finalizer-key-file
```

密钥文件仅含一行 `PVT_BLS_...`，必须保留在持钥节点，不要上传到管理页、浏览器或 Git。工具输出仅包含 challenge_id 与 SIG_BLS 签名。HTTP 验证端只读取登记的公钥，不开放签名功能；对 proof/challenge 写请求采用全局每分钟 30 次限流、8 KiB 请求体上限，最多保留 200 个未过期挑战。部署时仍应配置反向代理限流。

BLS 使用锁定版本的 `@noble/curves`，采用原生链的 Basic G2 NUL ciphersuite。`PUB_BLS_` / `SIG_BLS_` 解析遵循原生 affine little-endian + RIPEMD160 四字节校验；拒绝无穷点、越界坐标和非子群点。`bls-native-vector.json` 是用链内 C++ bls12-381 库及公开测试标量 1 生成的互操作向量，不含真实节点私钥。新增依赖通过 status/pnpm-lock.yaml 固定，Docker 使用锁文件安装。
