import {autoConnectHuFuWallet,connectWallet,disconnectWallet,isHuFuApp,loadBPAccount,loadChainGovernanceParameters,loadContractAbi,loadElection,loadEpochTiming,loadGovernance,loadGovernanceActionDefaults,loadNetworkProduction,loadProducerRewards,loadProducerStake,loadVotingAccount,restoreWallet,serializeGovernanceAction,transact} from './wallet.js';

import {accountExplorerUrl} from './explorer.js';
import {DAO_STATUS_META,abiFieldValue,actionAbiFields,effectiveProposalPhase,enabledAllowlist,governanceAction,proposalCounts,validateFrozenActions} from './governance.js';
import {formatVoteInput,voteAllocationChanges} from './vote-diff.js';
import {generatedLocaleTerms} from './locales/index.js';
import {formatOverviewAsset} from './network-summary.js';

const views=[...document.querySelectorAll('.view')];
const nav=[...document.querySelectorAll('.bottom-nav [data-view-target]')];
const overlay=document.querySelector('[data-overlay]');
const sheet=document.querySelector('[data-sheet]');
const sheetContent=document.querySelector('[data-sheet-content]');
const toast=document.querySelector('.toast');
const runtimeConfig=Object.freeze({
  network:'testnet',
  networkName:'FullOn 测试网',
  chainId:'18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f',
  rpcUrl:'/rpc',
  voteRefundDelaySeconds:3*24*60*60,
  ...(window.__DAO_GOV_CONFIG__||{})
});
let toastTimer;
let walletSession=null;
let bpRecoveryState=null;
let bpRecoveryRequest=0;
let votingState=null;
let profileBPRewards=null;
let electionState=null;
let governanceState=null;
const contractAbiCache=new Map();
const proposalActionChecks=new WeakMap();
let pendingVoteAllocations=null;
let epochCountdownTimer=null;
let refundCountdownTimer=null;
let epochCountdownAnchor=null;
let candidateStep=1;
let candidateChainState={loading:false,registered:false,producer:null,error:''};
const candidateDraft={
  account:'flonian',website:'',xAccount:'',region:'702',statusUrl:'',
  producerKey:'',p2pEndpoint:'',apiEndpoint:'',shareRatio:'40'
};

const translations=new Map([
  ['跳到主要内容','Skip to main content'],['返回 HuFu','Back to HuFu'],['治理中心','DAO Governance'],['治理通知','Governance notifications'],['语言','Language'],['未连接','Not connected'],['连接钱包','Connect wallet'],['断开连接','Disconnect'],['钱包连接','Wallet connection'],['使用 HuFu 钱包连接','Connect with HuFu Wallet'],['使用 HuFu 或 Anchor 钱包连接','Connect with HuFu or Anchor Wallet'],['普通浏览器将显示 Anchor 二维码；HuFu 内会直接请求当前账户。','A standard browser displays an Anchor QR code; HuFu requests the current account directly.'],['钱包只负责账户授权与交易签名，DApp 不接触私钥。','The wallet only authorizes the account and signs transactions. The DApp never accesses private keys.'],['连接中…','Connecting…'],['钱包已连接','Wallet connected'],['钱包已断开','Wallet disconnected'],
  ['概览','Overview'],['网络与治理','Network & governance'],['投票','Vote'],['治理','Governance'],['社区治理','Governance'],['我的','Profile'],['当前治理账户','Governance account'],['日常钱包','Daily wallet'],['我的治理权','My governance power'],
  ['已投 FLON','Staked FLON'],['已选 BP','Selected BPs'],['待领取','Claimable'],['进行中','in progress'],['当前席位','Active seats'],['区块','Block'],['需要你处理','Action required'],['全部','All'],
  ['正式投票','Formal vote'],['剩余','Remaining'],['小时','hours'],['你有','You have'],['票权','voting power'],['去投票','Vote now'],['投票奖励已结算','Voter rewards settled'],['领取','Claim'],['个所投节点进入','voted node entered'],['建议检查节点状态与待生效排名','Review node status and pending ranking'],['查看','View'],
  ['网络概况','Network overview'],['节点排名','Node ranking'],['目标','Target'],['网络出块率','Block production'],['BP 构成','BP composition'],['BP 自质押总量','Total BP Self-Stake'],['全网质押总量','Total Network Stake'],['BP 自质押 + 投票质押','BP self-stake + voting stake'],['节点投票总量','Total node votes'],['已注册','Registered'],['近 24 小时','Last 24 hours'],['总投票本金','Total voting stake'],['活跃投票人','Active voters'],['近 7 天','Last 7 days'],
  ['DAO治理','DAO Governance'],['查看全部','View all'],['投票中','Voting'],['将 Active BP 席位从 3 个扩展至 7 个','Expand Active BP seats from 3 to 7'],['根据候选节点稳定性和网络负载，分阶段扩大出块节点集合。','Expand the producer set in phases based on node stability and network load.'],['赞成','For'],
  ['网络节点','Network nodes'],['BP 与投票','BPs & Voting'],['BP 排名','BP Rankings'],['BP 竞选','BP Election'],['BP 详情','BP details'],['申请成为 BP','Apply as BP'],['候选节点','Candidates'],['全部候选','All candidates'],['搜索账户、名称或地区','Search account, name, or region'],['新加坡','Singapore'],['东京','Tokyo'],['法兰克福','Frankfurt'],['香港','Hong Kong'],['首尔','Seoul'],['在线','uptime'],['分享','share'],['有效票权','effective votes'],['精确节点票权','Exact node voting power'],['自身质押','Self staking'],['获得的总投票','Total votes received'],['节点状态','Node status'],['排名','Rank'],['奖励分享比例','Reward sharing ratio'],['未领取出块奖励','Unclaimed block rewards'],['最后领取时间','Last reward claim'],['注册地址','Registered URL'],['地区代码','Location code'],['出块公钥','Block signing key'],['链上数据源','On-chain source'],['差','gap'],
  ['节点投票','Node voting'],['分配 FLON 节点票权','Allocate FLON node voting power'],['为每个 BP 独立填写 FLON 票数；分配合计不能超过账户拥有的 FLON','Enter FLON votes for each BP; the total cannot exceed the FLON owned by the account'],['本次分配合计','Allocation total'],['总投票本金（FLON）','Total voting stake (FLON)'],['节点投票本金','Node voting stake'],['链上已投','Staked on-chain'],['可用余额','Available balance'],['账户总可投','Total voting capacity'],['投票后生成等额不可转让 GLON，用于 DAO 治理','Voting mints an equal amount of non-transferable GLON for DAO governance'],['来自','Backed by'],['投票本金','voting stake'],['已选择','Selected'],['分配方式','Allocation mode'],['自定义','Custom'],['每个 BP','Per BP'],['修改将在','Changes take effect in'],['生效',''],['本 Epoch 奖励仍按当前 6 个节点计算','This epoch reward still uses the current 6-node allocation'],['选择 BP','Select BPs'],['BP 列表','BP list'],['修改选票','Edit votes'],['本金与退款','Stake & refunds'],['清空','Clear'],['清空选择','Clear selection'],['调整本金','Adjust stake'],['确认投票','Confirm vote'],['确认分配','Confirm allocation'],
  ['连接钱包后读取链上 FLON 投票本金','Connect wallet to load on-chain FLON voting stake'],['无法验证候选 BP，已禁用投票提交。','Candidate BPs could not be verified; voting is disabled.'],
  ['社区决策','Community decisions'],['DAO 治理','DAO Governance'],['发起提案','Create proposal'],['附议中','Endorsement'],['待执行','Ready to execute'],['建立生态开发者季度资助计划','Create a quarterly ecosystem developer grants program'],['资金提案','Treasury proposal'],['提案人','Proposer'],['人附议','endorsers'],['可附议','Endorse'],['后可执行','until executable'],['启用六小时奖励 Epoch 与历史票权结算','Enable six-hour reward epochs and historical voting-power settlement'],['合约参数','Contract parameters'],['已通过 · 安全等待期','Passed · security delay'],['执行目标','Execution target'],['查看执行内容','View execution'],
  ['账户概览','Account overview'],['我的治理','My Governance'],['累计奖励','Lifetime rewards'],['领取奖励','Claim rewards'],['我的节点投票','My BP votes'],['竞选管理','Election management'],['未注册','Not registered'],['我的治理任务','My governance tasks'],['等待你投票','awaits your vote'],['快照票权','snapshot power'],['处理','Act'],['节点分配已在','Node allocation became effective in'],['投票奖励完成结算','Voter rewards settled'],['治理记录','Governance history'],['打开完整链上治理记录','Open full on-chain governance history'],['附议','Endorsed'],['交易不可逆','Transaction is irreversible'],['调整 BP 投票分配','Updated BP vote allocation'],['昨天','Yesterday'],
  ['当前为','Current network:'],['当前账户','Current account'],['操作已完成','Done'],['确认节点投票','Confirm node vote'],['请核对交易内容，签名后将在下一 Epoch 生效','Review the transaction. It takes effect in the next epoch after signing.'],['网络','Network'],['账户','Account'],['选择 BP','Selected BPs'],['FLON 投票本金','FLON voting stake'],['每节点票权','Power per node'],['DAO 治理凭证','DAO governance receipt'],['GLON 仅用于 DAO 治理，不参与 BP 排名计算。','GLON is used only for DAO governance and does not count toward BP ranking.'],['总票权','Total power'],['生效 Epoch','Effective epoch'],['已入块不等于立即计入排名。新的节点分配将在 Epoch 1,249 边界生效。','Inclusion in a block does not immediately affect ranking. The new allocation takes effect at the Epoch 1,249 boundary.'],['取消','Cancel'],['在 HuFu 中确认','Confirm in HuFu'],['签名请求已发送至 HuFu 钱包','Signature request sent to HuFu'],
  ['领取投票奖励','Claim voter rewards'],['已完成确定性结算','has completed deterministic settlement'],['可领取','Claimable'],['合约','Contract'],['领取账户','Recipient'],['稍后','Later'],['确认签名','Confirm signature'],['发起治理提案','Create governance proposal'],['选择提案类型后进入结构化创建流程','Select a proposal type to start the guided flow'],['文本 / 信号提案','Text / signal proposal'],['表达社区方向，不自动执行链上动作','Express community direction without automatic on-chain execution'],['表达社区意见，不执行链上 action','Express community intent without executing on-chain actions'],['参数提案','Parameter proposal'],['可执行参数提案','Executable parameter proposal'],['通过白名单 action 修改网络参数','Modify network parameters through allowlisted actions'],['通过后执行已锁定的白名单 action','Executes the locked allowlisted action after approval'],['白名单为空，暂不可用','The allowlist is empty; currently unavailable'],['包含预算、收款方与验收条件','Includes budget, recipient, and acceptance criteria'],
  ['申请 BP 竞选','Apply for BP election'],['提交前将检查自质押、节点状态和公开资料','Self-stake, node status, and public profile are checked before submission'],['当前状态','Current status'],['最低自质押','Minimum self-stake'],['由链上参数决定','Set by on-chain parameters'],['必填资料','Required profile'],['网站、X、地区、状态页','Website, X, region, status page'],['公开资料是候选人声明；已验证状态需经过独立核验。','Public profile data is candidate-declared; verified status requires independent review.'],['开始申请','Start application'],['注册进度','Registration progress'],['资格检查','Eligibility'],['公开资料','Public profile'],['节点配置','Node setup'],['确认注册','Review'],['账户存在','Account exists'],['尚未注册为 BP','Not registered as a BP'],['已注册，可更新资料','Registered; profile can be updated'],['注册权限','Registration authority'],['使用当前账户 active 权限签名','Signed with the current account active permission'],['当前合约未设置单独 BP 自质押门限','The current contract has no separate BP self-stake threshold'],['主网节点竞选尚未启用','Mainnet BP election is not enabled'],['当前主网 flon ABI 尚未包含 regproducer 和 producers 状态表。请先完成主网合约升级。','The current mainnet flon ABI does not yet include regproducer or the producers table. Upgrade the mainnet contract first.'],['下一步','Continue'],['上一步','Back'],['节点名称','Node name'],['官方网站','Official website'],['X 账号','X account'],['国家或地区','Country or region'],['状态页','Status page'],['出块公钥','Block signing key'],['用于签署区块，不应填写私钥','Used to sign blocks; never enter a private key'],['P2P 节点地址','P2P endpoint'],['API 节点地址','API endpoint'],['投票人奖励分享比例','Voter reward share'],['提交后，该比例将用于后续 Epoch 奖励分配。','After submission, this ratio applies to reward distribution in subsequent epochs.'],['检查并签名','Review and sign'],['注册交易预览','Registration transaction'],['合约参数与填写内容一致后，再请求 HuFu 签名。','Verify the contract parameters before requesting a HuFu signature.'],['注册成功时 flon.system 会同步注册 voter.reward。','On successful registration, flon.system also registers the producer with voter.reward.'],['X、状态页、P2P 和 API 地址不会进入当前 regproducer 状态表，需后续元数据服务保存。','X, status page, P2P, and API endpoints are not stored by the current regproducer table and require a metadata service.'],['正在请求钱包签名…','Requesting wallet signature…'],['注册交易已广播','Registration transaction broadcast'],['更新 BP 资料','Update BP profile'],['签名并注册','Sign and register'],['BP 注册签名请求已发送至 HuFu','BP registration signature request sent to HuFu'],['FullOn 主网','FullOn Mainnet'],['FullOn 测试网','FullOn Testnet'],['调整投票本金','Adjust voting stake'],['存入 FLON 将生成等额不可转让 GLON','Depositing FLON mints an equal amount of non-transferable GLON'],['可用 FLON','Available FLON'],['已投本金','Voting stake'],['撤票时 GLON立即销毁，节点排名与奖励票权在下一 Epoch 移除。','GLON is burned immediately when unstaking; ranking and reward power are removed in the next epoch.'],['撤回','Unstake'],['增加投票','Add stake'],
  ['本向导仅用于申请成为 BP。普通 Voter 无需 BP 自质押，可直接增加投票本金并给节点投票。','This wizard is only for BP applicants. Voters do not need BP self-stake and can add voting stake and vote for nodes directly.'],['BP 自质押门限','BP self-stake requirement'],['已质押','Staked'],['最低','Minimum'],['当前链上合约尚未启用 BP 自质押表','The current contract has not enabled the BP self-stake table'],['BP 自质押已达标，可以继续填写候选节点资料。','The BP self-stake requirement is met. You can continue with the candidate profile.'],['仅 BP 候选人需要通过 flon::stakebp 补足自质押；普通 Voter 不受此门槛限制。','Only BP candidates must meet the self-stake requirement through flon::stakebp. Regular voters are not subject to this requirement.'],['我是 Voter，去投票','I am a voter — vote now'],['补足 BP 自质押','Add BP self-stake'],['仅申请 BP 的账户需要此操作','Only BP applicant accounts need this action'],['当前 BP 自质押','Current BP self-stake'],['最低门槛','Minimum requirement'],['质押数量','Stake amount'],['这是 BP 候选人保证金，不是 Voter 节点投票本金。退出 BP 自质押遵循链上 21 天解锁期。','This is the BP candidate bond, not voter node-voting stake. Withdrawing BP self-stake follows the on-chain 21-day unlocking period.'],['返回资格检查','Back to eligibility'],['BP 自质押交易已广播','BP self-stake transaction broadcast'],['重新检查资格','Recheck eligibility'],
  ['参数提案 ·','Parameter proposal ·'],['快照','Snapshot'],['通过后执行','Executes after approval'],['创建并完成附议','Created and endorsed'],['正式投票中','Formal vote in progress'],['你的快照票权','Your snapshot power'],['达到 quorum 与通过率后进入','Begins after quorum and approval thresholds are met'],['任何账户均可触发执行','Any account may trigger execution'],['仅执行上方已锁定的白名单 action','Only the locked allowlisted action above can execute'],['参与投票','Cast vote'],['反对','Against'],['不同意本次参数修改','Reject this parameter change'],['弃权','Abstain'],['计入 quorum，不计入赞成或反对','Counts toward quorum but not for or against'],['附议不会自动成为赞成票。本次选择需要再次由 HuFu 钱包签名。','An endorsement does not become a For vote automatically. This choice requires another HuFu signature.']
]);
[
  ['选择并支持可信的区块生产者','Choose and support trusted block producers'],['选择节点并直接填写分配的 FLON 数量','Select nodes and enter the FLON allocation for each'],['排序','Sort'],['综合排名','Overall rank'],['票权最高','Highest voting power'],['分享比例','Reward share'],['已选择优先','Selected first'],['尚可分配','Available to allocate'],['下一 Epoch 生效','Effective next epoch'],['修改节点或票数后即可提交','Change a node or vote amount to submit'],['分配票数','My vote allocation'],['连接钱包后管理投票','Connect wallet to manage votes'],['请输入最多 8 位小数的有效票数','Enter a valid amount with up to 8 decimals'],['分配总额超过账户可投 FLON','Allocation exceeds available FLON'],['当前分配尚未修改','No allocation changes'],['修改将在下一 Epoch 生效','Changes take effect next epoch']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['BP 生产状态','BP production status'],['连接 BP 账户钱包后读取链上状态','Connect the BP account wallet to load on-chain status'],['正在读取链上状态…','Loading on-chain status…'],['当前账户未注册为 BP','The current account is not registered as a BP'],['当前合约尚未支持 BP 自助恢复','The current contract does not yet support BP self-service recovery'],['链上状态读取失败','Failed to load on-chain status'],['暂停次数','Suspensions'],['当前 Epoch','Current Epoch'],['连续漏块','Consecutive misses'],['恢复生产','Resume production'],['冷却期尚未结束','Cooldown has not ended'],['暂停','Suspended'],['试运行','Probation'],['合格','Qualified'],['降级','Degraded'],['警告','Warning'],['样本不足','Insufficient sample'],['网络事件','Network incident'],['未评估','Not assessed'],['恢复后先进入试运行，不会直接视为合格。','Recovery starts probation and does not immediately restore qualified status.'],['试运行期间连续漏掉 12 个分配槽位会立即再次暂停。','Missing 12 consecutive assigned slots during probation causes immediate re-suspension.'],['再次暂停的冷却期按 6、12、24、48 小时递增，最高 48 小时。','Repeated suspension cooldowns escalate through 6, 12, 24, and 48 hours, capped at 48 hours.'],['需要 BP 账户 active 权限签名','Requires the BP account active permission'],['确认恢复生产','Confirm production recovery'],['交易成功后进入试运行，排班更新后才会重新获得出块槽位。','After the transaction succeeds, probation begins; block slots return only after the schedule updates.'],['我确认节点已在线并可持续签署区块','I confirm the node is online and can continuously sign blocks'],['签名并进入试运行','Sign and enter probation'],['正在请求钱包签名…','Requesting wallet signature…'],['恢复交易已广播','Recovery transaction broadcast'],['已进入试运行','Probation started'],['刷新状态','Refresh status']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['领取 BP 奖励','Claim BP rewards'],['代 BP 领取','Claim for a BP'],['BP 奖励领取','BP reward claim'],['当前账户可为自己或任意 BP 触发领取','The connected account can trigger a claim for itself or any BP'],['BP 收款账户','BP recipient'],['触发账户','Caller'],['基础奖励','Base rewards'],['GAS 奖励','GAS rewards'],['待领取记录','claim rows'],['本次最多处理','Maximum rows this claim'],['奖励始终直接支付给 BP，代触发账户不能更改收款人，也不会获得奖励。','Rewards are always paid directly to the BP. The caller cannot change the recipient or receive the rewards.'],['检查奖励','Check rewards'],['确认代领','Confirm claim'],['BP 奖励领取交易已广播','BP reward claim broadcast'],['请输入有效的 BP 账户名','Enter a valid BP account name'],['未找到该 BP','BP not found'],['当前合约尚未启用 BP 奖励领取','BP reward claims are not enabled by the current contract'],['处理中…','Processing…'],['可由任意钱包代为触发','Any wallet can trigger this claim'],['可为 BP 代触发','Can trigger for a BP'],['治理权','Governance power'],['暂无可领取的 BP 奖励','No BP rewards are currently claimable']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['完成','Done'],['不可领取','Not claimable'],['GAS 待领取奖励','Unclaimed GAS rewards'],['未设置','N/A'],['暂无已结算奖励可领取','No settled rewards to claim'],['当前账户未注册为 BP','The current account is not registered as a BP'],['奖励状态不可用','Reward status unavailable'],['当前合约未启用 BP 奖励领取','BP reward claims are not enabled by the current contract']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['连接钱包后读取链上已结算余额','Connect wallet to load the settled on-chain balance'],['提案、附议、投票与 Timelock','Proposals, endorsement, voting, and Timelock'],['当前尚未配置可验证的治理合约数据源；本页不会构造或广播模拟治理交易。','No verified governance contract data source is configured. This page does not construct or broadcast simulated governance transactions.'],['待接入','Pending integration'],['候选','Candidates'],
  ['连接钱包后读取','Connect wallet to load'],['链上选举状态','On-chain election status'],['实时 RPC','Live RPC'],['链上候选排名','On-chain candidate ranking'],['正在读取链上封存 Epoch…','Loading finalized on-chain epoch…'],['链上统计','On-chain statistics'],['等待完整 Epoch 封存','Awaiting a complete finalized epoch'],['链上出块统计暂不可用','On-chain production statistics unavailable'],['正在读取链上 BP 排名…','Loading on-chain BP ranking…'],['正在读取候选 BP…','Loading candidate BPs…'],['链上 BP 数据读取失败，请稍后刷新。','Failed to load on-chain BP data. Please try again later.'],['链上 BP 数据尚未就绪','On-chain BP data is not ready yet'],['投票分配在下一 Epoch 生效','Vote allocation takes effect next epoch'],['待生效状态以 flon::pendingvote 链上记录为准','Pending state is read from flon::pendingvote'],['正在读取链上时间…','Loading chain time…'],['距离下一 Epoch','Until next epoch'],['距离 Epoch 生效','Until epoch activation'],['等待 Epoch 结算','Awaiting epoch settlement'],['Epoch 时间不可用','Epoch timing unavailable'],['DAO 提案功能待接入','DAO proposal integration pending'],['治理合约 ABI 与部署地址确认后开放','Available after the governance ABI and deployment are verified'],['说明','Details'],['读取链上状态','Load on-chain status'],['待领取奖励','Claimable rewards'],['存在下一 Epoch 待生效修改','A change is pending for the next epoch'],['链上已结算','Settled on-chain'],['DAO Governance 尚未启用','DAO Governance is not enabled'],['当前站点未配置可验证的治理合约 ABI 与部署地址','This site has no verified governance contract ABI or deployment configured'],['提案、附议、正式投票、Timelock 和执行按钮已保持只读，不会请求钱包签名，也不会广播模拟交易。','Proposal, endorsement, formal voting, Timelock, and execution remain read-only; they neither request a wallet signature nor broadcast simulated transactions.'],['调整投票本金尚未启用','Voting stake adjustment is not enabled'],['需要先确认 addvote / subvote 的主网 ABI 与资产精度','The production addvote/subvote ABI and asset precision must be verified first'],['当前版本不会根据示例余额构造质押或撤票交易。节点选择与投票奖励领取已使用真实链上状态。','This version does not construct stake or unstake transactions from sample balances. BP selection and voter reward claims use real on-chain state.']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['投票本金与退款','Voting stake & refund'],['本金与退款','Stake & refund'],['增加、撤回或领取','Add, unstake, or claim'],['撤票退款处理中','Vote refund pending'],['退款已可领取','Refund ready to claim'],['全部撤票并申请退款','Unstake all and request refund'],['确认退出节点投票','Confirm exit from node voting'],['全部 BP 分配将在下一 Epoch 清零','All BP allocations will become zero in the next epoch'],['退款冷却期','Refund cooldown'],['72 小时','72 hours'],['申请退款','Request refund'],['领取解锁 FLON','Claim unlocked FLON'],['解锁倒计时','Unlock countdown'],['预计可领取时间','Estimated claim time'],['等待退款成熟','Waiting for refund maturity'],['退出交易已广播','Exit transaction broadcast'],['FLON 已进入 72 小时退款冷却期','FLON entered the 72-hour refund cooldown'],['撤回投票本金并申请退款','Unstake voting principal and request refund'],['立即销毁等量凭证','Burn the same amount of receipts immediately']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['尚无链上提案','No on-chain proposals yet'],['正在读取链上提案…','Loading on-chain proposals…'],['无法验证 dao.gov ABI，治理交易已禁用。','Unable to verify the dao.gov ABI. Governance transactions are disabled.'],['DAO 治理状态不可用','DAO governance status is unavailable'],['治理参数尚未配置','Governance parameters are not configured'],['dao.gov 已部署，但治理参数尚未配置。配置完成前不能发起提案。','dao.gov is deployed, but its governance parameters are not configured. Proposals cannot be created until configuration is complete.'],['链上治理数据读取失败','Failed to load on-chain governance data'],['个链上提案','on-chain proposals'],['总治理权','Total governance power'],
  ['未知','Unknown'],['投票等待期','Voting delay'],['未通过','Rejected'],['已通过','Passed'],['已取消','Cancelled'],['已执行','Executed'],['已过期','Expired'],['进入投票','Start voting'],['结算投票','Finalize voting'],['进入 Timelock','Enter Timelock'],['执行','Execute'],['标记过期','Mark expired'],
  ['提案类型','Proposal type'],['风险等级','Risk tier'],['最低全网票权','Minimum network power'],['待激活','Pending activation'],['Quorum / 通过率 / 绝对支持','Quorum / approval / absolute support'],['反对','Against'],['弃权','Abstain'],['拟议变更','Proposed changes'],['提案文档','Proposal document'],['社区讨论','Community discussion'],['尚未关联论坛讨论','No forum discussion linked'],['关闭','Close'],
  ['支持本提案','Support this proposal'],['拒绝本提案','Reject this proposal'],['人附议','endorsers'],['提案类型','Proposal type'],['拟议变更','Proposed changes'],['提案文档','Proposal document'],['社区讨论','Community discussion'],['尚未关联论坛讨论','No forum discussion linked'],['关闭','Close'],
  ['信号提案表达社区意见；可执行提案通过后只执行创建时锁定的白名单 action。','Signal proposals express community intent. Executable proposals may only run allowlisted actions locked when the proposal was created.'],['可执行参数提案','Executable parameter proposal'],['（白名单为空）',' (allowlist is empty)'],['标题','Title'],['摘要','Summary'],['提案文档 URI','Proposal document URI'],['社区讨论 URI','Community discussion URI'],['白名单 action','Allowlisted action'],['移除此 action','Remove this action'],['添加 action','Add action'],['参数输入框根据目标 action 的链上 ABI 自动生成。签名前由当前网络 RPC 序列化，并检查白名单及字节上限。','Input fields are generated from the target action ABI. Before signing, the current network RPC serializes the arguments and validates allowlist and byte limits.'],['正在读取 action ABI…','Loading action ABI…'],['此 action 不需要参数。','This action has no arguments.'],['无法读取 action ABI：','Unable to load action ABI: '],['Action ABI 尚未加载完成','The action ABI is still loading'],['请检查 action 参数','Check the action arguments'],['提案正文保存在公开文档或去中心化存储，链上保存内容哈希和 URI；论坛链接在附议期结束后冻结。','Proposal content is stored in a public document or decentralized storage. The chain stores its hash and URI; the forum link is frozen when endorsement ends.'],['提案交易已广播','Proposal transaction broadcast'],['个执行操作已锁定','execution actions locked'],['交易已广播','Transaction broadcast'],['单个提案最多','A proposal supports at most'],['个 action','actions'],['附议交易已广播','Endorsement transaction broadcast'],
  ['正在读取链上治理状态','Loading on-chain governance status'],['读取链上治理状态','Load on-chain governance status'],['治理帮助','Governance help'],['节点投票、Epoch、提案与奖励','Node voting, epochs, proposals, and rewards'],['治理中心导航','Governance center navigation'],['你有 3 项治理任务','You have 3 governance tasks'],['治理记录来自链上数据','Governance history comes from on-chain data'],['个 BP','BPs'],['— 个 BP','— BPs']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['选择','Select'],['Action 参数必须是有效 JSON','Action arguments must be valid JSON'],['参与投票','Cast vote'],['计入 quorum','Counts toward quorum'],
  ['正在读取链上注册状态…','Loading on-chain registration status…'],['链上资格检查失败','On-chain eligibility check failed'],['重试','Retry'],['奖励分享','Reward share'],['读取 FLON 余额失败','Failed to load FLON balance'],['请输入有效质押数量','Enter a valid stake amount'],['可用余额不足，当前为','Insufficient available balance; current balance is'],['未配置','Not configured'],['请输入最多 8 位小数的有效 FLON 票数','Enter a valid FLON vote amount with up to 8 decimals'],['最多投票给 30 个 BP','You may vote for at most 30 BPs'],['每个已选 BP 的票数必须大于 0','Each selected BP must receive more than 0 votes'],['读取链上票权失败','Failed to load on-chain voting power'],['分配合计不能超过账户拥有的','Total allocation cannot exceed the account balance of'],['已有一笔撤票退款待领取，暂时不能减少投票总额','A vote refund is already pending; the total voting stake cannot be reduced yet'],['当前链上合约尚未启用逐 BP 票数分配','Per-BP vote allocation is not enabled by the current contract'],
  ['请核对每个 BP 的票数，一次签名后将在下一 Epoch 生效','Review each BP allocation. One signature submits all changes for the next epoch'],['投票变更','Vote changes'],['变更前','Before'],['变更后','After'],['新增','Added'],['修改','Changed'],['移除','Removed'],['分配合计','Total allocation'],['账户拥有','Account balance'],['清空全部 BP 投票','Clear all BP votes'],['所有 BP 分配之和必须等于锁定投票本金，且不能超过账户拥有的 FLON。每 1 FLON 最多产生 1 票，不会复制放大。','The sum of all BP allocations must equal the locked voting stake and cannot exceed the FLON owned by the account. Each FLON creates at most one vote; voting power is never duplicated.'],['节点投票已广播','Node vote transaction broadcast'],
  ['读取投票本金失败','Failed to load voting stake'],['当前链上合约不支持调整投票本金','The current contract does not support voting-stake changes'],['质押 FLON 生成等额不可转让 GLON','Staking FLON mints the same amount of non-transferable GLON'],['治理凭证','Governance receipt'],['撤票退款','Vote refund'],['操作','Operation'],['增加投票本金','Add voting stake'],['金额','Amount'],['增加本金在下一 Epoch 计入节点票权；撤票会立即销毁等量 GLON，BP 票权在下一 Epoch 移除，FLON 在 72 小时冷却期后领取。每个账户同一时间只能有一笔待领取退款。','Added stake counts toward node voting power in the next epoch. Unstaking immediately burns the same amount of GLON, removes BP voting power in the next epoch, and makes FLON claimable after a 72-hour cooldown. An account may have only one pending refund.'],['撤回本金','Stake to withdraw'],['签名后会创建链上退款申请。72 小时到期后仍需调用 flon::voterefund 领取，FLON 不会自动到账。','Signing creates an on-chain refund request. After 72 hours, flon::voterefund must still be called; FLON is not transferred automatically.'],['返回','Back'],['可用 FLON 余额不足','Insufficient available FLON balance'],['投票本金不足','Insufficient voting stake'],['投票本金交易已广播','Voting stake transaction broadcast'],['新的节点排名票权将在下一 Epoch 生效。','The updated node-ranking voting power takes effect in the next epoch.'],['撤票退款已领取','Vote refund claimed'],['领取退款','Claim refund'],
  ['读取奖励失败','Failed to load rewards'],['奖励不会自动空投；未领取余额持续累积，不会因错过 Epoch 丢失','Rewards are not airdropped automatically. Unclaimed balances continue to accumulate and are not lost when an epoch is missed'],['领取必须由当前受益账户本人签名，第三方不能代领。最终到账金额以交易执行结果为准。','The beneficiary account must sign the claim; third parties cannot claim voter rewards. The executed transaction determines the final amount received.'],['奖励领取交易已广播','Reward claim transaction broadcast'],['最终到账金额以交易执行结果为准。','The executed transaction determines the final amount received.'],
  ['DAO治理尚未启用','DAO governance is not enabled'],['语言已切换为中文','Language changed to Chinese'],['投票后生成等额不可转让 GLON，用于DAO治理','Voting mints an equal amount of non-transferable GLON for DAO governance'],['请输入有效的 FU 或 EOS Base58 出块公钥','Enter a valid FU or EOS Base58 block-signing key'],['基础待领取记录','Unclaimed base-reward rows']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['拟议变更','Proposed changes'],['配置类操作会自动填入链上当前值，请只修改希望变更的字段。提交提案后，操作与参数将被锁定，投票期间不能替换。','Configuration operations are prefilled with current on-chain values. Change only the intended fields. Once submitted, the operation and arguments are locked for the vote.'],['通过后执行提交时锁定的白名单 action','Executes the allowlisted action locked when submitted after approval'],['信号提案表达社区意见；可执行提案通过后只执行创建时锁定的白名单 action。','Signal proposals express community intent. Executable proposals may only run the allowlisted action locked when created.'],['已载入链上当前值','Current on-chain values loaded'],['无法读取链上当前值，不能安全创建此配置提案。','Current on-chain values could not be loaded, so this configuration proposal cannot be created safely.']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['链上未配置','Not configured on-chain'],['天','days'],['分钟','minutes'],['秒','seconds'],['奖励与投票 Epoch','Reward and voting epoch'],['Active BP 目标席位','Target Active BP seats'],['最多投票节点','Maximum voted BPs'],['撤票退款冷却期','Vote refund cooldown'],['提案附议期','Proposal endorsement period'],['投票延迟期','Voting delay'],['正式投票期','Formal voting period'],['执行宽限期','Execution grace period'],['没有可返回的上一页','No previous page is available']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['BP 与投票页面','BPs & Voting page'],['我的总投票','My total votes'],['我的投票','My votes'],['查看并确认','Review and confirm'],['搜索与排序','Search & sort'],['收起筛选','Hide filters']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['BP 自质押与解锁期设置','BP self-stake and unlock settings'],['是否在排班中强制执行自质押门槛','Enforce self-stake requirement in scheduling'],['最低 BP 自质押','Minimum BP self-stake'],['自质押解锁期（秒）','Self-stake unlock period (seconds)']
].forEach(([zh,en])=>translations.set(zh,en));
const languageLabels={en:'English',fr:'Français',ja:'日本語',ko:'한국어',es:'Español','zh-CN':'简体中文','zh-TW':'繁體中文'};
const supportedLanguages=new Set(Object.keys(languageLabels));
const localeTerms={
  fr:{'Overview':'Aperçu','BPs & Voting':'BP et vote','Governance':'Gouvernance','Profile':'Profil','FullOn Mainnet':'Réseau principal FullOn','FullOn Testnet':'Réseau de test FullOn','My total votes':'Total de mes votes','My votes':'Mes votes','All candidates':'Tous les candidats','Selected':'Sélectionnés','Search account, name, or region':'Rechercher un compte, un nom ou une région','BP list':'Liste des BP','Community decisions':'Décisions communautaires','Create proposal':'Créer une proposition','Connect wallet':'Connecter le portefeuille','Claim voter rewards':'Réclamer les récompenses de vote','Apply as BP':'Devenir BP','Network overview':'Aperçu du réseau','Node ranking':'Classement des nœuds','Target':'Objectif','On-chain candidate ranking':'Classement des candidats on-chain','Candidates':'Candidats','Block production':'Production de blocs','Loading finalized on-chain epoch…':'Chargement de l’Epoch finalisée…','Action required':'Actions requises','All':'Tout','DAO Governance':'Gouvernance DAO','Loading on-chain governance status':'Chargement de la gouvernance on-chain','View':'Voir','Connect wallet to load the settled on-chain balance':'Connectez le portefeuille pour charger le solde réglé on-chain','Claim':'Réclamer','View all':'Tout voir','Loading on-chain proposals…':'Chargement des propositions on-chain…','On-chain statistics':'Statistiques on-chain','Awaiting a complete finalized epoch':'En attente d’une Epoch complète finalisée','on-chain proposals':'propositions on-chain','Total governance power':'Pouvoir de gouvernance total','Governance parameters are not configured':'Paramètres de gouvernance non configurés','No on-chain proposals yet':'Aucune proposition on-chain','Settled on-chain':'Réglé on-chain','No settled rewards to claim':'Aucune récompense réglée à réclamer','Not claimable':'Non réclamable'},
  ja:{'Overview':'概要','BPs & Voting':'BPと投票','Governance':'ガバナンス','Profile':'プロフィール','FullOn Mainnet':'FullOn メインネット','FullOn Testnet':'FullOn テストネット','My total votes':'私の総投票数','My votes':'自分の投票','All candidates':'すべての候補','Selected':'選択済み','Search account, name, or region':'アカウント、名前、地域を検索','BP list':'BP一覧','Community decisions':'コミュニティの意思決定','Create proposal':'提案を作成','Connect wallet':'ウォレット接続','Claim voter rewards':'投票報酬を受け取る','Apply as BP':'BPに申請','Network overview':'ネットワーク概要','Node ranking':'ノードランキング','Target':'目標','On-chain candidate ranking':'オンチェーン候補ランキング','Candidates':'候補ノード','Block production':'ブロック生成率','Loading finalized on-chain epoch…':'確定済みEpochを読み込み中…','Action required':'対応が必要','All':'すべて','DAO Governance':'DAOガバナンス','Loading on-chain governance status':'オンチェーンガバナンスを読み込み中','View':'表示','Connect wallet to load the settled on-chain balance':'ウォレット接続後に確定済み残高を読み込みます','Claim':'受け取る','View all':'すべて表示','Loading on-chain proposals…':'オンチェーン提案を読み込み中…','On-chain statistics':'オンチェーン統計','Awaiting a complete finalized epoch':'完全なEpochの確定待ち','on-chain proposals':'件のオンチェーン提案','Total governance power':'総ガバナンス権','Governance parameters are not configured':'ガバナンス設定が未構成です','No on-chain proposals yet':'オンチェーン提案はまだありません','Settled on-chain':'オンチェーン確定済み','No settled rewards to claim':'受取可能な確定済み報酬はありません','Not claimable':'受取不可'},
  ko:{'Overview':'개요','BPs & Voting':'BP 및 투표','Governance':'거버넌스','Profile':'프로필','FullOn Mainnet':'FullOn 메인넷','FullOn Testnet':'FullOn 테스트넷','My total votes':'내 총 투표수','My votes':'내 투표','All candidates':'모든 후보','Selected':'선택됨','Search account, name, or region':'계정, 이름 또는 지역 검색','BP list':'BP 목록','Community decisions':'커뮤니티 의사결정','Create proposal':'제안 만들기','Connect wallet':'지갑 연결','Claim voter rewards':'투표 보상 받기','Apply as BP':'BP 신청','Network overview':'네트워크 개요','Node ranking':'노드 순위','Target':'목표','On-chain candidate ranking':'온체인 후보 순위','Candidates':'후보 노드','Block production':'블록 생성률','Loading finalized on-chain epoch…':'확정된 Epoch 불러오는 중…','Action required':'조치 필요','All':'전체','DAO Governance':'DAO 거버넌스','Loading on-chain governance status':'온체인 거버넌스 상태 불러오는 중','View':'보기','Connect wallet to load the settled on-chain balance':'지갑을 연결하여 확정된 온체인 잔액을 불러오세요','Claim':'받기','View all':'전체 보기','Loading on-chain proposals…':'온체인 제안 불러오는 중…','On-chain statistics':'온체인 통계','Awaiting a complete finalized epoch':'완전한 Epoch 확정 대기 중','on-chain proposals':'개의 온체인 제안','Total governance power':'총 거버넌스 권한','Governance parameters are not configured':'거버넌스 매개변수가 설정되지 않았습니다','No on-chain proposals yet':'온체인 제안이 아직 없습니다','Settled on-chain':'온체인 확정 완료','No settled rewards to claim':'받을 수 있는 확정 보상이 없습니다','Not claimable':'수령 불가'},
  es:{'Overview':'Resumen','BPs & Voting':'BP y votación','Governance':'Gobernanza','Profile':'Perfil','FullOn Mainnet':'Red principal FullOn','FullOn Testnet':'Red de prueba FullOn','My total votes':'Mis votos totales','My votes':'Mis votos','All candidates':'Todos los candidatos','Selected':'Seleccionados','Search account, name, or region':'Buscar cuenta, nombre o región','BP list':'Lista de BP','Community decisions':'Decisiones de la comunidad','Create proposal':'Crear propuesta','Connect wallet':'Conectar cartera','Claim voter rewards':'Reclamar recompensas de voto','Apply as BP':'Postularse como BP','Network overview':'Resumen de la red','Node ranking':'Clasificación de nodos','Target':'Objetivo','On-chain candidate ranking':'Clasificación de candidatos on-chain','Candidates':'Candidatos','Block production':'Producción de bloques','Loading finalized on-chain epoch…':'Cargando la Epoch finalizada…','Action required':'Acción requerida','All':'Todo','DAO Governance':'Gobernanza DAO','Loading on-chain governance status':'Cargando la gobernanza on-chain','View':'Ver','Connect wallet to load the settled on-chain balance':'Conecta la cartera para cargar el saldo liquidado on-chain','Claim':'Reclamar','View all':'Ver todo','Loading on-chain proposals…':'Cargando propuestas on-chain…','On-chain statistics':'Estadísticas on-chain','Awaiting a complete finalized epoch':'Esperando una Epoch completa finalizada','on-chain proposals':'propuestas on-chain','Total governance power':'Poder de gobernanza total','Governance parameters are not configured':'Los parámetros de gobernanza no están configurados','No on-chain proposals yet':'Aún no hay propuestas on-chain','Settled on-chain':'Liquidado on-chain','No settled rewards to claim':'No hay recompensas liquidadas para reclamar','Not claimable':'No reclamable'},
  'zh-TW':{'Overview':'概覽','BPs & Voting':'BP 與投票','Governance':'社區治理','Profile':'我的','FullOn Mainnet':'FullOn 主網','FullOn Testnet':'FullOn 測試網','My total votes':'我的總投票','My votes':'我的投票','All candidates':'全部候選','Selected':'已選擇','Search account, name, or region':'搜尋帳戶、名稱或地區','BP list':'BP 列表','Community decisions':'社區決策','Create proposal':'發起提案','Connect wallet':'連接錢包','Claim voter rewards':'領取投票獎勵','Apply as BP':'申請成為 BP','Network overview':'網路概況','Node ranking':'節點排名','Target':'目標','On-chain candidate ranking':'鏈上候選排名','Candidates':'候選節點','Block production':'網路出塊率','Loading finalized on-chain epoch…':'正在讀取已封存的鏈上 Epoch…','Action required':'待處理事項','All':'全部','DAO Governance':'DAO 治理','Loading on-chain governance status':'正在讀取鏈上治理狀態','View':'查看','Connect wallet to load the settled on-chain balance':'連接錢包後讀取鏈上已結算餘額','Claim':'領取','View all':'查看全部','Loading on-chain proposals…':'正在讀取鏈上提案…','On-chain statistics':'鏈上統計','Awaiting a complete finalized epoch':'等待完整 Epoch 封存','on-chain proposals':'個鏈上提案','Total governance power':'治理總票權','Governance parameters are not configured':'治理參數尚未配置','No on-chain proposals yet':'尚無鏈上提案','Settled on-chain':'鏈上已結算','No settled rewards to claim':'暫無已結算獎勵可領取','Not claimable':'不可領取'}
};
for(const [locale,terms] of Object.entries(generatedLocaleTerms))localeTerms[locale]={...terms,...localeTerms[locale]};
Object.assign(localeTerms.fr,{'Vote changes':'Modifications de vote','Before':'Avant','After':'Après','Added':'Ajouté','Changed':'Modifié','Removed':'Supprimé'});
Object.assign(localeTerms.ja,{'Vote changes':'投票の変更','Before':'変更前','After':'変更後','Added':'追加','Changed':'変更','Removed':'削除'});
Object.assign(localeTerms.ko,{'Vote changes':'투표 변경','Before':'변경 전','After':'변경 후','Added':'추가','Changed':'변경','Removed':'삭제'});
Object.assign(localeTerms.es,{'Vote changes':'Cambios de voto','Before':'Antes','After':'Después','Added':'Añadido','Changed':'Modificado','Removed':'Eliminado'});
Object.assign(localeTerms['zh-TW'],{'Vote changes':'投票變更','Before':'變更前','After':'變更後','Added':'新增','Changed':'修改','Removed':'移除'});
const sourceText=new WeakMap();
const sourceAttrs=new WeakMap();
function normalizeLanguage(value){const locale=String(value||'').replace('_','-'),lower=locale.toLowerCase();if(lower==='zh-tw'||lower==='zh-hk'||lower==='zh-hant')return'zh-TW';if(lower.startsWith('zh'))return'zh-CN';const base=lower.split('-')[0];return supportedLanguages.has(base)?base:'en'}
let currentLanguage=normalizeLanguage(localStorage.getItem('flon-daogov-language')||(navigator.languages||[navigator.language||'en'])[0]);

function networkName(){
  if(runtimeConfig.network==='mainnet')return translateText('FullOn 主网');
  if(runtimeConfig.network==='testnet')return translateText('FullOn 测试网');
  return currentLanguage==='zh-CN'?runtimeConfig.networkName:translateText(runtimeConfig.networkName);
}
function renderNetworkNames(){document.querySelectorAll('[data-network-name]').forEach(node=>node.textContent=networkName())}

function translateText(value){if(currentLanguage==='zh-CN')return value;let output=value;[...translations.entries()].sort((a,b)=>b[0].length-a[0].length).forEach(([zh,en])=>{output=output.split(zh).join(en)});const terms=localeTerms[currentLanguage];if(terms)Object.entries(terms).sort((a,b)=>b[0].length-a[0].length).forEach(([en,localized])=>{output=output.split(en).join(localized)});return output}
function applyTranslations(root=document){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){
    let state=sourceText.get(node);
    if(!state||node.nodeValue!==state.rendered)state={source:node.nodeValue,rendered:node.nodeValue};
    const rendered=currentLanguage==='zh-CN'?state.source:translateText(state.source);
    node.nodeValue=rendered;sourceText.set(node,{source:state.source,rendered});
  }
  root.querySelectorAll?.('[placeholder],[aria-label],[data-message]').forEach(el=>{
    let state=sourceAttrs.get(el);const current={placeholder:el.getAttribute('placeholder'),ariaLabel:el.getAttribute('aria-label'),message:el.getAttribute('data-message')};
    if(!state||Object.entries(current).some(([key,value])=>value!==state.rendered[key]))state={source:current,rendered:current};
    const rendered={};for(const [key,value] of Object.entries(state.source)){const name=key==='ariaLabel'?'aria-label':key==='message'?'data-message':key;rendered[key]=value===null?null:(currentLanguage==='zh-CN'?value:translateText(value));if(rendered[key]!==null)el.setAttribute(name,rendered[key])}
    sourceAttrs.set(el,{source:state.source,rendered});
  });
  document.documentElement.lang=currentLanguage;const label=document.querySelector('[data-language-label]');if(label)label.textContent=languageLabels[currentLanguage];document.querySelectorAll('[data-language-option]').forEach(option=>{const active=option.dataset.languageOption===currentLanguage;option.classList.toggle('is-active',active);option.setAttribute('aria-checked',String(active))});
  renderNetworkNames();
}
function closeLanguageMenu(){const menu=document.querySelector('[data-language-menu]'),trigger=document.querySelector('[data-action="language-toggle"]');if(menu)menu.hidden=true;if(trigger)trigger.setAttribute('aria-expanded','false')}
function setLanguage(language){currentLanguage=normalizeLanguage(language);localStorage.setItem('flon-daogov-language',currentLanguage);closeLanguageMenu();applyTranslations();updateEpochCountdown();showToast(`${languageLabels[currentLanguage]} selected`)}

document.documentElement.dataset.network=runtimeConfig.network;
renderNetworkNames();

function showView(name){
  views.forEach(view=>{const active=view.dataset.view===name;view.hidden=!active;view.classList.toggle('is-active',active)});
  nav.forEach(button=>button.classList.toggle('is-active',button.dataset.viewTarget===name));
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='nodes')setMobileVoteTab('directory');
  if(name==='mine')refreshBPRecovery();
  if(name==='dao')refreshGovernance();
}
function navigateBack(){
  if(window.history.length>1){window.history.back();return}
  const current=views.find(view=>view.classList.contains('is-active'))?.dataset.view;
  if(current&&current!=='overview'){showView('overview');return}
  showToast(currentLanguage==='zh-CN'?'没有可返回的上一页':'No previous page is available');
}
function setNodeMode(mode='directory'){
  document.querySelectorAll('[data-node-mode]').forEach(button=>button.classList.toggle('is-active',button.dataset.nodeMode===mode));
  document.querySelectorAll('[data-node-mode-panel]').forEach(panel=>panel.hidden=panel.dataset.nodeModePanel!==mode);
}
const mobileVoteMedia=window.matchMedia('(max-width: 899px)');
let mobileVoteTab='directory';
function setMobileVoteTab(tab='directory'){
  mobileVoteTab=tab==='summary'?'summary':'directory';
  const mobile=mobileVoteMedia.matches;
  document.querySelectorAll('[data-mobile-vote-tab]').forEach(button=>{
    const active=button.dataset.mobileVoteTab===mobileVoteTab;
    button.classList.toggle('is-active',active);
    if(button.getAttribute('role')==='tab')button.setAttribute('aria-selected',String(active));
  });
  document.querySelectorAll('[data-mobile-vote-panel]').forEach(panel=>{panel.hidden=mobile&&panel.dataset.mobileVotePanel!==mobileVoteTab});
  const dock=document.querySelector('[data-mobile-vote-dock]');if(dock)dock.hidden=!mobile||mobileVoteTab!=='directory'||dock.dataset.hasChanges!=='true';
  if(mobile)window.scrollTo({top:0,behavior:'smooth'});
}
mobileVoteMedia.addEventListener?.('change',()=>setMobileVoteTab(mobileVoteTab));
function showToast(message){clearTimeout(toastTimer);toast.textContent=message;toast.hidden=false;toastTimer=setTimeout(()=>toast.hidden=true,2200)}
function openSheet(html){if(refundCountdownTimer)window.clearInterval(refundCountdownTimer);refundCountdownTimer=null;sheetContent.innerHTML=html;applyTranslations(sheetContent);overlay.hidden=false;sheet.hidden=false;document.body.style.overflow='hidden'}
function closeSheet(){if(refundCountdownTimer)window.clearInterval(refundCountdownTimer);refundCountdownTimer=null;pendingVoteAllocations=null;overlay.hidden=true;sheet.hidden=true;document.body.style.overflow=''}
function walletProviderName(provider){return provider==='iframe'?'HuFu App':provider==='hufu'?'HuFu Wallet':'Anchor Wallet'}
function renderWallet(){const account=walletSession?.account||'未连接',label=walletSession?walletProviderName(walletSession.provider):'连接钱包';document.querySelectorAll('[data-wallet-account]').forEach(node=>node.textContent=account);document.querySelectorAll('[data-wallet-label]').forEach(node=>node.textContent=label);if(walletSession)candidateDraft.account=walletSession.account;applyTranslations();refreshBPRecovery()}
const bpStatusMeta={0:['未评估',''],1:['合格','qualified'],2:['降级',''],3:['警告',''],4:['暂停','suspended'],5:['样本不足',''],6:['网络事件',''],7:['试运行','probation']};
function renderBPRecovery(state){
  const card=document.querySelector('[data-bp-recovery]');if(!card)return;
  if(!walletSession){card.innerHTML='<div class="bp-recovery-empty"><strong>BP 生产状态</strong><small>连接 BP 账户钱包后读取链上状态</small></div>';applyTranslations(card);return}
  if(!state){card.innerHTML='<div class="bp-recovery-empty"><strong>BP 生产状态</strong><small>正在读取链上状态…</small></div>';applyTranslations(card);return}
  if(state.error){card.innerHTML=`<div class="bp-recovery-empty"><strong>链上状态读取失败</strong><small>${escapeHtml(state.error)}</small></div><button class="primary-button" type="button" data-action="refresh-bp-status">刷新状态</button>`;applyTranslations(card);return}
  if(!state.supported||!state.recoverySupported){card.innerHTML='<div class="bp-recovery-empty"><strong>BP 生产状态</strong><small>当前合约尚未支持 BP 自助恢复</small></div>';applyTranslations(card);return}
  if(!state.producer){card.innerHTML=`<div class="bp-recovery-empty"><strong>当前账户未注册为 BP</strong><small>${escapeHtml(state.account)}</small></div>`;applyTranslations(card);return}
  const status=Number(state.performance?.status??0),meta=bpStatusMeta[status]||bpStatusMeta[0];
  const currentEpoch=Number(state.currentEpoch||0),suspendedUntil=Number(state.performance?.suspended_until_epoch||0);
  const remaining=Math.max(0,suspendedUntil-currentEpoch),canResume=status===4&&remaining===0;
  const streak=Number(state.performance?.probation_missed_streak??state.currentStats?.trailing_missed_streak??0),suspensions=Number(state.performance?.suspension_count||0);
  const button=status===4?`<button class="primary-button" type="button" data-action="resume-producer" ${canResume?'':'disabled'}>${canResume?'恢复生产':`冷却期尚未结束 · ${remaining} Epoch`}</button>`:'';
  card.innerHTML=`<div class="bp-recovery-head"><span><h2>BP 生产状态</h2><small class="bp-recovery-account">${escapeHtml(state.account)}</small></span><b class="bp-status ${meta[1]}">${meta[0]}</b></div><div class="bp-recovery-grid"><span><small>暂停次数</small><strong>${suspensions}</strong></span><span><small>当前 Epoch</small><strong>${currentEpoch}</strong></span><span><small>连续漏块</small><strong>${streak} / 12</strong></span></div><ul class="bp-recovery-rules"><li>恢复后先进入试运行，不会直接视为合格。</li><li>试运行期间连续漏掉 12 个分配槽位会立即再次暂停。</li><li>再次暂停的冷却期按 6、12、24、48 小时递增，最高 48 小时。</li></ul>${button}`;
  applyTranslations(card);
}
async function refreshBPRecovery(){
  const request=++bpRecoveryRequest;bpRecoveryState=null;renderBPRecovery(null);if(!walletSession)return;
  try{const state=await loadBPAccount(walletSession.account);if(request!==bpRecoveryRequest)return;bpRecoveryState=state;renderBPRecovery(state)}catch(error){if(request!==bpRecoveryRequest)return;bpRecoveryState={error:String(error?.message||error)};renderBPRecovery(bpRecoveryState)}
}
function confirmResumeProducer(){
  if(!walletSession){openWalletSheet();return}
  if(!bpRecoveryState||Number(bpRecoveryState.performance?.status)!==4||Number(bpRecoveryState.currentEpoch)<Number(bpRecoveryState.performance?.suspended_until_epoch)){showToast('冷却期尚未结束');return}
  openSheet(`<h2 id="sheet-title">确认恢复生产</h2><p class="sheet-subtitle">需要 BP 账户 active 权限签名</p><div class="sign-summary"><div><span>网络</span><strong>${escapeHtml(networkName())}</strong></div><div><span>账户</span><strong>${escapeHtml(walletSession.account)}@${escapeHtml(walletSession.permission)}</strong></div><div><span>Action</span><strong>flon::resumeprod</strong></div><div><span>当前 Epoch</span><strong>${Number(bpRecoveryState.currentEpoch||0)}</strong></div></div><p class="sign-warning">交易成功后进入试运行，排班更新后才会重新获得出块槽位。试运行期间连续漏掉 12 个分配槽位会立即再次暂停。</p><label class="resume-confirm"><input type="checkbox" data-resume-confirm> 我确认节点已在线并可持续签署区块</label><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">取消</button><button class="primary-button" data-action="resume-producer-sign" disabled>签名并进入试运行</button></div>`);
}
async function submitResumeProducer(target){
  if(!walletSession)return;target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  try{const result=await transact(walletSession,[{account:'flon',name:'resumeprod',data:{producer:walletSession.account}}]),id=transactionId(result);openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">恢复交易已广播</h2><p>已进入试运行 · ${escapeHtml(networkName())}</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);await refreshBPRecovery()}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'签名并进入试运行':'Sign and enter probation';showToast(String(error?.message||error))}
}
function openWalletSheet(){if(!walletSession){openSheet(`<h2 id="sheet-title">钱包连接</h2><p class="sheet-subtitle">${isHuFuApp()?'使用 HuFu 钱包连接':'使用 HuFu 或 Anchor 钱包连接'}</p><div class="wallet-connect-card"><span class="avatar">FL</span><div><strong>FullOn Network</strong><small>${networkName()}</small></div></div><p class="sign-warning">普通浏览器将显示 Anchor 二维码；HuFu 内会直接请求当前账户。钱包只负责账户授权与交易签名，DApp 不接触私钥。</p><div class="sheet-actions one"><button class="primary-button" data-action="connect-wallet">连接钱包</button></div>`);return}openSheet(`<h2 id="sheet-title">钱包连接</h2><p class="sheet-subtitle">${walletProviderName(walletSession.provider)}</p><div class="sign-summary"><div><span>账户</span><strong>${escapeHtml(walletSession.account)}@${escapeHtml(walletSession.permission)}</strong></div><div><span>网络</span><strong>${escapeHtml(networkName())}</strong></div><div><span>Chain ID</span><strong class="truncate-value">${escapeHtml(walletSession.chainId)}</strong></div></div><div class="sheet-actions one"><button class="secondary-button danger-button" data-action="disconnect-wallet">断开连接</button></div>`)}
function walletErrorMessage(error){const code=String(error?.message||error);if(/expired transaction/i.test(code))return currentLanguage==='zh-CN'?'交易在广播前已过期，请重新检查并签名。':'The transaction expired before broadcast. Please review and sign again.';const zh={WALLET_CHAIN_ID_MISMATCH:'钱包网络与当前站点不一致，请在 HuFu 中切换到对应网络',WALLET_CHAIN_UNCONFIRMED:'无法确认 HuFu 当前网络，请切换到对应 FullOn 网络后重试',RPC_CHAIN_ID_MISMATCH:'RPC Chain ID 配置错误',RPC_TIMEOUT:'链上 RPC 连接超时',HUFU_NETWORK_TIMEOUT:'HuFu 网络查询超时',HUFU_TRANSACTION_TIMEOUT:'HuFu 注入式签名窗口未打开，请确认钱包网络后重试',HUFU_IFRAME_TRANSACTION_TIMEOUT:'HuFu 内嵌签名窗口未打开，请退出当前 DApp 后重新进入再试',IFRAME_SESSION_EXPIRED:'HuFu 内嵌会话已失效，请退出当前 DApp 后重新进入',CHAIN_TIME_STALE:'节点区块时间异常或同步已停滞，请等待网络恢复后重试',HUFU_ACCOUNT_TIMEOUT:'HuFu 账户选择超时',HUFU_ACCOUNT_UNAVAILABLE:'未获取到 HuFu 账户',HUFU_PROVIDER_UNAVAILABLE:'未检测到 HuFu 钱包',ACCOUNT_CHANGED:'HuFu 当前账户已变化，请重新连接'};const en={WALLET_CHAIN_ID_MISMATCH:'The wallet network does not match this site. Switch to the corresponding network in HuFu.',WALLET_CHAIN_UNCONFIRMED:'Unable to confirm the HuFu network. Switch to the matching FullOn network and retry.',RPC_TIMEOUT:'The chain RPC timed out.',HUFU_NETWORK_TIMEOUT:'The HuFu network query timed out.',HUFU_TRANSACTION_TIMEOUT:'The injected HuFu signer did not open. Confirm the matching FullOn network and retry.',HUFU_IFRAME_TRANSACTION_TIMEOUT:'The embedded HuFu signer did not open. Close and reopen this DApp, then retry.',IFRAME_SESSION_EXPIRED:'The embedded HuFu session expired. Close and reopen this DApp.',CHAIN_TIME_STALE:'RPC block time is stale or incorrect. Retry after the network recovers.',ACCOUNT_CHANGED:'The active HuFu account changed. Reconnect the wallet.'};return currentLanguage==='zh-CN'?(zh[code]||`钱包连接失败：${code}`):(en[code]||`Wallet connection failed: ${code}`)}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function assetAmount(value){const amount=Number.parseFloat(String(value||'0'));return Number.isFinite(amount)?amount:0}
function decimalUnits(value){const text=String(value??'').trim();if(!/^\d+(?:\.\d{0,8})?$/.test(text))throw new Error('INVALID_FLON_AMOUNT');const [whole,fraction='']=text.split('.');return BigInt(whole)*100000000n+BigInt((fraction+'00000000').slice(0,8))}
function assetUnits(value){const match=String(value||'0').trim().match(/^(\d+(?:\.\d{0,8})?)/);return match?decimalUnits(match[1]):0n}
function formatUnits(units){const value=BigInt(units),whole=value/100000000n,fraction=(value%100000000n).toString().padStart(8,'0');return `${whole}.${fraction}`}
function formatVotes(value){const amount=Number(value||0)/100000000;if(amount>=1000000)return`${(amount/1000000).toFixed(2)}M`;if(amount>=1000)return`${(amount/1000).toFixed(1)}K`;return amount.toFixed(2)}
function formatVoteAsset(value){const digits=String(value||0).replace(/^0+(?=\d)/,'')||'0',padded=digits.padStart(9,'0');return`${padded.slice(0,-8)}.${padded.slice(-8)} FLON`}
function producerInitials(account){return String(account).split('.').map(part=>part[0]||'').join('').slice(0,2).toUpperCase()||'BP'}
function producerKey(producer){if(producer.producer_key)return producer.producer_key;return producer.producer_authority?.[1]?.keys?.[0]?.key||'—'}
function safePublicUrl(value){try{const url=new URL(String(value||''));return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}}
async function openProducerDetails(owner){
  const index=electionState?.producers.findIndex(item=>item.owner===owner)??-1,producer=index>=0?electionState.producers[index]:null;if(!producer)return;
  const url=safePublicUrl(producer.url);
  const accountUrl=accountExplorerUrl(runtimeConfig.network,producer.owner);
  const accountLabel=accountUrl?`<a href="${escapeHtml(accountUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--brand);text-decoration:underline;text-underline-offset:3px">${escapeHtml(producer.owner)}</a>`:escapeHtml(producer.owner);
  const [rewardResult,stakeResult]=await Promise.allSettled([loadProducerRewards(producer.owner),loadProducerStake(producer.owner)]);
  const rewards=rewardResult.status==='fulfilled'?rewardResult.value:null;
  const selfStake=stakeResult.status==='fulfilled'?stakeResult.value:'—';
  const baseUnclaimed=rewards?.baseUnclaimed||producer.unclaimed_rewards||'0.00000000 FLON';
  const gasUnclaimed=rewards?.gasUnclaimed||'0.00000000 FLON';
  const hasClaimable=Boolean(rewards?.hasClaimable);
  const location=Number(producer.location||0)>0?String(producer.location):'未设置';
  openSheet(`<h2 id="sheet-title">BP 详情</h2><p class="sheet-subtitle">${accountLabel} · #${index+1}</p><div class="sign-summary"><div><span>节点状态</span><strong>${escapeHtml(producer.status)}</strong></div><div><span>排名</span><strong>#${index+1}</strong></div><div><span>自身质押</span><strong>${escapeHtml(selfStake)}</strong></div><div><span>获得的总投票</span><strong>${escapeHtml(formatVoteAsset(producer.total_votes))}</strong></div><div><span>奖励分享比例</span><strong>${Number(producer.reward_shared_ratio||0)/100}%</strong></div><div><span>未领取出块奖励</span><strong>${escapeHtml(baseUnclaimed)}</strong></div><div><span>GAS 待领取奖励</span><strong>${escapeHtml(gasUnclaimed)}</strong></div><div><span>最后领取时间</span><strong>${escapeHtml(producer.last_claim_time||'—')}</strong></div><div><span>地区代码</span><strong>${escapeHtml(location)}</strong></div><div><span>链上数据源</span><strong>flon::producers / flon::bpstakes</strong></div></div><div class="profile-review"><strong>注册地址</strong>${url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`:`<small>${escapeHtml(producer.url||'—')}</small>`}<strong>出块公钥</strong><small class="full-value">${escapeHtml(producerKey(producer))}</small></div><div class="sheet-actions ${hasClaimable?'':'one'}"><button class="secondary-button" data-action="close-sheet">完成</button>${hasClaimable?`<button class="primary-button" data-action="bp-claim" data-producer="${escapeHtml(producer.owner)}">领取 BP 奖励</button>`:''}</div>`);
}
async function refreshElection(){
  try{
    const [election,production]=await Promise.all([
      loadElection(),
      loadNetworkProduction().catch(error=>({available:false,reason:'error',error:String(error?.message||error)})),
    ]);
    electionState=election;
    const selectList=document.querySelector('.select-list');
    if(selectList)selectList.innerHTML=electionState.producers.filter(producer=>producer.status!=='suspended').slice(0,51).map((producer,index)=>`<div class="select-node status-${escapeHtml(producer.status)}" data-producer="${escapeHtml(producer.owner)}" data-status="${escapeHtml(producer.status)}" data-name="${escapeHtml(`${producer.owner} ${producer.url||''}`.toLowerCase())}" data-rank="${index+1}" data-votes="${escapeHtml(producer.total_votes||0)}" data-share="${Number(producer.reward_shared_ratio||0)}"><label class="check-control" aria-label="选择 ${escapeHtml(producer.owner)}"><input type="checkbox"><span class="check"><svg><use href="#i-check"/></svg></span></label><span class="rank din">${String(index+1).padStart(2,'0')}</span><span class="node-logo ${producer.status==='active'?'green-logo':producer.status==='standby'?'amber-logo':'gray-logo'}">${escapeHtml(producerInitials(producer.owner))}</span><button class="node-main node-details-trigger" type="button" data-action="producer-details" data-producer="${escapeHtml(producer.owner)}"><strong>${escapeHtml(producer.owner)}</strong><small>${escapeHtml(producer.url||'No public URL')}</small><span><b>${escapeHtml(producer.status)}</b><em>分享 ${Number(producer.reward_shared_ratio||0)/100}%</em></span></button><button class="node-votes" type="button" data-action="producer-details" data-producer="${escapeHtml(producer.owner)}"><strong class="din">${escapeHtml(formatVotes(producer.total_votes))}</strong><small>有效票权</small><svg><use href="#i-chevron"/></svg></button><label class="node-allocation-field"><span>我的投票</span><span class="node-vote-control"><input class="node-vote-input din" type="number" min="0.00000001" step="0.00000001" inputmode="decimal" placeholder="0.00000000" data-node-votes disabled aria-label="${escapeHtml(producer.owner)} FLON votes"><b>FLON</b></span></label></div>`).join('');
    const standbyCount=electionState.producers.filter(producer=>producer.status==='standby').length;
    const summary=document.querySelector('.rank-summary');if(summary)summary.querySelector('strong').textContent=`${electionState.activeCount} / ${electionState.activeTarget}`;
    document.querySelectorAll('[data-active-count]').forEach(node=>node.textContent=String(electionState.activeCount));
    document.querySelectorAll('[data-active-target]').forEach(node=>node.textContent=`目标 ${electionState.activeTarget}`);
    document.querySelectorAll('[data-standby-count],[data-rank-standby]').forEach(node=>node.textContent=String(standbyCount));
    document.querySelectorAll('[data-candidate-count],[data-rank-candidates]').forEach(node=>node.textContent=String(electionState.producers.length));
    setText('[data-total-bp-stake]',formatOverviewAsset(electionState.totalBpStake));
    setText('[data-total-network-stake]',formatOverviewAsset(electionState.totalNetworkStake));
    const productionRate=document.querySelector('[data-production-rate]');
    const productionSource=document.querySelector('[data-production-source]');
    if(productionRate)productionRate.textContent=production.available?`${production.rate.toFixed(2)}%`:'—';
    if(productionSource)productionSource.textContent=production.available
      ?`Epoch ${production.epochId} · 链上统计`
      :(production.reason==='awaiting'||production.reason==='empty'?'等待完整 Epoch 封存':'链上出块统计暂不可用');
    setText('[data-epoch-active]',`${electionState.activeCount} / ${electionState.activeTarget}`);setText('[data-epoch-standby]',String(standbyCount));setText('[data-epoch-candidates]',String(electionState.producers.length));
    syncVotingSelection();updateAllocation();applyNodeFilters();applyTranslations();
  }catch(error){
    console.error('Failed to load election state',error);electionState=null;
    const selectList=document.querySelector('.select-list');
    if(selectList)selectList.innerHTML='<div class="inline-error">无法验证候选 BP，已禁用投票提交。</div>';
    updateAllocation();
  }
}
async function refreshVotingAccount(){
  if(walletSession){
    const [accountState,bpRewards]=await Promise.all([
      loadVotingAccount(walletSession.account),
      loadProducerRewards(walletSession.account).catch(error=>({error:String(error?.message||error)}))
    ]);
    votingState=accountState;
    profileBPRewards=bpRewards;
  }else{
    votingState={epochTiming:await loadEpochTiming(),hasPendingVote:false};
    profileBPRewards=null;
  }
  renderVotingAccount();syncVotingSelection();updateAllocation();
}
function chainTimeMs(){const value=governanceState?.chainInfo?.head_block_time;return value?Date.parse(String(value).endsWith('Z')?value:`${value}Z`):Date.now()}
function proposalEffectiveStatus(proposal){return effectiveProposalPhase(proposal,chainTimeMs())}
function governanceActionFor(proposal){
  const id=Number(proposal.proposal_id);return governanceAction(proposal,{endorsed:governanceState?.endorsements?.has(id),voted:governanceState?.ballots?.has(id),now:chainTimeMs()});
}
function proposalCard(proposal){
  const id=Number(proposal.proposal_id),meta=DAO_STATUS_META[Number(proposal.status)]||['未知','closed'],phase=proposalEffectiveStatus(proposal),action=governanceActionFor(proposal);
  const forAmount=assetAmount(proposal.for_votes),againstAmount=assetAmount(proposal.against_votes),abstainAmount=assetAmount(proposal.abstain_votes),total=forAmount+againstAmount+abstainAmount,forPercent=total>0?Math.round(forAmount/total*100):0;
  return `<article class="proposal-item" data-status="${escapeHtml(phase)}"><button class="proposal-open" type="button" data-action="dao-details" data-proposal-id="${id}"><div><span class="status ${escapeHtml(meta[1])}">${escapeHtml(meta[0])}</span><span class="proposal-id">#${id} · ${escapeHtml(proposal.proposal_type)}</span><time>${escapeHtml(String(proposal.created_at||''))}</time></div><h3>${escapeHtml(proposal.title)}</h3><p>${escapeHtml(proposal.summary)}</p>${total>0?`<div class="vote-result"><small><b>赞成 ${forPercent}%</b><em>${escapeHtml(formatOverviewAsset(proposal.for_votes))} / ${escapeHtml(formatOverviewAsset(proposal.against_votes))}</em></small><div class="progress"><i style="width:${forPercent}%"></i></div></div>`:''}</button>${action?`<footer><span>${Number(proposal.endorsement_count||0)} 人附议</span><button type="button" data-action="${action.action}" data-governance-action="${escapeHtml(action.name||'')}" data-proposal-id="${id}"><em>${escapeHtml(action.label)}</em></button></footer>`:`<footer><span>${Number(proposal.endorsement_count||0)} 人附议</span></footer>`}</article>`;
}
function setGovernanceAttention(visible){const dot=document.querySelector('[data-governance-dot]');if(dot)dot.hidden=!visible}
function renderGovernance(){
  const list=document.querySelector('.proposal-list'),preview=document.querySelector('[data-governance-preview]');if(!list||!preview)return;
  if(!governanceState?.supported){setGovernanceAttention(false);list.innerHTML='<div class="inline-error">无法验证 dao.gov ABI，治理交易已禁用。</div>';preview.innerHTML='<div class="inline-error">DAO 治理状态不可用</div>';return}
  const configured=Boolean(governanceState.config),proposals=governanceState.proposals||[];
  const counts=proposalCounts(proposals,chainTimeMs());
  setGovernanceAttention(configured&&proposals.some(proposal=>Boolean(governanceActionFor(proposal))));
  setText('[data-dao-endorsement]',String(counts.endorsement));setText('[data-dao-voting]',String(counts.voting));setText('[data-dao-execution]',String(counts.execution));
  setText('[data-governance-summary]',configured?`${proposals.length} 个链上提案 · 总治理权 ${formatOverviewAsset(governanceState.global?.total_power||'0.00000000 GLON')}`:'治理参数尚未配置');
  const create=document.querySelector('[data-action="create-proposal"]');if(create)create.disabled=!configured;
  if(!configured){list.innerHTML='<div class="inline-error">dao.gov 已部署，但治理参数尚未配置。配置完成前不能发起提案。</div>';preview.innerHTML='<div class="inline-error">治理参数尚未配置</div>';applyTranslations();return}
  list.innerHTML=proposals.length?proposals.map(proposalCard).join(''):'<div class="empty-state">尚无链上提案</div>';
  preview.innerHTML=proposals.length?proposalCard(proposals[0]):'<div class="empty-state">尚无链上提案</div>';
  applyTranslations();
}
async function refreshGovernance(){
  try{governanceState=await loadGovernance(walletSession?.account||'');renderGovernance()}catch(error){console.error('Failed to load DAO governance',error);governanceState=null;setGovernanceAttention(false);const list=document.querySelector('.proposal-list');if(list)list.innerHTML=`<div class="inline-error">链上治理数据读取失败：${escapeHtml(String(error?.message||error))}</div>`}
}
function findProposal(id){return governanceState?.proposals?.find(item=>Number(item.proposal_id)===Number(id))||null}
function proposalPolicy(id){return governanceState?.policySnapshots?.find(item=>Number(item.proposal_id)===Number(id))||null}
function governanceExecutableRules(){
  const rules=enabledAllowlist(governanceState?.allowlist);
  if(!governanceState?.riskSupported)return rules;
  const policies=new Map((governanceState.actionPolicies||[]).filter(row=>row.enabled===true||Number(row.enabled)===1).map(row=>[`${row.contract}::${row.action_name}`,Number(row.risk_level)]));
  return rules.filter(rule=>policies.has(`${rule.contract}::${rule.action}`)).map(rule=>({...rule,riskLevel:policies.get(`${rule.contract}::${rule.action}`)}));
}
function openProposalDetails(id){
  const proposal=findProposal(id);if(!proposal)return;const policy=proposalPolicy(id),action=governanceActionFor(proposal),forum=safePublicUrl(proposal.discussion_uri),metadata=safePublicUrl(proposal.metadata_uri);
  openSheet(`<h2 id="sheet-title">${escapeHtml(proposal.title)}</h2><p class="sheet-subtitle">#${proposal.proposal_id} · ${escapeHtml((DAO_STATUS_META[Number(proposal.status)]||['未知'])[0])}</p><div class="sign-summary"><div><span>提案人</span><strong>${escapeHtml(proposal.proposer)}</strong></div><div><span>提案类型</span><strong>${escapeHtml(proposal.proposal_type)}</strong></div>${policy?`<div><span>风险等级</span><strong>L${Number(policy.risk_level)}</strong></div><div><span>最低全网票权</span><strong>${escapeHtml(policy.min_total_power||'待激活')}</strong></div><div><span>Quorum / 通过率 / 绝对支持</span><strong>${Number(policy.quorum_bps||0)/100}% / ${Number(policy.approval_bps||0)/100}% / ${Number(policy.min_support_bps||0)/100}%</strong></div>`:''}<div><span>附议</span><strong>${Number(proposal.endorsement_count||0)}</strong></div><div><span>赞成</span><strong>${escapeHtml(proposal.for_votes)}</strong></div><div><span>反对</span><strong>${escapeHtml(proposal.against_votes)}</strong></div><div><span>弃权</span><strong>${escapeHtml(proposal.abstain_votes)}</strong></div><div><span>拟议变更</span><strong>${proposal.actions?.length||0}</strong></div></div><p class="proposal-summary">${escapeHtml(proposal.summary)}</p><div class="profile-review">${metadata?`<strong>提案文档</strong><a href="${escapeHtml(metadata)}" target="_blank" rel="noopener noreferrer">${escapeHtml(metadata)}</a>`:''}${forum?`<strong>社区讨论</strong><a href="${escapeHtml(forum)}" target="_blank" rel="noopener noreferrer">${escapeHtml(forum)}</a>`:'<strong>社区讨论</strong><small>尚未关联论坛讨论</small>'}</div><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">关闭</button>${action?`<button class="primary-button" data-action="${action.action}" data-governance-action="${escapeHtml(action.name||'')}" data-proposal-id="${proposal.proposal_id}">${escapeHtml(action.label)}</button>`:''}</div>`);
}
function openCreateProposal(){
  if(!walletSession){openWalletSheet();return}if(!governanceState?.config){showToast('治理参数尚未配置');return}
  const rules=governanceExecutableRules(),executable=rules.length>0;
  openSheet(`<h2 id="sheet-title">发起治理提案</h2><p class="sheet-subtitle">信号提案表达社区意见；可执行提案通过后只执行创建时锁定的白名单 action。</p><form class="wizard-form" data-proposal-form><fieldset class="proposal-type-picker"><legend>提案类型</legend><label><input type="radio" name="proposalType" value="signal" checked><span><strong>文本 / 信号提案</strong><small>表达社区意见，不执行链上 action</small></span><i aria-hidden="true"></i></label><label class="${executable?'':'is-disabled'}"><input type="radio" name="proposalType" value="parameter" ${executable?'':'disabled'}><span><strong>可执行参数提案</strong><small>${executable?'通过后执行提交时锁定的白名单 action':'白名单为空，暂不可用'}</small></span><i aria-hidden="true"></i></label></fieldset><label><span>标题</span><input name="title" maxlength="128" required></label><label><span>摘要</span><textarea name="summary" maxlength="1024" rows="5" required></textarea></label><label><span>提案文档 URI</span><input name="metadataUri" type="url" maxlength="512" placeholder="https://…" required></label><label><span>社区讨论 URI</span><input name="discussionUri" type="url" maxlength="512" placeholder="https://forum…"></label><section class="proposal-actions-editor" data-proposal-actions hidden><header><strong>拟议变更</strong><button type="button" data-action="dao-add-proposal-action">+ 添加 action</button></header><div data-proposal-action-list></div><p class="field-note">配置类操作会自动填入链上当前值，请只修改希望变更的字段。提交提案后，操作与参数将被锁定，投票期间不能替换。</p></section><p class="field-note">提案正文保存在公开文档或去中心化存储，链上保存内容哈希和 URI；论坛链接在附议期结束后冻结。</p></form><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">取消</button><button class="primary-button" data-action="dao-propose-sign">检查并签名</button></div>`);
}
const governanceActionLabels={
  'dao.gov::setallow':['管理执行白名单','Manage execution allowlist'],
  'dao.gov::setconfig':['更新治理参数','Update governance settings'],
  'dao.gov::setriskcfg':['配置治理风险等级','Configure governance risk tier'],
  'dao.gov::setactrisk':['设置 action 风险等级','Assign action risk tier'],
  'dao.treasury::pay':['财政付款','Treasury payment'],
  'dao.treasury::release':['释放预留预算','Release reserved budget'],
  'dao.treasury::reserve':['预留财政预算','Reserve treasury budget'],
  'dao.treasury::closegrant':['关闭财政拨款','Close treasury grant'],
  'dao.treasury::setasset':['设置财政资产','Configure treasury asset'],
  'flon.did::addvendor':['添加 DID 服务商','Add DID vendor'],
  'flon.did::chgvendor':['更新 DID 服务商','Update DID vendor'],
  'flon.xchain::addchain':['添加跨链网络','Add cross-chain network'],
  'flon.xchain::addcoin':['添加跨链资产','Add cross-chain asset'],
  'flon.xchain::addchaincoin':['关联跨链网络与资产','Link cross-chain network and asset'],
  'flon.xchain::setchcoinfee':['调整跨链资产费率','Update cross-chain asset fee'],
  'flon::setbpquorum':['调整 Active BP 席位','Update Active BP seats'],
  'flon::setbpstake':['BP 自质押与解锁期设置','BP self-stake and unlock settings'],
  'flon::setgasrwcfg':['调整 GAS 奖励参数','Update GAS reward settings']
};
function governanceActionLabel(key){const labels=governanceActionLabels[key];return labels?labels[currentLanguage==='zh-CN'?0:1]:key}
function proposalActionRow(){
  const rules=governanceExecutableRules(),options=rules.map(rule=>{const key=`${rule.contract}::${rule.action}`,risk=rule.riskLevel?` · L${rule.riskLevel}`:'';return`<option value="${escapeHtml(key)}">${escapeHtml(governanceActionLabel(key)+risk)}</option>`}).join(''),first=rules[0],technical=first?`${first.contract}::${first.action}`:'';
  return `<article class="proposal-action-row"><label><span>${currentLanguage==='zh-CN'?'执行操作':'Operation'}</span><select name="targetAction" required>${options}</select></label><p class="action-technical" data-action-technical>${escapeHtml(technical)}</p><div class="abi-action-fields" data-abi-action-fields><p class="field-note">正在读取 action ABI…</p></div><p class="action-size-status" data-action-size-status hidden></p><button type="button" class="danger-button" data-action="dao-remove-proposal-action">移除此 action</button></article>`;
}
const governanceFieldLabels={
  'flon::setbpstake':{
    enforce_schedule:['是否在排班中强制执行自质押门槛','Enforce self-stake requirement in scheduling'],
    min_self_stake:['最低 BP 自质押','Minimum BP self-stake'],
    unstake_delay_sec:['自质押解锁期（秒）','Self-stake unlock period (seconds)']
  }
};
function abiFieldControl(field,currentValue,actionKey=''){
  const required=field.optional?'':' required',labels=governanceFieldLabels[actionKey]?.[field.name],fieldLabel=labels?labels[currentLanguage==='zh-CN'?0:1]:field.name,label=`${escapeHtml(fieldLabel)} <small>${escapeHtml(field.type)}</small>`;
  if(field.baseType==='bool'&&!field.array)return `<label class="abi-bool-field"><span>${label}</span><input type="checkbox" data-abi-field="${escapeHtml(field.name)}"${currentValue===true||Number(currentValue)===1?' checked':''}></label>`;
  if(field.array||field.structured){const value=currentValue==null?'':JSON.stringify(currentValue);return `<label><span>${label}</span><textarea data-abi-field="${escapeHtml(field.name)}" rows="3" spellcheck="false" placeholder="${field.array?'[]':'{}'}"${required}>${escapeHtml(value)}</textarea></label>`}
  if(field.baseType==='time_point'||field.baseType==='time_point_sec')return `<label><span>${label}</span><input type="datetime-local" data-abi-field="${escapeHtml(field.name)}"${required}></label>`;
  const inputmode=/^u?int|asset|float/.test(field.baseType)?' inputmode="decimal"':'',value=currentValue==null?'':` value="${escapeHtml(String(currentValue))}"`;
  return `<label><span>${label}</span><input type="text" data-abi-field="${escapeHtml(field.name)}" placeholder="${escapeHtml(field.baseType)}"${value}${inputmode}${required}></label>`;
}
async function governanceActionDefaults(contract,action){
  if(contract==='dao.gov'&&action==='setconfig')return governanceState?.config||null;
  if(contract==='dao.gov'&&action==='setallow'){
    const row=(governanceState?.allowlist||[]).find(item=>item.enabled===true||Number(item.enabled)===1);return row?{contract:row.contract,action_name:row.action_name,authorization_actor:row.authorization_actor,authorization_permission:row.authorization_permission,max_data_bytes:row.max_data_bytes,enabled:Boolean(Number(row.enabled))}:null;
  }
  return loadGovernanceActionDefaults(contract,action);
}
function requiresCurrentActionValues(contract,action){return['dao.gov::setconfig','dao.gov::setallow','flon::setbpquorum','flon::setbpstake','flon::setgasrwcfg'].includes(`${contract}::${action}`)}
async function contractAbi(contract){
  if(!contractAbiCache.has(contract))contractAbiCache.set(contract,loadContractAbi(contract).catch(error=>{contractAbiCache.delete(contract);throw error}));
  return contractAbiCache.get(contract);
}
async function renderProposalActionFields(row){
  const container=row?.querySelector('[data-abi-action-fields]'),target=row?.querySelector('[name="targetAction"]');if(!container||!target)return;
  const key=target.value,request=String(Date.now()+Math.random()),technical=row.querySelector('[data-action-technical]');row.dataset.abiRequest=request;row._abiFields=null;if(technical)technical.textContent=key;
  container.innerHTML='<p class="field-note">正在读取 action ABI…</p>';
  try{
    const [contract,action]=key.split('::'),[fields,defaults]=await Promise.all([contractAbi(contract).then(abi=>actionAbiFields(abi,action)),governanceActionDefaults(contract,action)]);if(row.dataset.abiRequest!==request)return;
    if(requiresCurrentActionValues(contract,action)&&!defaults)throw new Error('CURRENT_ACTION_VALUES_UNAVAILABLE');
    const actionNote=key==='flon::setbpstake'?`<p class="field-note">${currentLanguage==='zh-CN'?'解锁期按秒填写；21 天为 1814400 秒。新参数只影响生效后发起的退出，已有待退款记录不变。':'Enter the unlock period in seconds; 21 days is 1814400 seconds. The new value only affects unstake requests created after it takes effect; existing pending refunds are unchanged.'}</p>`:'';
    row._abiFields=fields;container.innerHTML=fields.length?`${defaults?`<p class="current-values-note">${currentLanguage==='zh-CN'?'已载入链上当前值':'Current on-chain values loaded'}</p>`:''}${fields.map(field=>abiFieldControl(field,defaults?.[field.name],key)).join('')}${actionNote}`:'<p class="field-note">此 action 不需要参数。</p>';applyTranslations(container);
  }catch(error){if(row.dataset.abiRequest!==request)return;const code=String(error?.message||error),message=code.includes('CURRENT_ACTION_VALUES_UNAVAILABLE')?'无法读取链上当前值，不能安全创建此配置提案。':`无法读取 action ABI：${code}`;container.innerHTML=`<p class="inline-error">${escapeHtml(message)}</p>`;applyTranslations(container)}
}
function scheduleProposalActionSizeCheck(row){
  clearTimeout(proposalActionChecks.get(row));proposalActionChecks.set(row,setTimeout(()=>void updateProposalActionSize(row),250));
}
async function updateProposalActionSize(row){
  const status=row?.querySelector('[data-action-size-status]'),target=row?.querySelector('[name="targetAction"]');if(!status||!target||!Array.isArray(row._abiFields))return;
  try{
    const [contract,action_name]=target.value.split('::'),data=await serializeGovernanceAction(contract,action_name,proposalActionArgs(row)),bytes=data.length/2,rule=governanceExecutableRules().find(item=>item.contract===contract&&item.action===action_name),limit=Math.min(Number(rule?.maxBytes||Infinity),Number(governanceState?.config?.max_action_bytes||Infinity)),ratio=bytes/limit;
    status.hidden=ratio<.8;status.className=`action-size-status ${ratio>1?'is-error':'is-warning'}`;status.textContent=ratio>1?(currentLanguage==='zh-CN'?'参数内容过长，请缩短后再提交。':'The action arguments are too long. Shorten them before submitting.'):(currentLanguage==='zh-CN'?'参数内容接近链上限制，请尽量精简。':'The action arguments are close to the on-chain limit. Consider shortening them.');
  }catch{status.hidden=true}
}
function proposalActionArgs(row){
  if(!Array.isArray(row._abiFields))throw new Error('ACTION_ABI_NOT_READY');
  return Object.fromEntries(row._abiFields.map(field=>{const input=[...row.querySelectorAll('[data-abi-field]')].find(element=>element.dataset.abiField===field.name);if(!input)throw new Error(`ACTION_ABI_FIELD_MISSING:${field.name}`);let raw=input.value;if((field.baseType==='time_point'||field.baseType==='time_point_sec')&&raw)raw=new Date(raw).toISOString().replace(/\.000Z$/,'');return[field.name,abiFieldValue(field,raw,input.checked)]}));
}
function syncProposalType(){
  const form=sheetContent.querySelector('[data-proposal-form]'),editor=form?.querySelector('[data-proposal-actions]'),list=form?.querySelector('[data-proposal-action-list]');if(!form||!editor||!list)return;
  const active=form.proposalType.value==='parameter';editor.hidden=!active;if(active&&!list.children.length){list.insertAdjacentHTML('beforeend',proposalActionRow());void renderProposalActionFields(list.lastElementChild)}
}
async function sha256Hex(value){const bytes=new TextEncoder().encode(value),digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
function humanDuration(seconds,zh){
  const value=Number(seconds);if(!Number.isFinite(value)||value<=0)return zh?'链上未配置':'Not configured on-chain';
  if(value%86400===0)return zh?`${value/86400} 天`:`${value/86400} days`;
  if(value%3600===0)return zh?`${value/3600} 小时`:`${value/3600} hours`;
  if(value%60===0)return zh?`${value/60} 分钟`:`${value/60} minutes`;
  return zh?`${value} 秒`:`${value} seconds`;
}
async function openHelpCenter(){
  const zh=currentLanguage==='zh-CN';
  openSheet(`<h2 id="sheet-title">${zh?'治理帮助中心':'Governance Help Center'}</h2><div class="loading-state"><i></i><span>${zh?'正在读取链上参数…':'Loading on-chain parameters…'}</span></div>`);
  let parameters=null;try{parameters=await loadChainGovernanceParameters()}catch(error){console.error('Failed to load chain governance parameters',error)}
  const rewardEpochSeconds=parameters?.rewardEpochSlots?parameters.rewardEpochSlots/2:null,gasEpochSeconds=parameters?.gasRewardConfig?.epoch_slots?Number(parameters.gasRewardConfig.epoch_slots)/2:null,governanceConfig=governanceState?.config;
  const parameterRows=[
    [zh?'奖励与投票 Epoch':'Reward and voting epoch',humanDuration(rewardEpochSeconds,zh),'flon::rewardplans'],
    [zh?'GAS 奖励 Epoch':'GAS reward epoch',humanDuration(gasEpochSeconds,zh),'flon::gasrewcfg'],
    [zh?'Active BP 目标席位':'Target Active BP seats',parameters?.activeBpTarget??(zh?'链上未配置':'Not configured on-chain'),'flon::electconfig'],
    [zh?'最多投票节点':'Maximum voted BPs','30','flon::votealloc'],
    [zh?'撤票退款冷却期':'Vote refund cooldown',humanDuration(runtimeConfig.voteRefundDelaySeconds,zh),'flon::voterefund'],
    [zh?'提案附议期':'Proposal endorsement period',humanDuration(governanceConfig?.endorsement_seconds,zh),'dao.gov::config'],
    [zh?'投票延迟期':'Voting delay',humanDuration(governanceConfig?.voting_delay_seconds,zh),'dao.gov::config'],
    [zh?'正式投票期':'Formal voting period',humanDuration(governanceConfig?.voting_seconds,zh),'dao.gov::config'],
    ['Timelock',humanDuration(governanceConfig?.timelock_seconds,zh),'dao.gov::config'],
    [zh?'执行宽限期':'Execution grace period',humanDuration(governanceConfig?.execution_grace_seconds,zh),'dao.gov::config']
  ];
  const riskRows=(governanceState?.riskConfigs||[]).filter(row=>row.enabled===true||Number(row.enabled)===1).sort((a,b)=>Number(a.risk_level)-Number(b.risk_level));
  const riskTable=riskRows.length?`<div class="help-parameter-grid">${riskRows.map(row=>`<span><small>L${Number(row.risk_level)} · ${zh?'最低全网票权':'minimum network power'}</small><strong>${escapeHtml(row.min_total_power)}</strong><code>Q ${Number(row.quorum_bps)/100}% · ${zh?'通过':'approval'} ${Number(row.approval_bps)/100}% · ${zh?'绝对赞成':'absolute support'} ${Number(row.min_support_bps)/100}%</code></span>`).join('')}</div>`:`<p>${zh?'当前合约尚未配置 L1–L4 风险策略。未分类的可执行 action 不应进入投票。':'The contract has no L1-L4 risk policies yet. Unclassified executable actions must not enter voting.'}</p>`;
  openSheet(`<h2 id="sheet-title">${zh?'治理帮助中心':'Governance Help Center'}</h2><p class="sheet-subtitle">${zh?'了解节点投票、DAO 决策、Epoch 与奖励领取':'Learn node voting, DAO decisions, epochs, and reward claims'}</p><div class="help-sections">
    <details open><summary>${zh?'FLON、GLON 与治理权':'FLON, GLON, and governance power'}</summary><p>${zh?'用户锁定 FLON 参与节点投票，并获得等额、不可转让的 GLON。GLON 用于衡量 DAO 治理权，不是支付代币；提案与投票不会转走或消耗 GLON。':'Users lock FLON for node voting and receive an equal amount of non-transferable GLON. GLON measures DAO governance power; proposals and votes do not transfer or consume it.'}</p></details>
    <details open><summary>${zh?'当前链上基本参数':'Current on-chain parameters'}</summary><p>${zh?'以下数值从当前网络的合约状态表实时读取。FLON 每个区块槽位为 0.5 秒，Epoch 时长由链上 epoch_slots × 0.5 秒计算；治理提案的各阶段使用独立时长，不等同于奖励 Epoch。':'These values are read live from the current network contract tables. Each FLON block slot is 0.5 seconds, so an epoch lasts epoch_slots × 0.5 seconds. Governance proposal phases use separate durations and are not reward epochs.'}</p><div class="help-parameter-grid">${parameterRows.map(([label,value,source])=>`<span><small>${escapeHtml(String(label))}</small><strong>${escapeHtml(String(value))}</strong><code>${escapeHtml(source)}</code></span>`).join('')}</div></details>
    <details><summary>${zh?'节点投票与 Epoch':'Node voting and epochs'}</summary><p>${zh?'每个 BP 可以分配不同数量的 FLON，最多选择 30 个候选节点。变更先写入 pending 状态，在下一 Epoch 边界生效。Epoch 是确定排名、快照、绩效和奖励归属的链上时间窗口。':'Each BP can receive a different FLON allocation, with up to 30 candidates. Changes enter pending state and take effect at the next epoch boundary. An epoch is the on-chain window for ranking, snapshots, performance, and rewards.'}</p></details>
    <details open><summary>${zh?'提案生命周期与 Timelock':'Proposal lifecycle and Timelock'}</summary><p>${zh?'完整流程为：创建提案 → 附议期 → 投票延迟期 → 正式投票期 → 结果确认 → Timelock → 执行宽限期 → 已执行或已过期。附议决定提案能否进入投票；正式投票决定是否获得社区授权；Timelock 则发生在提案已经通过之后，是执行前不可跳过的安全等待期。':'The full flow is: proposal creation → endorsement → voting delay → formal voting → finalization → Timelock → execution grace period → executed or expired. Endorsement decides whether a proposal advances, formal voting grants or rejects community authorization, and Timelock is the mandatory safety delay after approval but before execution.'}</p><p>${zh?'附议不会自动成为赞成票。投票延迟期用于阅读提案并确定 activate 时的 GLON 快照；Timelock 期间不能继续投票或替换已冻结 action。到期后，任何账户都可在执行宽限期内 permissionless 调用 execute，超时则由 expire 标记过期。':'An endorsement never becomes a For vote automatically. The voting delay provides review time and fixes the GLON snapshot at activation. During Timelock, voting is closed and frozen actions cannot be replaced. Once it expires, any account may permissionlessly call execute during the grace period; otherwise expire marks the proposal expired.'}</p><p>${zh?'测试网可使用 5–30 分钟的短周期快速验证状态机；页面显示 5 分钟属于测试配置。主网建议附议 2–3 天、投票延迟 12–24 小时、正式投票 3–7 天、普通参数 Timelock 2 天、高风险操作 5–7 天、执行宽限期 7 天。主网应单独治理配置，不能直接沿用测试网参数。':'Testnet may use short 5–30 minute periods to validate the state machine; a displayed 5-minute value is a test configuration. Suggested mainnet starting values are 2–3 days for endorsement, 12–24 hours for voting delay, 3–7 days for voting, 2 days of Timelock for ordinary parameters, 5–7 days for high-risk actions, and a 7-day execution grace period. Mainnet must be configured separately through governance.'}</p><p>${zh?'activate、finalize、queue、execute 和 expire 都是 permissionless 操作；触发者只能推进状态，不能修改提案创建时已经冻结的 action 或参数。':'activate, finalize, queue, execute, and expire are permissionless. A caller may only advance state and cannot modify actions or parameters frozen when the proposal was created.'}</p></details>
    <details open><summary>${zh?'L1–L4 分级治理门槛':'L1-L4 governance safety tiers'}</summary><p>${zh?'每个可执行 action 都必须同时存在执行白名单和风险等级。activate 会检查该等级的最低全网 GLON 治理权并冻结规则；finalize 同时检查参与率、赞成率和绝对赞成票。多个 action 采用最高风险等级。setriskcfg 与 setactrisk 只能由 flon 权限修改，DAO 不能降低自己的安全门槛。':'Every executable action needs both an execution allowlist rule and a risk tier. activate checks the tier minimum network GLON power and freezes its rules; finalize checks turnout, approval, and absolute support. A multi-action proposal uses its highest tier. Only flon authority may call setriskcfg or setactrisk, so the DAO cannot lower its own safety floor.'}</p>${riskTable}</details>
    <details><summary>${zh?'奖励不会自动空投':'Rewards are claimed, not airdropped'}</summary><p>${zh?'BP 基础出块奖励和 GAS 奖励先形成链上待领取记录。奖励可以跨 Epoch 累积，不会因为没有立即领取而丢失。投票人奖励由受益账户本人调用 voter.reward::claimrewards。':'BP block and GAS rewards first become on-chain claim records. They accumulate across epochs and do not expire merely because they were not claimed immediately. Voters claim through voter.reward::claimrewards.'}</p></details>
    <details><summary>epoch.keeper</summary><p>${zh?'epoch.keeper 对应的 Keeper 程序会定期触发 Epoch 关闭和 BP 奖励领取等 permissionless 操作。Keeper 不持有 BP 私钥、不托管奖励，也不能更改收款账户；奖励始终支付给链上记录的 BP。':'The Keeper program associated with epoch.keeper periodically triggers permissionless operations such as epoch closing and BP reward claims. It does not hold BP keys, custody rewards, or change recipients; rewards always go to the BP recorded on-chain.'}</p><p>${zh?'Keeper 是便利设施，不是单点依赖。如果 Keeper 下线，BP 本人或任何用户都可以在本 DApp 手动调用 flon::claimrewards，代为触发后奖励仍直接进入 BP 账户。':'Keeper is a convenience, not a single point of failure. If it is offline, the BP or any user may manually call flon::claimrewards from this DApp; the reward still goes directly to the BP.'}</p></details>
    <details><summary>${zh?'签名前检查':'Before signing'}</summary><p>${zh?'核对网络、Chain ID、账户、合约、action、参数和收款人。帮助文档不构成交易授权；只有钱包确认页中的实际交易内容会被签名。':'Verify the network, Chain ID, account, contract, action, parameters, and recipient. Help content is not transaction authorization; only the actual transaction shown by the wallet is signed.'}</p></details>
  </div><div class="sheet-actions"><button class="secondary-button" data-action="help-voting">${zh?'查看节点投票':'Open node voting'}</button><button class="primary-button" data-action="bp-claim">${zh?'手动触发 BP 领取':'Trigger BP claim'}</button></div>`);
}
async function submitProposal(target){
  if(!walletSession)return;const form=sheetContent.querySelector('[data-proposal-form]');if(!form?.reportValidity())return;
  const proposal_type=form.proposalType.value,title=form.title.value.trim(),summary=form.summary.value.trim(),metadata_uri=form.metadataUri.value.trim(),discussion_uri=form.discussionUri.value.trim();target.disabled=true;
  try{
    const actions=[];
    if(proposal_type==='parameter')for(const row of form.querySelectorAll('.proposal-action-row')){
      const [contract,action_name]=row.querySelector('[name="targetAction"]').value.split('::'),args=proposalActionArgs(row);
      const data=await serializeGovernanceAction(contract,action_name,args);actions.push({contract,action_name,data});
    }
    const bytes=actions.length?validateFrozenActions(actions,enabledAllowlist(governanceState.allowlist),governanceState.config):0;
    const content_hash=await sha256Hex(JSON.stringify({title,summary,metadata_uri,discussion_uri,actions}));
    const result=await transact(walletSession,[{account:'dao.gov',name:'syncpower',data:{voter:walletSession.account}},{account:'dao.gov',name:'propose',data:{proposer:walletSession.account,proposal_type,title,summary,content_hash,metadata_uri,discussion_uri,actions}}]),id=transactionId(result);
    openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">提案交易已广播</h2><p>${actions.length} 个执行操作已锁定 · ${bytes} bytes</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);await refreshGovernance();
  }catch(error){target.disabled=false;const code=String(error?.message||error);showToast(code.includes('ACTION_ABI_NOT_READY')?'Action ABI 尚未加载完成':code.includes('INVALID_ABI_FIELD')||code.includes('REQUIRED_ABI_FIELD')?'请检查 action 参数':code.includes('ACTION_DATA_TOO_LARGE')||code.includes('TOTAL_ACTION_DATA_TOO_LARGE')?(currentLanguage==='zh-CN'?'Action 参数内容过长，请缩短后再提交。':'The action arguments are too long. Shorten them before submitting.'):walletErrorMessage(error))}
}
function openVoteProposal(id){const proposal=findProposal(id);if(!proposal)return;if(!walletSession){openWalletSheet();return}openSheet(`<h2 id="sheet-title">参与投票</h2><p class="sheet-subtitle">#${proposal.proposal_id} · ${escapeHtml(proposal.title)}</p><div class="proposal-choice-grid"><button data-action="dao-vote-sign" data-proposal-id="${id}" data-choice="1">赞成<small>支持本提案</small></button><button data-action="dao-vote-sign" data-proposal-id="${id}" data-choice="0">反对<small>拒绝本提案</small></button><button data-action="dao-vote-sign" data-proposal-id="${id}" data-choice="2">弃权<small>计入 quorum</small></button></div>`)}
async function submitDaoAction(target,name,id,data={}){if(!walletSession){openWalletSheet();return}target.disabled=true;try{const result=await transact(walletSession,[{account:'dao.gov',name,data:{...data,proposal_id:Number(id)}}]),tx=transactionId(result);showToast(tx?`交易已广播 ${tx.slice(0,10)}…`:'交易已广播');closeSheet();await refreshGovernance()}catch(error){target.disabled=false;showToast(walletErrorMessage(error))}}
function setText(selector,value){document.querySelectorAll(selector).forEach(node=>node.textContent=value)}
function formatCountdown(milliseconds){
  const seconds=Math.max(0,Math.ceil(milliseconds/1000));
  const hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),remaining=seconds%60;
  return [hours,minutes,remaining].map(value=>String(value).padStart(2,'0')).join(':');
}
function updateEpochCountdown(){
  const label=document.querySelector('[data-vote-epoch-label]'),value=document.querySelector('[data-vote-epoch-countdown]');
  if(!label||!value)return;
  const timing=epochCountdownAnchor;
  if(!timing){label.textContent=currentLanguage==='zh-CN'?'Epoch 时间不可用':'Epoch timing unavailable';value.textContent='--:--:--';return}
  const estimatedChainNow=timing.chainHeadMs+(Date.now()-timing.observedAt);
  const remaining=timing.boundaryMs-estimatedChainNow;
  if(remaining<=0&&timing.hasPendingVote){label.textContent=`Epoch ${timing.targetEpoch} · ${currentLanguage==='zh-CN'?'等待 Epoch 结算':'Awaiting epoch settlement'}`;value.textContent='';return}
  label.textContent=timing.hasPendingVote?`${currentLanguage==='zh-CN'?'距离 Epoch 生效':'Until epoch activation'} ${timing.targetEpoch}`:`${currentLanguage==='zh-CN'?'距离下一 Epoch':'Until next epoch'} ${timing.targetEpoch}`;
  value.textContent=formatCountdown(remaining);
}
function startEpochCountdown(timing,hasPendingVote){
  if(epochCountdownTimer)window.clearInterval(epochCountdownTimer);
  epochCountdownAnchor=timing?{...timing,hasPendingVote,observedAt:Date.now()}:null;
  updateEpochCountdown();
  epochCountdownTimer=window.setInterval(updateEpochCountdown,1000);
}
function renderVotingAccount(){
  const connected=Boolean(walletSession&&votingState);
  const glon=connected?votingState.glon:'— GLON';
  const glonDisplay=connected?formatOverviewAsset(glon):'— GLON';
  const nodeVoteStake=connected?votingState.nodeVoteStake:'— FLON';
  const nodeVoteDisplay=connected?formatOverviewAsset(nodeVoteStake):'— FLON';
  const producers=connected?(votingState.pendingProducers||votingState.effectiveProducers||[]):[];
  const rewards=connected?votingState.unclaimedRewards:'— FLON';
  const rewardsDisplay=connected?formatOverviewAsset(rewards):'— FLON';
  const owned=connected?assetUnits(nodeVoteStake)+assetUnits(votingState.flon):0n;
  setText('[data-glon-balance]',glonDisplay);setText('[data-profile-glon]',glonDisplay);setText('[data-vote-stake]',connected?nodeVoteStake:'— FLON');setText('[data-vote-liquid]',connected?votingState.flon:'— FLON');setText('[data-vote-owned]',connected?`${formatUnits(owned)} FLON`:'— FLON');
  setText('[data-voting-stake]',connected?nodeVoteDisplay.replace(/\s+FLON$/,''):'—');setText('[data-voted-bps]',connected?String(producers.length):'—');setText('[data-profile-votes]',connected?`${producers.length} 个 BP`:'— 个 BP');
  setText('[data-unclaimed-rewards]',rewardsDisplay);setText('[data-profile-rewards]',rewardsDisplay);setText('[data-profile-claimable]',connected?rewardsDisplay:'连接钱包后读取');
  const hasClaimableRewards=connected&&assetAmount(rewards)>0;
  setText('[data-claimable-summary]',connected?(hasClaimableRewards?`链上已结算 ${rewardsDisplay}`:'暂无已结算奖励可领取'):'连接钱包后读取链上已结算余额');
  setText('[data-claim-action-label]',connected?(hasClaimableRewards?'领取':'不可领取'):'领取');
  document.querySelectorAll('[data-action="claim"]').forEach(button=>{button.disabled=connected&&!hasClaimableRewards;button.classList.toggle('is-unavailable',connected&&!hasClaimableRewards)});
  const voteRefund=votingState?.refund,refundReady=voteRefund&&Date.now()>=refundReadyAt(voteRefund);
  setText('[data-refund-status]',!connected?'连接钱包后读取':voteRefund?(refundReady?'退款已可领取':'撤票退款处理中'):'增加、撤回或领取');
  const bpClaimButton=document.querySelector('[data-profile-bp-claim]');
  const bpClaimable=connected&&profileBPRewards?.hasClaimable===true;
  const bpClaimStatus=!connected?'连接钱包后读取':profileBPRewards?.error?.includes('BP_NOT_FOUND')?'当前账户未注册为 BP':profileBPRewards?.error?'奖励状态不可用':!profileBPRewards?.supported?'当前合约未启用 BP 奖励领取':bpClaimable?`${formatOverviewAsset(profileBPRewards.baseUnclaimed)} + ${formatOverviewAsset(profileBPRewards.gasUnclaimed)}`:'暂无可领取的 BP 奖励';
  setText('[data-profile-bp-claimable]',bpClaimStatus);
  if(bpClaimButton){bpClaimButton.disabled=!bpClaimable;bpClaimButton.classList.toggle('is-unavailable',!bpClaimable)}
  setText('[data-vote-source]',connected?'投票后生成等额不可转让 GLON，用于DAO治理':'连接钱包后读取链上 FLON 投票本金');
  applyTranslations();
  startEpochCountdown(votingState?.epochTiming,votingState?.hasPendingVote===true);
}
function syncVotingSelection(){
  if(!votingState)return;
  const source=votingState.pendingAllocations||votingState.effectiveAllocations;
  const producers=votingState.pendingProducers||votingState.effectiveProducers||[];
  const totalUnits=BigInt(votingState.pending?.votes??votingState.voter?.votes??0);
  const fallback=producers.length?totalUnits/BigInt(producers.length):0n;
  const allocations=new Map((source||producers.map(producer=>({producer,votes:fallback.toString()}))).map(item=>[item.producer,BigInt(item.votes||0)]));
  document.querySelectorAll('.select-node').forEach(label=>{const checkbox=label.querySelector('input[type="checkbox"]'),amount=label.querySelector('[data-node-votes]'),units=allocations.get(label.dataset.producer)||0n;if(checkbox)checkbox.checked=units>0n;if(amount){amount.disabled=units<=0n;amount.value=units>0n?formatVoteInput(units):''}});
}
function candidateSteps(){return `<div class="wizard-steps" aria-label="注册进度">${['资格检查','公开资料','节点配置','确认注册'].map((label,index)=>`<span class="${candidateStep===index+1?'is-active':''} ${candidateStep>index+1?'is-done':''}"><i>${candidateStep>index+1?'✓':index+1}</i><small>${label}</small></span>`).join('')}</div>`}
function saveCandidateStep(){const form=sheetContent.querySelector('[data-candidate-form]');if(!form)return true;const keyField=form.elements.producerKey;if(keyField){const validKey=/^(FU|EOS)[1-9A-HJ-NP-Za-km-z]{50,}$/.test(keyField.value.trim());keyField.setCustomValidity(validKey?'':'请输入有效的 FU 或 EOS Base58 出块公钥')}if(!form.reportValidity())return false;new FormData(form).forEach((value,key)=>candidateDraft[key]=String(value).trim());return true}
async function prepareCandidate(){
  if(!walletSession){openWalletSheet();return}
  openSheet(`<h2 id="sheet-title">申请 BP 竞选</h2><p class="sheet-subtitle">正在读取链上注册状态…</p><div class="loading-state"><i></i><span>${escapeHtml(walletSession.account)}</span></div>`);
  try{
    const state=await loadBPAccount(walletSession.account);candidateDraft.account=walletSession.account;
    if(!state.supported){candidateChainState={loading:false,registered:false,producer:null,error:'UNSUPPORTED_ABI'};openSheet(`<h2 id="sheet-title">主网节点竞选尚未启用</h2><p class="sheet-subtitle">${escapeHtml(networkName())}</p><p class="inline-error">当前主网 flon ABI 尚未包含 regproducer 和 producers 状态表。请先完成主网合约升级。</p><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);return}
    candidateChainState={loading:false,registered:Boolean(state.producer),producer:state.producer,selfStakeSupported:state.selfStakeSupported,selfStakeConfig:state.selfStakeConfig,selfStake:state.selfStake,error:''};
    if(state.producer){candidateDraft.website=state.producer.url||candidateDraft.website;candidateDraft.region=String(state.producer.location??candidateDraft.region);candidateDraft.producerKey=typeof state.producer.producer_key==='string'?state.producer.producer_key:candidateDraft.producerKey;candidateDraft.shareRatio=String(Number(state.producer.reward_shared_ratio||0)/100)}
    openCandidateWizard(1);
  }catch(error){candidateChainState={loading:false,registered:false,producer:null,error:String(error?.message||error)};openSheet(`<h2 id="sheet-title">申请 BP 竞选</h2><p class="sheet-subtitle">链上资格检查失败</p><p class="inline-error">${escapeHtml(candidateChainState.error)}</p><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">取消</button><button class="primary-button" data-action="candidate">重试</button></div>`)}
}
function transactionId(value,depth=0){if(!value||depth>4)return'';if(typeof value==='string'&&/^[0-9a-f]{64}$/i.test(value))return value;if(typeof value!=='object')return'';for(const key of ['transaction_id','transactionId','processed','payload','result']){const found=transactionId(value[key],depth+1);if(found)return found}return''}
async function submitCandidate(target){
  if(!walletSession){openWalletSheet();return}
  target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  const action={account:'flon',name:'regproducer',data:{producer:walletSession.account,producer_key:candidateDraft.producerKey,url:candidateDraft.website,location:Number(candidateDraft.region),reward_shared_ratio:Math.round(Number(candidateDraft.shareRatio)*100)}};
  try{const result=await transact(walletSession,[action]),id=transactionId(result);openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">注册交易已广播</h2><p>${candidateChainState.registered?'更新 BP 资料':'申请 BP 竞选'} · ${escapeHtml(networkName())}</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sign-summary"><div><span>账户</span><strong>${escapeHtml(walletSession.account)}</strong></div><div><span>Action</span><strong>flon::regproducer</strong></div><div><span>奖励分享</span><strong>${escapeHtml(candidateDraft.shareRatio)}%</strong></div></div><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`)}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'签名并注册':'Sign and register';showToast(walletErrorMessage(error))}
}
async function openBPStakeSheet(){
  if(!walletSession){openWalletSheet();return}
  try{await refreshVotingAccount()}catch(error){showToast(`读取 FLON 余额失败：${String(error?.message||error)}`);return}
  const minimum=candidateChainState.selfStakeConfig?.min_self_stake||'0.00000000 FLON';
  const current=candidateChainState.selfStake?.staked||'0.00000000 FLON';
  const missing=Math.max(0,assetAmount(minimum)-assetAmount(current));
  const missingInput=missing.toFixed(8).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
  openSheet(`<h2 id="sheet-title">补足 BP 自质押</h2><p class="sheet-subtitle">仅申请 BP 的账户需要此操作</p><div class="sign-summary"><div><span>账户</span><strong>${escapeHtml(walletSession.account)}</strong></div><div><span>可用 FLON</span><strong>${escapeHtml(formatOverviewAsset(votingState?.flon||'0.00000000 FLON'))}</strong></div><div><span>当前 BP 自质押</span><strong>${escapeHtml(formatOverviewAsset(current))}</strong></div><div><span>最低门槛</span><strong>${escapeHtml(formatOverviewAsset(minimum))}</strong></div></div><form class="wizard-form" data-bp-stake-form><label><span>质押数量</span><input name="amount" type="number" min="0.00000001" step="0.00000001" value="${missingInput}" required></label><p class="field-note">这是 BP 候选人保证金，不是 Voter 节点投票本金。退出 BP 自质押遵循链上 21 天解锁期。</p></form><div class="sheet-actions"><button class="secondary-button" data-action="candidate">返回资格检查</button><button class="primary-button" data-action="bp-stake-sign">在 HuFu 中确认</button></div>`);
}
async function submitBPStake(target){
  if(!walletSession)return;
  const form=sheetContent.querySelector('[data-bp-stake-form]');if(!form||!form.reportValidity())return;
  const amount=Number(form.elements.amount.value),available=assetAmount(votingState?.flon);
  if(!Number.isFinite(amount)||amount<=0){showToast('请输入有效质押数量');return}
  if(amount>available){showToast(`可用余额不足，当前为 ${votingState?.flon||'0.00000000 FLON'}`);return}
  const quantity=formatFlon(amount);target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  try{const result=await transact(walletSession,[{account:'flon',name:'stakebp',data:{owner:walletSession.account,quantity}}]),id=transactionId(result);openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">BP 自质押交易已广播</h2><p>${escapeHtml(quantity)}</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sheet-actions one"><button class="primary-button" data-action="candidate">重新检查资格</button></div>`)}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'在 HuFu 中确认':'Confirm in HuFu';showToast(walletErrorMessage(error))}
}
function openCandidateWizard(step=1){
  candidateStep=step;
  let body='';
  if(step===1){
    const minimum=candidateChainState.selfStakeConfig?.min_self_stake||'未配置';
    const current=candidateChainState.selfStake?.staked||'0.00000000 FLON';
    const qualified=candidateChainState.selfStakeSupported&&assetAmount(current)>=assetAmount(minimum);
    body=`<p class="field-note role-note">本向导仅用于申请成为 BP。普通 Voter 无需 BP 自质押，可直接增加投票本金并给节点投票。</p><div class="eligibility-list"><article><i>✓</i><span><strong>账户存在</strong><small>${escapeHtml(candidateDraft.account)}@${escapeHtml(walletSession?.permission||'active')}</small></span></article><article><i>✓</i><span><strong>${candidateChainState.registered?'已注册，可更新资料':'尚未注册为 BP'}</strong><small>flon::producers</small></span></article><article class="${qualified?'':'is-pending'}"><i>${qualified?'✓':'i'}</i><span><strong>BP 自质押门限</strong><small>${candidateChainState.selfStakeSupported?`已质押 ${escapeHtml(current)} / 最低 ${escapeHtml(minimum)}`:'当前链上合约尚未启用 BP 自质押表'}</small></span></article></div><p class="sign-warning">${qualified?'BP 自质押已达标，可以继续填写候选节点资料。':'仅 BP 候选人需要通过 flon::stakebp 补足自质押；普通 Voter 不受此门槛限制。'}</p><div class="sheet-actions"><button class="secondary-button" data-action="go-vote">我是 Voter，去投票</button>${qualified?'<button class="primary-button" data-action="candidate-next">下一步</button>':'<button class="primary-button" data-action="bp-stake">补足 BP 自质押</button>'}</div>`;
  }
  if(step===2)body=`<form class="wizard-form" data-candidate-form><label><span>节点名称</span><input name="nodeName" required maxlength="50" value="${escapeHtml(candidateDraft.nodeName||'')}"></label><label><span>官方网站</span><input name="website" type="url" required maxlength="511" placeholder="https://example.com" value="${escapeHtml(candidateDraft.website)}"></label><label><span>X 账号</span><input name="xAccount" required maxlength="32" placeholder="@example" value="${escapeHtml(candidateDraft.xAccount)}"></label><label><span>国家或地区</span><select name="region" required><option value="702" ${candidateDraft.region==='702'?'selected':''}>Singapore · 702</option><option value="156" ${candidateDraft.region==='156'?'selected':''}>China · 156</option><option value="344" ${candidateDraft.region==='344'?'selected':''}>Hong Kong · 344</option><option value="392" ${candidateDraft.region==='392'?'selected':''}>Japan · 392</option><option value="840" ${candidateDraft.region==='840'?'selected':''}>United States · 840</option></select></label><label><span>状态页</span><input name="statusUrl" type="url" required placeholder="https://status.example.com" value="${escapeHtml(candidateDraft.statusUrl)}"></label></form><div class="sheet-actions"><button class="secondary-button" data-action="candidate-back">上一步</button><button class="primary-button" data-action="candidate-next">下一步</button></div>`;
  if(step===3)body=`<form class="wizard-form" data-candidate-form><label><span>出块公钥</span><textarea name="producerKey" required minlength="50" rows="3" placeholder="FU…">${escapeHtml(candidateDraft.producerKey)}</textarea><small>用于签署区块，不应填写私钥</small></label><label><span>P2P 节点地址</span><input name="p2pEndpoint" required placeholder="p2p.example.com:9876" value="${escapeHtml(candidateDraft.p2pEndpoint)}"></label><label><span>API 节点地址</span><input name="apiEndpoint" type="url" required placeholder="https://api.example.com" value="${escapeHtml(candidateDraft.apiEndpoint)}"></label><label><span>投票人奖励分享比例 <b data-share-output>${escapeHtml(candidateDraft.shareRatio)}%</b></span><input name="shareRatio" type="range" min="0" max="100" step="1" value="${escapeHtml(candidateDraft.shareRatio)}"></label><p class="field-note">提交后，该比例将用于后续 Epoch 奖励分配。</p></form><div class="sheet-actions"><button class="secondary-button" data-action="candidate-back">上一步</button><button class="primary-button" data-action="candidate-next">检查并签名</button></div>`;
  if(step===4){const ratio=Math.round(Number(candidateDraft.shareRatio)*100);body=`<div class="sign-summary"><div><span>网络</span><strong>${escapeHtml(networkName())}</strong></div><div><span>账户</span><strong>${escapeHtml(candidateDraft.account)}@${escapeHtml(walletSession?.permission||'active')}</strong></div><div><span>Action</span><strong>flon::regproducer</strong></div><div><span>producer_key</span><strong class="truncate-value">${escapeHtml(candidateDraft.producerKey)}</strong></div><div><span>url</span><strong>${escapeHtml(candidateDraft.website)}</strong></div><div><span>location</span><strong>${escapeHtml(candidateDraft.region)}</strong></div><div><span>reward_shared_ratio</span><strong>${ratio} (${escapeHtml(candidateDraft.shareRatio)}%)</strong></div></div><div class="profile-review"><strong>${escapeHtml(candidateDraft.nodeName)}</strong><small>${escapeHtml(candidateDraft.xAccount)} · ${escapeHtml(candidateDraft.statusUrl)}</small><small>P2P ${escapeHtml(candidateDraft.p2pEndpoint)}</small><small>API ${escapeHtml(candidateDraft.apiEndpoint)}</small></div><p class="sign-warning">合约参数与填写内容一致后，再请求 HuFu 签名。注册成功时 flon.system 会同步注册 voter.reward。X、状态页、P2P 和 API 地址不会进入当前 regproducer 状态表，需后续元数据服务保存。</p><div class="sheet-actions"><button class="secondary-button" data-action="candidate-back">上一步</button><button class="primary-button" data-action="candidate-sign">${candidateChainState.registered?'更新 BP 资料':'签名并注册'}</button></div>`}
  openSheet(`<h2 id="sheet-title">申请 BP 竞选</h2><p class="sheet-subtitle">${candidateStep}/4 · ${['资格检查','公开资料','节点配置','确认注册'][candidateStep-1]}</p>${candidateSteps()}${body}`);
}

function draftVoteAllocations(){return [...document.querySelectorAll('.select-node')].filter(label=>label.querySelector('input[type="checkbox"]')?.checked).map(label=>{const input=label.querySelector('[data-node-votes]');return{producer:label.dataset.producer,votes:decimalUnits(input?.value||'0')}}).sort((a,b)=>a.producer.localeCompare(b.producer))}
function renderVoteChanges(changes){return `<div class="vote-change-review"><div class="vote-change-head"><strong>${translateText('投票变更')}</strong><span>${translateText('变更前')} → ${translateText('变更后')}</span></div>${changes.map(item=>`<div class="vote-change-row is-${item.type}"><span><b>${escapeHtml(item.producer)}</b><em>${translateText(item.type==='added'?'新增':item.type==='removed'?'移除':'修改')}</em></span><span class="din"><s>${formatUnits(item.previous)}</s><i>→</i><strong>${formatUnits(item.next)} FLON</strong></span></div>`).join('')}</div>`}
function restoreVoteAllocations(allocations){const values=new Map(allocations.map(item=>[item.producer,BigInt(item.votes)]));document.querySelectorAll('.select-node').forEach(label=>{const checkbox=label.querySelector('input[type="checkbox"]'),input=label.querySelector('[data-node-votes]'),units=values.get(label.dataset.producer)||0n;if(checkbox)checkbox.checked=units>0n;if(input){input.disabled=units<=0n;input.value=units>0n?formatVoteInput(units):''}});updateAllocation()}
async function confirmVote(){
  if(!walletSession){openWalletSheet();return}
  if(!electionState){showToast('链上 BP 数据尚未就绪');return}
  let allocations;try{allocations=draftVoteAllocations()}catch{showToast('请输入最多 8 位小数的有效 FLON 票数');return}
  if(allocations.length>30){showToast('最多投票给 30 个 BP');return}
  if(allocations.some(item=>item.votes<=0n)){showToast('每个已选 BP 的票数必须大于 0');return}
  const draft=[...allocations];
  try{await refreshVotingAccount()}catch(error){showToast(`读取链上票权失败：${String(error?.message||error)}`);return}
  restoreVoteAllocations(draft);pendingVoteAllocations=draft;
  const changes=voteAllocationChanges(currentVoteAllocations(),draft);
  if(!changes.length){pendingVoteAllocations=null;showToast('当前分配尚未修改');return}
  const total=draft.reduce((sum,item)=>sum+item.votes,0n),current=assetUnits(votingState?.nodeVoteStake),available=assetUnits(votingState?.flon),owned=current+available,delta=total-current;
  if(total>owned){showToast(`分配合计不能超过账户拥有的 ${formatUnits(owned)} FLON`);return}
  if(delta<0n&&votingState?.refund){showToast('已有一笔撤票退款待领取，暂时不能减少投票总额');return}
  if(!votingState?.voteAllocationSupported){showToast('当前链上合约尚未启用逐 BP 票数分配');return}
  const actionNames=[delta>0n?'flon::addvote':delta<0n?'flon::subvote':null,'flon::votealloc'].filter(Boolean).join(' + ');
  openSheet(`<h2 id="sheet-title">确认节点投票</h2><p class="sheet-subtitle">请核对每个 BP 的票数，一次签名后将在下一 Epoch 生效</p><div class="sign-summary"><div><span>网络</span><strong>${escapeHtml(networkName())}</strong></div><div><span>账户</span><strong>${escapeHtml(walletSession.account)}@${escapeHtml(walletSession.permission)}</strong></div><div><span>Action</span><strong>${escapeHtml(actionNames)}</strong></div><div><span>选择 BP</span><strong>${draft.length} ${currentLanguage==='zh-CN'?'个':'BPs'}</strong></div><div><span>分配合计</span><strong>${formatUnits(total)} FLON</strong></div><div><span>账户拥有</span><strong>${formatUnits(owned)} FLON</strong></div></div>${renderVoteChanges(changes)}<p class="sign-warning">所有 BP 分配之和必须等于锁定投票本金，且不能超过账户拥有的 FLON。每 1 FLON 最多产生 1 票，不会复制放大。</p><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">取消</button><button class="primary-button" data-action="vote-sign">在 HuFu 中确认</button></div>`);
}
async function submitVote(target){
  if(!walletSession||!pendingVoteAllocations)return;const allocations=pendingVoteAllocations.map(item=>({...item})),total=allocations.reduce((sum,item)=>sum+item.votes,0n),current=assetUnits(votingState?.nodeVoteStake),delta=total-current,actions=[];
  if(delta>0n)actions.push({account:'flon',name:'addvote',data:{voter:walletSession.account,vote_staked:`${formatUnits(delta)} FLON`}});else if(delta<0n)actions.push({account:'flon',name:'subvote',data:{voter:walletSession.account,vote_staked:`${formatUnits(-delta)} FLON`}});
  actions.push({account:'flon',name:'votealloc',data:{voter:walletSession.account,allocations:allocations.map(item=>({producer:item.producer,votes:item.votes.toString()}))}});
  target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  try{const result=await transact(walletSession,actions),id=transactionId(result);const count=allocations.length;pendingVoteAllocations=null;openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">节点投票已广播</h2><p>${formatUnits(total)} FLON · ${count} 个 BP · 下一 Epoch 生效</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);await refreshVotingAccount()}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'在 HuFu 中确认':'Confirm in HuFu';showToast(walletErrorMessage(error))}
}
function formatFlon(value){return `${Number(value).toFixed(8)} FLON`}
function refundReadyAt(refund){
  if(!refund?.request_time)return 0;
  const value=String(refund.request_time);
  const timestamp=Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value)?value:`${value}Z`);
  return Number.isFinite(timestamp)?timestamp+Number(runtimeConfig.voteRefundDelaySeconds||259200)*1000:0;
}
function updateRefundCountdown(){
  const countdown=sheetContent.querySelector('[data-refund-countdown]'),claim=sheetContent.querySelector('[data-action="claim-vote-refund"]');
  if(!countdown||!votingState?.refund)return;
  const remaining=refundReadyAt(votingState.refund)-Date.now(),ready=remaining<=0;
  countdown.textContent=ready?(currentLanguage==='zh-CN'?'退款已可领取':'Refund ready to claim'):formatCountdown(remaining);
  if(claim){claim.disabled=!ready;claim.textContent=ready?(currentLanguage==='zh-CN'?'领取解锁 FLON':'Claim unlocked FLON'):(currentLanguage==='zh-CN'?'等待退款成熟':'Waiting for refund maturity')}
}
function startRefundCountdown(){
  if(refundCountdownTimer)window.clearInterval(refundCountdownTimer);
  updateRefundCountdown();
  refundCountdownTimer=window.setInterval(updateRefundCountdown,1000);
}
async function openStakeSheet(){
  if(!walletSession){openWalletSheet();return}
  try{await refreshVotingAccount()}catch(error){showToast(`读取投票本金失败：${String(error?.message||error)}`);return}
  if(!votingState?.stakeSupported){showToast('当前链上合约不支持调整投票本金');return}
  const liquid=votingState.flon||'0.00000000 FLON',staked=votingState.nodeVoteStake||'0.00000000 FLON';
  const refund=votingState.refund,readyAt=refundReadyAt(refund),ready=refund&&Date.now()>=readyAt;
  openSheet(`<h2 id="sheet-title">投票本金与退款</h2><p class="sheet-subtitle">质押 FLON 生成等额不可转让 GLON</p><div class="sign-summary"><div><span>可用 FLON</span><strong>${escapeHtml(liquid)}</strong></div><div><span>已投本金</span><strong>${escapeHtml(staked)}</strong></div><div><span>治理凭证</span><strong>${escapeHtml(votingState.glon)}</strong></div></div>${refund?`<div class="pending-note"><svg><use href="#i-clock"/></svg><span><strong>撤票退款 ${escapeHtml(refund.vote_staked)}</strong><small>预计可领取时间 ${escapeHtml(new Date(readyAt).toLocaleString())}</small><small class="epoch-countdown"><span>解锁倒计时</span><b class="din" data-refund-countdown>${ready?'退款已可领取':formatCountdown(readyAt-Date.now())}</b></small></span></div>`:''}<form class="wizard-form" data-stake-form><label><span>操作</span><select name="operation"><option value="add">增加投票本金</option><option value="sub" ${refund?'disabled':''}>撤回投票本金并申请退款</option></select></label><label><span>金额</span><div class="stake-amount-field"><input name="amount" type="number" min="0.00000001" step="0.00000001" inputmode="decimal" required placeholder="0.00000000"><button type="button" data-action="stake-max" hidden>Max</button></div></label><p class="field-note">增加本金在下一 Epoch 计入节点票权；撤票会立即销毁等量 GLON，BP 票权在下一 Epoch 移除，FLON 在 72 小时冷却期后领取。每个账户同一时间只能有一笔待领取退款。</p></form><div class="sheet-actions ${refund?'':'one'}">${refund?`<button class="secondary-button" data-action="claim-vote-refund" ${ready?'':'disabled'}>${ready?'领取解锁 FLON':'等待退款成熟'}</button>`:''}<button class="primary-button" data-action="stake-sign">检查并签名</button></div>`);
  if(refund)startRefundCountdown();
}
async function submitStake(target){
  if(!walletSession||!votingState)return;
  const form=sheetContent.querySelector('[data-stake-form]');if(!form||!form.reportValidity())return;
  const operation=form.elements.operation.value,amount=Number(form.elements.amount.value);
  const maximum=operation==='add'?assetAmount(votingState.flon):assetAmount(votingState.nodeVoteStake);
  if(!Number.isFinite(amount)||amount<=0||amount>maximum){showToast(operation==='add'?'可用 FLON 余额不足':'投票本金不足');return}
  const actionName=operation==='add'?'addvote':'subvote',quantity=formatFlon(amount);
  target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  try{const result=await transact(walletSession,[{account:'flon',name:actionName,data:{voter:walletSession.account,vote_staked:quantity}}]),id=transactionId(result);openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">投票本金交易已广播</h2><p>${escapeHtml(actionName)} · ${escapeHtml(quantity)}</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><p class="sign-warning">新的节点排名票权将在下一 Epoch 生效。</p><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);await refreshVotingAccount()}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'检查并签名':'Review and sign';showToast(walletErrorMessage(error))}
}
async function claimVoteRefund(target){
  if(!walletSession||!votingState?.refund)return;
  target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  try{const result=await transact(walletSession,[{account:'flon',name:'voterefund',data:{owner:walletSession.account}}]),id=transactionId(result);openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">撤票退款已领取</h2><p>${escapeHtml(votingState.refund.vote_staked)}</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);await refreshVotingAccount()}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'领取退款':'Claim refund';showToast(walletErrorMessage(error))}
}
async function confirmClaimRewards(){
  if(!walletSession){openWalletSheet();return}
  try{await refreshVotingAccount()}catch(error){showToast(`读取奖励失败：${String(error?.message||error)}`);return}
  if(assetAmount(votingState?.unclaimedRewards)<=0){showToast('暂无已结算奖励可领取');return}
  openSheet(`<h2 id="sheet-title">领取投票奖励</h2><p class="sheet-subtitle">奖励不会自动空投；未领取余额持续累积，不会因错过 Epoch 丢失</p><div class="sign-summary"><div><span>链上已结算</span><strong>${escapeHtml(votingState?.unclaimedRewards||'0.00000000 FLON')}</strong></div><div><span>合约</span><strong>voter.reward</strong></div><div><span>Action</span><strong>claimrewards</strong></div><div><span>领取账户</span><strong>${escapeHtml(walletSession.account)}</strong></div></div><p class="sign-warning">领取必须由当前受益账户本人签名，第三方不能代领。最终到账金额以交易执行结果为准。</p><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">稍后</button><button class="primary-button" data-action="claim-sign">确认签名</button></div>`);
}
async function submitClaimRewards(target){
  if(!walletSession)return;target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  try{const result=await transact(walletSession,[{account:'voter.reward',name:'claimrewards',data:{voter:walletSession.account}}]),id=transactionId(result);openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">奖励领取交易已广播</h2><p>${escapeHtml(walletSession.account)}</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);await refreshVotingAccount()}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'确认签名':'Confirm signature';showToast(String(error?.message||error))}
}
async function openBPClaimSheet(producer=''){
  if(!walletSession){openWalletSheet();return}
  const value=String(producer||walletSession.account||'').trim();
  openSheet(`<h2 id="sheet-title">BP 奖励领取</h2><p class="sheet-subtitle">当前账户可为自己或任意 BP 触发领取</p><form class="wizard-form" data-bp-claim-form><label><span>BP 收款账户</span><input name="producer" maxlength="12" pattern="[a-z1-5.]{1,12}" value="${escapeHtml(value)}" required></label><label><span>本次最多处理</span><select name="maxSteps"><option value="24">24 Epoch</option><option value="48">48 Epoch</option><option value="12">12 Epoch</option><option value="1">1 Epoch</option></select></label><p class="field-note">可由任意钱包代为触发。奖励始终直接支付给 BP，代触发账户不能更改收款人，也不会获得奖励。</p></form><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">取消</button><button class="primary-button" data-action="bp-claim-check">检查奖励</button></div>`);
}
async function checkBPClaim(target){
  if(!walletSession)return;
  const form=sheetContent.querySelector('[data-bp-claim-form]'),producer=String(form?.producer?.value||'').trim(),maxSteps=Number(form?.maxSteps?.value||24);
  if(!/^[a-z1-5.]{1,12}$/.test(producer)){showToast(currentLanguage==='zh-CN'?'请输入有效的 BP 账户名':'Enter a valid BP account name');return}
  target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'处理中…':'Processing…';
  try{
    const rewards=await loadProducerRewards(producer);
    if(!rewards.supported)throw new Error('CLAIM_UNSUPPORTED');
    openSheet(`<h2 id="sheet-title">确认代领</h2><p class="sheet-subtitle">flon::claimrewards</p><div class="sign-summary"><div><span>触发账户</span><strong>${escapeHtml(walletSession.account)}@${escapeHtml(walletSession.permission)}</strong></div><div><span>BP 收款账户</span><strong>${escapeHtml(producer)}</strong></div><div><span>基础奖励</span><strong>${escapeHtml(rewards.baseUnclaimed)}</strong></div><div><span>基础待领取记录</span><strong>${rewards.baseRows}</strong></div><div><span>GAS 奖励</span><strong>${escapeHtml(rewards.gasUnclaimed)}</strong></div><div><span>GAS 待领取记录</span><strong>${rewards.gasRows}</strong></div><div><span>本次最多处理</span><strong>${maxSteps}</strong></div></div><p class="sign-warning">${rewards.hasClaimable?'奖励始终直接支付给 BP，代触发账户不能更改收款人，也不会获得奖励。最终到账金额以交易执行结果为准。':'暂无可领取的 BP 奖励'}</p><div class="sheet-actions"><button class="secondary-button" data-action="bp-claim" data-producer="${escapeHtml(producer)}">返回</button><button class="primary-button" data-action="bp-claim-sign" data-producer="${escapeHtml(producer)}" data-max-steps="${maxSteps}" ${rewards.hasClaimable?'':'disabled'}>确认签名</button></div>`);
  }catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'检查奖励':'Check rewards';const code=String(error?.message||error);showToast(code.includes('BP_NOT_FOUND')?(currentLanguage==='zh-CN'?'未找到该 BP':'BP not found'):code.includes('CLAIM_UNSUPPORTED')?(currentLanguage==='zh-CN'?'当前合约尚未启用 BP 奖励领取':'BP reward claims are not enabled by the current contract'):code)}
}
async function submitBPClaim(target){
  if(!walletSession)return;
  const producer=String(target.dataset.producer||''),maxSteps=Number(target.dataset.maxSteps||24);
  target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  try{const result=await transact(walletSession,[{account:'flon',name:'claimrewards',data:{caller:walletSession.account,producer,max_steps:maxSteps}}]),id=transactionId(result);openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">BP 奖励领取交易已广播</h2><p>${escapeHtml(producer)}</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sign-summary"><div><span>触发账户</span><strong>${escapeHtml(walletSession.account)}</strong></div><div><span>BP 收款账户</span><strong>${escapeHtml(producer)}</strong></div></div><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);await refreshElection()}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'确认签名':'Confirm signature';showToast(walletErrorMessage(error))}
}

document.addEventListener('click',async event=>{
  const target=event.target.closest('button,[data-action]');if(!target)return;
  if(target.dataset.mobileVoteTab){setMobileVoteTab(target.dataset.mobileVoteTab);return}
  if(target.dataset.viewTarget){showView(target.dataset.viewTarget);if(target.dataset.viewTarget==='nodes')setNodeMode(target.dataset.nodeModeTarget||'directory')}
  if(target.dataset.nodeMode)setNodeMode(target.dataset.nodeMode);
  const action=target.dataset.action;
  if(action==='language-toggle'){const menu=document.querySelector('[data-language-menu]'),open=menu?.hidden!==false;if(menu)menu.hidden=!open;target.setAttribute('aria-expanded',String(open));return}
  if(target.dataset.languageOption){setLanguage(target.dataset.languageOption);return}
  if(action==='toggle-node-tools'){const tools=document.querySelector('[data-node-directory-tools],#node-directory-tools'),open=tools?.hidden!==false;if(tools)tools.hidden=!open;target.setAttribute('aria-expanded',String(open));const label=target.querySelector('[data-node-tools-label]');if(label)label.textContent=translateText(open?'收起筛选':'搜索与排序');return}
  if(action==='back')navigateBack();
  if(action==='toast')showToast(target.dataset.message||'操作已完成');
  if(action==='close-sheet')closeSheet();
  if(action==='network')showToast(`当前为 ${networkName()} · Chain ID ${runtimeConfig.chainId.slice(0,4)}…${runtimeConfig.chainId.slice(-3)}`);
  if(action==='help')await openHelpCenter();
  if(action==='help-voting'){closeSheet();showView('nodes');setNodeMode('vote')}
  if(action==='account')openWalletSheet();
  if(action==='connect-wallet'){
    target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'连接中…':'Connecting…';
    try{walletSession=await connectWallet();renderWallet();await Promise.all([refreshVotingAccount(),refreshGovernance()]);closeSheet();showToast(currentLanguage==='zh-CN'?'钱包已连接':'Wallet connected')}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'连接钱包':'Connect wallet';showToast(walletErrorMessage(error))}
  }
  if(action==='disconnect-wallet'){await disconnectWallet();walletSession=null;votingState=null;profileBPRewards=null;renderWallet();renderVotingAccount();syncVotingSelection();updateAllocation();closeSheet();await refreshGovernance();showToast(currentLanguage==='zh-CN'?'钱包已断开':'Wallet disconnected')}
  if(action==='clear-selection'){document.querySelectorAll('.select-node').forEach(label=>{const checkbox=label.querySelector('input[type="checkbox"]'),amount=label.querySelector('[data-node-votes]');if(checkbox)checkbox.checked=false;if(amount){amount.value='';amount.disabled=true}});updateAllocation();applyNodeFilters()}
  if(action==='producer-details')await openProducerDetails(target.dataset.producer);
  if(action==='sign-vote')await confirmVote();
  if(action==='vote-sign')await submitVote(target);
  if(action==='governance-unavailable')openSheet(`<h2 id="sheet-title">DAO治理尚未启用</h2><p class="sheet-subtitle">当前站点未配置可验证的治理合约 ABI 与部署地址</p><p class="sign-warning">提案、附议、正式投票、Timelock 和执行按钮已保持只读，不会请求钱包签名，也不会广播模拟交易。</p><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);
  if(action==='create-proposal')openCreateProposal();
  if(action==='dao-add-proposal-action'){
    const list=sheetContent.querySelector('[data-proposal-action-list]'),maximum=Number(governanceState?.config?.max_actions||0);
    if(list&&list.children.length<maximum){list.insertAdjacentHTML('beforeend',proposalActionRow());void renderProposalActionFields(list.lastElementChild)}else showToast(`单个提案最多 ${maximum} 个 action`);
  }
  if(action==='dao-remove-proposal-action')target.closest('.proposal-action-row')?.remove();
  if(action==='dao-propose-sign')await submitProposal(target);
  if(action==='dao-details')openProposalDetails(target.dataset.proposalId);
  if(action==='dao-vote')openVoteProposal(target.dataset.proposalId);
  if(action==='dao-vote-sign')await submitDaoAction(target,'castvote',target.dataset.proposalId,{voter:walletSession?.account,choice:Number(target.dataset.choice)});
  if(action==='dao-endorse'){
    if(!walletSession){openWalletSheet();return}
    target.disabled=true;
    try{await transact(walletSession,[{account:'dao.gov',name:'syncpower',data:{voter:walletSession.account}},{account:'dao.gov',name:'endorse',data:{endorser:walletSession.account,proposal_id:Number(target.dataset.proposalId)}}]);showToast('附议交易已广播');closeSheet();await refreshGovernance()}catch(error){target.disabled=false;showToast(walletErrorMessage(error))}
  }
  if(action==='dao-advance')await submitDaoAction(target,target.dataset.governanceAction,target.dataset.proposalId);
  if(action==='claim')await confirmClaimRewards();
  if(action==='claim-sign')await submitClaimRewards(target);
  if(action==='bp-claim')await openBPClaimSheet(target.dataset.producer);
  if(action==='bp-claim-check')await checkBPClaim(target);
  if(action==='bp-claim-sign')await submitBPClaim(target);
  if(action==='candidate')await prepareCandidate();
  if(action==='candidate-next'&&saveCandidateStep())openCandidateWizard(Math.min(4,candidateStep+1));
  if(action==='candidate-back'){saveCandidateStep();openCandidateWizard(Math.max(1,candidateStep-1))}
  if(action==='candidate-sign')await submitCandidate(target);
  if(action==='go-vote'){closeSheet();showView('nodes');setNodeMode('vote');await refreshVotingAccount()}
  if(action==='bp-stake')await openBPStakeSheet();
  if(action==='bp-stake-sign')await submitBPStake(target);
  if(action==='refresh-bp-status')await refreshBPRecovery();
  if(action==='resume-producer')confirmResumeProducer();
  if(action==='resume-producer-sign')await submitResumeProducer(target);
  if(action==='stake')await openStakeSheet();
  if(action==='stake-max'){
    const input=sheetContent.querySelector('[data-stake-form] [name="amount"]');
    if(input)input.value=formatUnits(assetUnits(votingState?.nodeVoteStake));
  }
  if(action==='stake-sign')await submitStake(target);
  if(action==='claim-vote-refund')await claimVoteRefund(target);
});
sheetContent.addEventListener('change',event=>{if(event.target?.name==='proposalType')syncProposalType();if(event.target?.name==='targetAction')void renderProposalActionFields(event.target.closest('.proposal-action-row'));if(event.target?.name==='operation'){const max=sheetContent.querySelector('[data-action="stake-max"]'),input=sheetContent.querySelector('[data-stake-form] [name="amount"]');if(max)max.hidden=event.target.value!=='sub';if(input)input.value=''}});
sheetContent.addEventListener('input',event=>{const row=event.target.closest?.('.proposal-action-row');if(row)scheduleProposalActionSizeCheck(row)});
overlay.addEventListener('click',closeSheet);
document.addEventListener('change',event=>{if(event.target.matches('.select-node input[type="checkbox"]')){const amount=event.target.closest('.select-node')?.querySelector('[data-node-votes]');if(amount){amount.disabled=!event.target.checked;if(!event.target.checked)amount.value='';else amount.focus()}updateAllocation();applyNodeFilters()}if(event.target.matches('[data-node-votes]')){try{const units=decimalUnits(event.target.value||'0');if(units>0n)event.target.value=formatVoteInput(units)}catch{}}if(event.target.matches('[data-node-sort]'))applyNodeFilters();if(event.target.matches('[data-resume-confirm]')){const button=sheetContent.querySelector('[data-action="resume-producer-sign"]');if(button)button.disabled=!event.target.checked}});
document.addEventListener('input',event=>{if(event.target.matches('[name="shareRatio"]')){const output=sheetContent.querySelector('[data-share-output]');if(output)output.textContent=`${event.target.value}%`}if(event.target.matches('[data-node-votes]'))updateAllocation()});
document.addEventListener('click',event=>{if(!event.target.closest('.top-language'))closeLanguageMenu()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeLanguageMenu()});

function selectedCount(){return [...document.querySelectorAll('.select-node input[type="checkbox"]:checked')].length}
function allocationTotal(){try{return draftVoteAllocations().reduce((sum,item)=>sum+item.votes,0n)}catch{return 0n}}
function canonicalAllocations(items){return(items||[]).map(item=>({producer:item.producer,votes:String(item.votes||0)})).filter(item=>BigInt(item.votes)>0n).sort((a,b)=>a.producer.localeCompare(b.producer)).map(item=>`${item.producer}:${item.votes}`).join('|')}
function currentVoteAllocations(){if(!votingState)return[];const source=votingState.pendingAllocations||votingState.effectiveAllocations;if(source)return source;const producers=votingState.pendingProducers||votingState.effectiveProducers||[],total=BigInt(votingState.pending?.votes??votingState.voter?.votes??0),fallback=producers.length?total/BigInt(producers.length):0n;return producers.map(producer=>({producer,votes:fallback.toString()}))}
function updateAllocation(){let allocations=[],valid=true;try{allocations=draftVoteAllocations()}catch{valid=false}const total=valid?allocations.reduce((sum,item)=>sum+item.votes,0n):0n,count=selectedCount(),owned=assetUnits(votingState?.nodeVoteStake)+assetUnits(votingState?.flon),remaining=owned-total,overLimit=valid&&total>owned,changes=valid?voteAllocationChanges(currentVoteAllocations(),allocations):[],changed=changes.length>0;document.querySelectorAll('.select-node').forEach(row=>row.classList.toggle('is-selected',row.querySelector('input[type="checkbox"]')?.checked===true));setText('[data-selected-count]',currentLanguage==='zh-CN'?`${count} 个 BP`:`${count} BPs`);setText('[data-per-node]',count?translateText('自定义'):'—');setText('[data-allocation-total]',`${formatUnits(total)} FLON`);setText('[data-vote-remaining]',walletSession?`${overLimit?'−':''}${formatUnits(overLimit?-remaining:remaining)} FLON`:'— FLON');const card=document.querySelector('.vote-summary-card');if(card)card.classList.toggle('is-over-limit',overLimit||!valid);setText('[data-vote-submit-hint]',translateText(!walletSession?'连接钱包后管理投票':!valid?'请输入最多 8 位小数的有效票数':overLimit?'分配总额超过账户可投 FLON':!changed?'当前分配尚未修改':'修改将在下一 Epoch 生效'));const confirm=document.querySelector('[data-action="sign-vote"]');if(confirm)confirm.disabled=!walletSession||!votingState||!valid||count>30||overLimit||!changed;const dock=document.querySelector('[data-mobile-vote-dock]');if(dock){dock.dataset.hasChanges=String(Boolean(walletSession&&votingState&&valid&&!overLimit&&changed));dock.hidden=!mobileVoteMedia.matches||mobileVoteTab!=='directory'||dock.dataset.hasChanges!=='true'}}
function applyNodeFilters(){const filter=document.querySelector('[data-node-filter].is-active')?.dataset.nodeFilter||'all',query=document.querySelector('[data-node-search]')?.value.trim().toLowerCase()||'',selectedOnly=document.querySelector('[data-node-selected-only]')?.classList.contains('is-active')===true,sort=document.querySelector('[data-node-sort]')?.value||'rank',list=document.querySelector('.select-list'),rows=[...document.querySelectorAll('.select-node')];rows.forEach(row=>{const selected=row.querySelector('input[type="checkbox"]')?.checked===true;row.hidden=(filter!=='all'&&row.dataset.status!==filter)||Boolean(query&&!row.dataset.name.includes(query))||(selectedOnly&&!selected)});rows.sort((a,b)=>{const aSelected=a.querySelector('input[type="checkbox"]')?.checked?1:0,bSelected=b.querySelector('input[type="checkbox"]')?.checked?1:0;if(sort==='selected'&&aSelected!==bSelected)return bSelected-aSelected;if(sort==='votes'){const av=BigInt(a.dataset.votes||0),bv=BigInt(b.dataset.votes||0);if(av!==bv)return av>bv?-1:1}if(sort==='share'){const delta=Number(b.dataset.share||0)-Number(a.dataset.share||0);if(delta)return delta}return Number(a.dataset.rank||0)-Number(b.dataset.rank||0)}).forEach(row=>list?.appendChild(row))}
document.querySelectorAll('[data-node-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-node-filter]').forEach(b=>b.classList.toggle('is-active',b===button));applyNodeFilters()}));
document.querySelector('[data-node-selected-only]')?.addEventListener('click',event=>{event.currentTarget.classList.toggle('is-active');applyNodeFilters()});
document.querySelector('[data-node-search]').addEventListener('input',applyNodeFilters);
document.querySelectorAll('[data-proposal-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-proposal-filter]').forEach(b=>b.classList.toggle('is-active',b===button));document.querySelectorAll('.proposal-item').forEach(card=>card.hidden=button.dataset.proposalFilter!=='all'&&card.dataset.status!==button.dataset.proposalFilter)}));

applyTranslations();
renderVotingAccount();
refreshElection();
refreshGovernance();
async function initializeWallet(){
  let session=await restoreWallet();
  if(!session&&isHuFuApp())session=await autoConnectHuFuWallet();
  walletSession=session;
  renderWallet();
  await Promise.all([refreshVotingAccount(),refreshGovernance()]);
}
initializeWallet().catch(error=>{
  walletSession=null;
  renderWallet();
  if(isHuFuApp())showToast(walletErrorMessage(error));
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')Promise.all([refreshVotingAccount(),refreshGovernance()]).catch(error=>console.error('Failed to refresh chain state',error))});
