import {autoConnectHuFuWallet,connectWallet,disconnectWallet,isHuFuApp,loadBPAccount,loadElection,loadEpochTiming,loadProducerRewards,loadVotingAccount,restoreWallet,transact} from './wallet.js';

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
  ...(window.__DAO_GOV_CONFIG__||{})
});
let toastTimer;
let walletSession=null;
let bpRecoveryState=null;
let bpRecoveryRequest=0;
let votingState=null;
let electionState=null;
let pendingVoteAllocations=null;
let epochCountdownTimer=null;
let epochCountdownAnchor=null;
let candidateStep=1;
let candidateChainState={loading:false,registered:false,producer:null,error:''};
const candidateDraft={
  account:'flonian',website:'',xAccount:'',region:'702',statusUrl:'',
  producerKey:'',p2pEndpoint:'',apiEndpoint:'',shareRatio:'40'
};

const translations=new Map([
  ['跳到主要内容','Skip to main content'],['返回 HuFu','Back to HuFu'],['治理中心','DAO Governance'],['治理通知','Governance notifications'],['语言','Language'],['未连接','Not connected'],['连接钱包','Connect wallet'],['断开连接','Disconnect'],['钱包连接','Wallet connection'],['使用 HuFu 钱包连接','Connect with HuFu Wallet'],['使用 HuFu 或 Anchor 钱包连接','Connect with HuFu or Anchor Wallet'],['普通浏览器将显示 Anchor 二维码；HuFu 内会直接请求当前账户。','A standard browser displays an Anchor QR code; HuFu requests the current account directly.'],['钱包只负责账户授权与交易签名，DApp 不接触私钥。','The wallet only authorizes the account and signs transactions. The DApp never accesses private keys.'],['连接中…','Connecting…'],['钱包已连接','Wallet connected'],['钱包已断开','Wallet disconnected'],
  ['概览','Overview'],['投票','Vote'],['治理','Governance'],['社区治理','Governance'],['我的','Profile'],['当前治理账户','Governance account'],['日常钱包','Daily wallet'],['我的治理权','My governance power'],
  ['已投 FLON','Staked FLON'],['已选 BP','Selected BPs'],['待领取','Claimable'],['进行中','in progress'],['当前席位','Active seats'],['区块','Block'],['需要你处理','Action required'],['全部','All'],
  ['正式投票','Formal vote'],['剩余','Remaining'],['小时','hours'],['你有','You have'],['票权','voting power'],['去投票','Vote now'],['投票奖励已结算','Voter rewards settled'],['领取','Claim'],['个所投节点进入','voted node entered'],['建议检查节点状态与待生效排名','Review node status and pending ranking'],['查看','View'],
  ['网络概况','Network overview'],['节点排名','Node ranking'],['目标','Target'],['网络出块率','Block production'],['近 24 小时','Last 24 hours'],['总投票本金','Total voting stake'],['活跃投票人','Active voters'],['近 7 天','Last 7 days'],
  ['DAO治理','DAO Governance'],['查看全部','View all'],['投票中','Voting'],['将 Active BP 席位从 3 个扩展至 7 个','Expand Active BP seats from 3 to 7'],['根据候选节点稳定性和网络负载，分阶段扩大出块节点集合。','Expand the producer set in phases based on node stability and network load.'],['赞成','For'],
  ['网络节点','Network nodes'],['BP 与投票','BPs & Voting'],['BP 排名','BP Rankings'],['BP 竞选','BP Election'],['BP 详情','BP details'],['申请竞选','Apply'],['候选节点','Candidates'],['全部候选','All candidates'],['搜索账户、名称或地区','Search account, name, or region'],['新加坡','Singapore'],['东京','Tokyo'],['法兰克福','Frankfurt'],['香港','Hong Kong'],['首尔','Seoul'],['在线','uptime'],['分享','share'],['有效票权','effective votes'],['精确节点票权','Exact node voting power'],['节点状态','Node status'],['排名','Rank'],['奖励分享比例','Reward sharing ratio'],['未领取出块奖励','Unclaimed block rewards'],['最后领取时间','Last reward claim'],['注册地址','Registered URL'],['地区代码','Location code'],['出块公钥','Block signing key'],['链上数据源','On-chain source'],['差','gap'],
  ['节点投票','Node voting'],['分配 FLON 节点票权','Allocate FLON node voting power'],['为每个 BP 独立填写 FLON 票数；分配合计不能超过账户拥有的 FLON','Enter FLON votes for each BP; the total cannot exceed the FLON owned by the account'],['本次分配合计','Allocation total'],['总投票本金（FLON）','Total voting stake (FLON)'],['节点投票本金','Node voting stake'],['链上已投','Staked on-chain'],['可用余额','Available balance'],['账户总可投','Total voting capacity'],['投票后生成等额不可转让 GLON，用于 DAO 治理','Voting mints an equal amount of non-transferable GLON for DAO governance'],['来自','Backed by'],['投票本金','voting stake'],['已选择','Selected'],['分配方式','Allocation mode'],['自定义','Custom'],['每个 BP','Per BP'],['修改将在','Changes take effect in'],['生效',''],['本 Epoch 奖励仍按当前 6 个节点计算','This epoch reward still uses the current 6-node allocation'],['选择 BP','Select BPs'],['清空','Clear'],['清空选择','Clear selection'],['调整本金','Adjust stake'],['确认投票','Confirm vote'],['确认分配','Confirm allocation'],
  ['社区决策','Community decisions'],['DAO 治理','DAO Governance'],['发起提案','Create proposal'],['附议中','Endorsement'],['待执行','Ready to execute'],['建立生态开发者季度资助计划','Create a quarterly ecosystem developer grants program'],['资金提案','Treasury proposal'],['提案人','Proposer'],['人附议','endorsers'],['可附议','Endorse'],['后可执行','until executable'],['启用六小时奖励 Epoch 与历史票权结算','Enable six-hour reward epochs and historical voting-power settlement'],['合约参数','Contract parameters'],['已通过 · 安全等待期','Passed · security delay'],['执行目标','Execution target'],['查看执行内容','View execution'],
  ['账户概览','Account overview'],['我的治理','My Governance'],['累计奖励','Lifetime rewards'],['领取奖励','Claim rewards'],['我的节点投票','My BP votes'],['竞选管理','Election management'],['未注册','Not registered'],['我的治理任务','My governance tasks'],['等待你投票','awaits your vote'],['快照票权','snapshot power'],['处理','Act'],['节点分配已在','Node allocation became effective in'],['投票奖励完成结算','Voter rewards settled'],['治理记录','Governance history'],['打开完整链上治理记录','Open full on-chain governance history'],['附议','Endorsed'],['交易不可逆','Transaction is irreversible'],['调整 BP 投票分配','Updated BP vote allocation'],['昨天','Yesterday'],
  ['当前为','Current network:'],['当前账户','Current account'],['操作已完成','Done'],['确认节点投票','Confirm node vote'],['请核对交易内容，签名后将在下一 Epoch 生效','Review the transaction. It takes effect in the next epoch after signing.'],['网络','Network'],['账户','Account'],['选择 BP','Selected BPs'],['FLON 投票本金','FLON voting stake'],['每节点票权','Power per node'],['DAO 治理凭证','DAO governance receipt'],['GLON 仅用于 DAO 治理，不参与 BP 排名计算。','GLON is used only for DAO governance and does not count toward BP ranking.'],['总票权','Total power'],['生效 Epoch','Effective epoch'],['已入块不等于立即计入排名。新的节点分配将在 Epoch 1,249 边界生效。','Inclusion in a block does not immediately affect ranking. The new allocation takes effect at the Epoch 1,249 boundary.'],['取消','Cancel'],['在 HuFu 中签名','Sign in HuFu'],['签名请求已发送至 HuFu 钱包','Signature request sent to HuFu'],
  ['领取投票奖励','Claim voter rewards'],['已完成确定性结算','has completed deterministic settlement'],['可领取','Claimable'],['合约','Contract'],['领取账户','Recipient'],['稍后','Later'],['确认签名','Confirm signature'],['发起治理提案','Create governance proposal'],['选择提案类型后进入结构化创建流程','Select a proposal type to start the guided flow'],['文本 / 信号提案','Text / signal proposal'],['表达社区方向，不自动执行链上动作','Express community direction without automatic on-chain execution'],['参数提案','Parameter proposal'],['通过白名单 action 修改网络参数','Modify network parameters through allowlisted actions'],['包含预算、收款方与验收条件','Includes budget, recipient, and acceptance criteria'],
  ['申请 BP 竞选','Apply for BP election'],['提交前将检查自质押、节点状态和公开资料','Self-stake, node status, and public profile are checked before submission'],['当前状态','Current status'],['最低自质押','Minimum self-stake'],['由链上参数决定','Set by on-chain parameters'],['必填资料','Required profile'],['网站、X、地区、状态页','Website, X, region, status page'],['公开资料是候选人声明；已验证状态需经过独立核验。','Public profile data is candidate-declared; verified status requires independent review.'],['开始申请','Start application'],['注册进度','Registration progress'],['资格检查','Eligibility'],['公开资料','Public profile'],['节点配置','Node setup'],['确认注册','Review'],['账户存在','Account exists'],['尚未注册为 BP','Not registered as a BP'],['已注册，可更新资料','Registered; profile can be updated'],['注册权限','Registration authority'],['使用当前账户 active 权限签名','Signed with the current account active permission'],['当前合约未设置单独 BP 自质押门限','The current contract has no separate BP self-stake threshold'],['主网节点竞选尚未启用','Mainnet BP election is not enabled'],['当前主网 flon ABI 尚未包含 regproducer 和 producers 状态表。请先完成主网合约升级。','The current mainnet flon ABI does not yet include regproducer or the producers table. Upgrade the mainnet contract first.'],['下一步','Continue'],['上一步','Back'],['节点名称','Node name'],['官方网站','Official website'],['X 账号','X account'],['国家或地区','Country or region'],['状态页','Status page'],['出块公钥','Block signing key'],['用于签署区块，不应填写私钥','Used to sign blocks; never enter a private key'],['P2P 节点地址','P2P endpoint'],['API 节点地址','API endpoint'],['投票人奖励分享比例','Voter reward share'],['提交后，该比例将用于后续 Epoch 奖励分配。','After submission, this ratio applies to reward distribution in subsequent epochs.'],['检查并签名','Review and sign'],['注册交易预览','Registration transaction'],['合约参数与填写内容一致后，再请求 HuFu 签名。','Verify the contract parameters before requesting a HuFu signature.'],['注册成功时 flon.system 会同步注册 voter.reward。','On successful registration, flon.system also registers the producer with voter.reward.'],['X、状态页、P2P 和 API 地址不会进入当前 regproducer 状态表，需后续元数据服务保存。','X, status page, P2P, and API endpoints are not stored by the current regproducer table and require a metadata service.'],['正在请求钱包签名…','Requesting wallet signature…'],['注册交易已广播','Registration transaction broadcast'],['更新 BP 资料','Update BP profile'],['签名并注册','Sign and register'],['BP 注册签名请求已发送至 HuFu','BP registration signature request sent to HuFu'],['FullOn 主网','FullOn Mainnet'],['FullOn 测试网','FullOn Testnet'],['调整投票本金','Adjust voting stake'],['存入 FLON 将生成等额不可转让 GLON','Depositing FLON mints an equal amount of non-transferable GLON'],['可用 FLON','Available FLON'],['已投本金','Voting stake'],['撤票时 GLON立即销毁，节点排名与奖励票权在下一 Epoch 移除。','GLON is burned immediately when unstaking; ranking and reward power are removed in the next epoch.'],['撤回','Unstake'],['增加投票','Add stake'],
  ['本向导仅用于申请成为 BP。普通 Voter 无需 BP 自质押，可直接增加投票本金并给节点投票。','This wizard is only for BP applicants. Voters do not need BP self-stake and can add voting stake and vote for nodes directly.'],['BP 自质押门限','BP self-stake requirement'],['已质押','Staked'],['最低','Minimum'],['当前链上合约尚未启用 BP 自质押表','The current contract has not enabled the BP self-stake table'],['BP 自质押已达标，可以继续填写候选节点资料。','The BP self-stake requirement is met. You can continue with the candidate profile.'],['仅 BP 候选人需要通过 flon::stakebp 补足自质押；普通 Voter 不受此门槛限制。','Only BP candidates must meet the self-stake requirement through flon::stakebp. Regular voters are not subject to this requirement.'],['我是 Voter，去投票','I am a voter — vote now'],['补足 BP 自质押','Add BP self-stake'],['仅申请 BP 的账户需要此操作','Only BP applicant accounts need this action'],['当前 BP 自质押','Current BP self-stake'],['最低门槛','Minimum requirement'],['质押数量','Stake amount'],['这是 BP 候选人保证金，不是 Voter 节点投票本金。退出 BP 自质押遵循链上 21 天解锁期。','This is the BP candidate bond, not voter node-voting stake. Withdrawing BP self-stake follows the on-chain 21-day unlocking period.'],['返回资格检查','Back to eligibility'],['BP 自质押交易已广播','BP self-stake transaction broadcast'],['重新检查资格','Recheck eligibility'],
  ['参数提案 ·','Parameter proposal ·'],['快照','Snapshot'],['通过后执行','Executes after approval'],['创建并完成附议','Created and endorsed'],['正式投票中','Formal vote in progress'],['你的快照票权','Your snapshot power'],['达到 quorum 与通过率后进入','Begins after quorum and approval thresholds are met'],['任何账户均可触发执行','Any account may trigger execution'],['仅执行上方已冻结的白名单 action','Only the frozen allowlisted action above can execute'],['参与投票','Cast vote'],['反对','Against'],['不同意本次参数修改','Reject this parameter change'],['弃权','Abstain'],['计入 quorum，不计入赞成或反对','Counts toward quorum but not for or against'],['附议不会自动成为赞成票。本次选择需要再次由 HuFu 钱包签名。','An endorsement does not become a For vote automatically. This choice requires another HuFu signature.']
]);
[
  ['BP 生产状态','BP production status'],['连接 BP 账户钱包后读取链上状态','Connect the BP account wallet to load on-chain status'],['正在读取链上状态…','Loading on-chain status…'],['当前账户未注册为 BP','The current account is not registered as a BP'],['当前合约尚未支持 BP 自助恢复','The current contract does not yet support BP self-service recovery'],['链上状态读取失败','Failed to load on-chain status'],['暂停次数','Suspensions'],['当前 Epoch','Current Epoch'],['连续漏块','Consecutive misses'],['恢复生产','Resume production'],['冷却期尚未结束','Cooldown has not ended'],['暂停','Suspended'],['试运行','Probation'],['合格','Qualified'],['降级','Degraded'],['警告','Warning'],['样本不足','Insufficient sample'],['网络事件','Network incident'],['未评估','Not assessed'],['恢复后先进入试运行，不会直接视为合格。','Recovery starts probation and does not immediately restore qualified status.'],['试运行期间连续漏掉 12 个分配槽位会立即再次暂停。','Missing 12 consecutive assigned slots during probation causes immediate re-suspension.'],['再次暂停的冷却期按 6、12、24、48 小时递增，最高 48 小时。','Repeated suspension cooldowns escalate through 6, 12, 24, and 48 hours, capped at 48 hours.'],['需要 BP 账户 active 权限签名','Requires the BP account active permission'],['确认恢复生产','Confirm production recovery'],['交易成功后进入试运行，排班更新后才会重新获得出块槽位。','After the transaction succeeds, probation begins; block slots return only after the schedule updates.'],['我确认节点已在线并可持续签署区块','I confirm the node is online and can continuously sign blocks'],['签名并进入试运行','Sign and enter probation'],['正在请求钱包签名…','Requesting wallet signature…'],['恢复交易已广播','Recovery transaction broadcast'],['已进入试运行','Probation started'],['刷新状态','Refresh status']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['领取 BP 奖励','Claim BP rewards'],['代 BP 领取','Claim for a BP'],['BP 奖励领取','BP reward claim'],['当前账户可为自己或任意 BP 触发领取','The connected account can trigger a claim for itself or any BP'],['BP 收款账户','BP recipient'],['触发账户','Caller'],['基础奖励','Base rewards'],['GAS 奖励','GAS rewards'],['待领取记录','claim rows'],['本次最多处理','Maximum rows this claim'],['奖励始终直接支付给 BP，代触发账户不能更改收款人，也不会获得奖励。','Rewards are always paid directly to the BP. The caller cannot change the recipient or receive the rewards.'],['检查奖励','Check rewards'],['确认代领','Confirm claim'],['BP 奖励领取交易已广播','BP reward claim broadcast'],['请输入有效的 BP 账户名','Enter a valid BP account name'],['未找到该 BP','BP not found'],['当前合约尚未启用 BP 奖励领取','BP reward claims are not enabled by the current contract'],['处理中…','Processing…'],['可由任意钱包代为触发','Any wallet can trigger this claim'],['可为 BP 代触发','Can trigger for a BP'],['治理权','Governance power'],['暂无可领取的 BP 奖励','No BP rewards are currently claimable']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['完成','Done'],['不可领取','Not claimable'],['GAS 待领取奖励','Unclaimed GAS rewards'],['尚未积累足够的已分配出块样本','Not enough assigned production samples have accumulated yet'],['未设置','N/A'],['暂无已结算奖励可领取','No settled rewards to claim']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['连接钱包后读取链上已结算余额','Connect wallet to load the settled on-chain balance'],['提案、附议、投票与 Timelock','Proposals, endorsement, voting, and Timelock'],['当前尚未配置可验证的治理合约数据源；本页不会构造或广播模拟治理交易。','No verified governance contract data source is configured. This page does not construct or broadcast simulated governance transactions.'],['待接入','Pending integration'],['候选','Candidates'],
  ['连接钱包后读取','Connect wallet to load'],['链上选举状态','On-chain election status'],['实时 RPC','Live RPC'],['链上候选排名','On-chain candidate ranking'],['历史索引服务待接入','History indexer not connected'],['正在读取链上 BP 排名…','Loading on-chain BP ranking…'],['正在读取候选 BP…','Loading candidate BPs…'],['链上 BP 数据读取失败，请稍后刷新。','Failed to load on-chain BP data. Please try again later.'],['链上 BP 数据尚未就绪','On-chain BP data is not ready yet'],['投票分配在下一 Epoch 生效','Vote allocation takes effect next epoch'],['待生效状态以 flon::pendingvote 链上记录为准','Pending state is read from flon::pendingvote'],['正在读取链上时间…','Loading chain time…'],['距离下一 Epoch','Until next epoch'],['距离 Epoch 生效','Until epoch activation'],['等待 Epoch 结算','Awaiting epoch settlement'],['Epoch 时间不可用','Epoch timing unavailable'],['DAO 提案功能待接入','DAO proposal integration pending'],['治理合约 ABI 与部署地址确认后开放','Available after the governance ABI and deployment are verified'],['说明','Details'],['读取链上状态','Load on-chain status'],['待领取奖励','Claimable rewards'],['存在下一 Epoch 待生效修改','A change is pending for the next epoch'],['链上已结算','Settled on-chain'],['DAO Governance 尚未启用','DAO Governance is not enabled'],['当前站点未配置可验证的治理合约 ABI 与部署地址','This site has no verified governance contract ABI or deployment configured'],['提案、附议、正式投票、Timelock 和执行按钮已保持只读，不会请求钱包签名，也不会广播模拟交易。','Proposal, endorsement, formal voting, Timelock, and execution remain read-only; they neither request a wallet signature nor broadcast simulated transactions.'],['调整投票本金尚未启用','Voting stake adjustment is not enabled'],['需要先确认 addvote / subvote 的主网 ABI 与资产精度','The production addvote/subvote ABI and asset precision must be verified first'],['当前版本不会根据示例余额构造质押或撤票交易。节点选择与投票奖励领取已使用真实链上状态。','This version does not construct stake or unstake transactions from sample balances. BP selection and voter reward claims use real on-chain state.']
].forEach(([zh,en])=>translations.set(zh,en));
const sourceText=new WeakMap();
const sourceAttrs=new WeakMap();
let currentLanguage=localStorage.getItem('flon-daogov-language')||((navigator.languages||[navigator.language||'en'])[0].toLowerCase().startsWith('zh')?'zh-CN':'en');

function networkName(){
  if(runtimeConfig.network==='mainnet')return currentLanguage==='zh-CN'?'FullOn 主网':'FullOn Mainnet';
  if(runtimeConfig.network==='testnet')return currentLanguage==='zh-CN'?'FullOn 测试网':'FullOn Testnet';
  return currentLanguage==='zh-CN'?runtimeConfig.networkName:translateText(runtimeConfig.networkName);
}
function renderNetworkNames(){document.querySelectorAll('[data-network-name]').forEach(node=>node.textContent=networkName())}

function translateText(value){if(currentLanguage==='zh-CN')return value;let output=value;[...translations.entries()].sort((a,b)=>b[0].length-a[0].length).forEach(([zh,en])=>{output=output.split(zh).join(en)});return output}
function applyTranslations(root=document){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){if(!sourceText.has(node))sourceText.set(node,node.nodeValue);node.nodeValue=currentLanguage==='zh-CN'?sourceText.get(node):translateText(sourceText.get(node))}
  root.querySelectorAll?.('[placeholder],[aria-label],[data-message]').forEach(el=>{if(!sourceAttrs.has(el))sourceAttrs.set(el,{placeholder:el.getAttribute('placeholder'),ariaLabel:el.getAttribute('aria-label'),message:el.getAttribute('data-message')});const attrs=sourceAttrs.get(el);for(const [key,value] of Object.entries(attrs)){const name=key==='ariaLabel'?'aria-label':key==='message'?'data-message':key;if(value!==null)el.setAttribute(name,currentLanguage==='zh-CN'?value:translateText(value))}});
  document.documentElement.lang=currentLanguage;const picker=document.querySelector('[data-language]');if(picker)picker.value=currentLanguage;
  renderNetworkNames();
}

document.documentElement.dataset.network=runtimeConfig.network;
renderNetworkNames();

function showView(name){
  views.forEach(view=>{const active=view.dataset.view===name;view.hidden=!active;view.classList.toggle('is-active',active)});
  nav.forEach(button=>button.classList.toggle('is-active',button.dataset.viewTarget===name));
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='mine')refreshBPRecovery();
}
function setNodeMode(mode='directory'){
  document.querySelectorAll('[data-node-mode]').forEach(button=>button.classList.toggle('is-active',button.dataset.nodeMode===mode));
  document.querySelectorAll('[data-node-mode-panel]').forEach(panel=>panel.hidden=panel.dataset.nodeModePanel!==mode);
}
function showToast(message){clearTimeout(toastTimer);toast.textContent=message;toast.hidden=false;toastTimer=setTimeout(()=>toast.hidden=true,2200)}
function openSheet(html){sheetContent.innerHTML=html;applyTranslations(sheetContent);overlay.hidden=false;sheet.hidden=false;document.body.style.overflow='hidden'}
function closeSheet(){pendingVoteAllocations=null;overlay.hidden=true;sheet.hidden=true;document.body.style.overflow=''}
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
function walletErrorMessage(error){const code=String(error?.message||error);const zh={WALLET_CHAIN_ID_MISMATCH:'钱包网络与当前站点不一致，请在 HuFu 中切换到对应网络',WALLET_CHAIN_UNCONFIRMED:'无法确认 HuFu 当前网络，请切换到对应 FullOn 网络后重试',RPC_CHAIN_ID_MISMATCH:'RPC Chain ID 配置错误',RPC_TIMEOUT:'链上 RPC 连接超时',HUFU_NETWORK_TIMEOUT:'HuFu 网络查询超时',CHAIN_TIME_STALE:'节点区块时间异常或同步已停滞，请等待网络恢复后重试',HUFU_ACCOUNT_TIMEOUT:'HuFu 账户选择超时',HUFU_ACCOUNT_UNAVAILABLE:'未获取到 HuFu 账户',HUFU_PROVIDER_UNAVAILABLE:'未检测到 HuFu 钱包',ACCOUNT_CHANGED:'HuFu 当前账户已变化，请重新连接'};const en={WALLET_CHAIN_ID_MISMATCH:'The wallet network does not match this site. Switch to the corresponding network in HuFu.',WALLET_CHAIN_UNCONFIRMED:'Unable to confirm the HuFu network. Switch to the matching FullOn network and retry.',RPC_TIMEOUT:'The chain RPC timed out.',HUFU_NETWORK_TIMEOUT:'The HuFu network query timed out.',CHAIN_TIME_STALE:'RPC block time is stale or incorrect. Retry after the network recovers.',ACCOUNT_CHANGED:'The active HuFu account changed. Reconnect the wallet.'};return currentLanguage==='zh-CN'?(zh[code]||`钱包连接失败：${code}`):(en[code]||`Wallet connection failed: ${code}`)}
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
  const url=safePublicUrl(producer.url),performance=producer.performance||{};
  let rewards=null;try{rewards=await loadProducerRewards(producer.owner)}catch(error){console.error('Failed to load BP rewards',error)}
  const baseUnclaimed=rewards?.baseUnclaimed||producer.unclaimed_rewards||'0.00000000 FLON';
  const gasUnclaimed=rewards?.gasUnclaimed||'0.00000000 FLON';
  const hasClaimable=Boolean(rewards?.hasClaimable);
  const location=Number(producer.location||0)>0?String(producer.location):'未设置';
  const statusCode=Number(performance.status??0),statusMeta=bpStatusMeta[statusCode]||bpStatusMeta[0];
  const performanceDetail=Object.keys(performance).length?`<strong>BP 生产状态</strong><small>${statusMeta[0]}</small>${statusCode===5?'<small>尚未积累足够的已分配出块样本</small>':''}`:'';
  openSheet(`<h2 id="sheet-title">BP 详情</h2><p class="sheet-subtitle">${escapeHtml(producer.owner)} · #${index+1}</p><div class="sign-summary"><div><span>节点状态</span><strong>${escapeHtml(producer.status)}</strong></div><div><span>排名</span><strong>#${index+1}</strong></div><div><span>精确节点票权</span><strong>${escapeHtml(formatVoteAsset(producer.total_votes))}</strong></div><div><span>奖励分享比例</span><strong>${Number(producer.reward_shared_ratio||0)/100}%</strong></div><div><span>未领取出块奖励</span><strong>${escapeHtml(baseUnclaimed)}</strong></div><div><span>GAS 待领取奖励</span><strong>${escapeHtml(gasUnclaimed)}</strong></div><div><span>最后领取时间</span><strong>${escapeHtml(producer.last_claim_time||'—')}</strong></div><div><span>地区代码</span><strong>${escapeHtml(location)}</strong></div><div><span>链上数据源</span><strong>flon::producers</strong></div></div><div class="profile-review"><strong>注册地址</strong>${url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`:`<small>${escapeHtml(producer.url||'—')}</small>`}<strong>出块公钥</strong><small class="full-value">${escapeHtml(producerKey(producer))}</small>${performanceDetail}</div><div class="sheet-actions ${hasClaimable?'':'one'}"><button class="secondary-button" data-action="close-sheet">完成</button>${hasClaimable?`<button class="primary-button" data-action="bp-claim" data-producer="${escapeHtml(producer.owner)}">领取 BP 奖励</button>`:''}</div>`);
}
async function refreshElection(){
  try{
    electionState=await loadElection();
    const nodeList=document.querySelector('.node-list'),selectList=document.querySelector('.select-list');
    if(nodeList)nodeList.innerHTML=electionState.producers.map((producer,index)=>`<button class="node-card" type="button" data-action="producer-details" data-producer="${escapeHtml(producer.owner)}" data-status="${escapeHtml(producer.status)}" data-name="${escapeHtml(`${producer.owner} ${producer.url||''}`.toLowerCase())}"><span class="rank din">${String(index+1).padStart(2,'0')}</span><span class="node-logo blue-logo">${escapeHtml(producerInitials(producer.owner))}</span><span class="node-main"><strong>${escapeHtml(producer.owner)}</strong><small>${escapeHtml(producer.url||'No public URL')}</small><span><b>${escapeHtml(producer.status)}</b><em>分享 ${Number(producer.reward_shared_ratio||0)/100}%</em></span></span><span class="node-votes"><strong class="din">${escapeHtml(formatVotes(producer.total_votes))}</strong><small>有效票权</small><svg><use href="#i-chevron"/></svg></span></button>`).join('');
    if(selectList)selectList.innerHTML=electionState.producers.filter(producer=>producer.status!=='suspended').slice(0,51).map((producer,index)=>`<div class="select-node" data-producer="${escapeHtml(producer.owner)}"><label class="check-control"><input type="checkbox"><span class="check"><svg><use href="#i-check"/></svg></span></label><span class="node-logo blue-logo">${escapeHtml(producerInitials(producer.owner))}</span><span><strong>${escapeHtml(producer.owner)}</strong><small>#${index+1} · 分享 ${Number(producer.reward_shared_ratio||0)/100}%</small></span><input class="node-vote-input din" type="number" min="0.00000001" step="0.00000001" inputmode="decimal" placeholder="0.00000000" data-node-votes disabled aria-label="${escapeHtml(producer.owner)} FLON votes"></div>`).join('');
    const standbyCount=electionState.producers.filter(producer=>producer.status==='standby').length;
    const summary=document.querySelector('.rank-summary');if(summary)summary.querySelector('strong').textContent=`${electionState.activeCount} / ${electionState.activeTarget}`;
    document.querySelectorAll('[data-active-count]').forEach(node=>node.textContent=String(electionState.activeCount));
    document.querySelectorAll('[data-active-target]').forEach(node=>node.textContent=`目标 ${electionState.activeTarget}`);
    document.querySelectorAll('[data-standby-count],[data-rank-standby]').forEach(node=>node.textContent=String(standbyCount));
    document.querySelectorAll('[data-candidate-count],[data-rank-candidates]').forEach(node=>node.textContent=String(electionState.producers.length));
    setText('[data-epoch-active]',`${electionState.activeCount} / ${electionState.activeTarget}`);setText('[data-epoch-standby]',String(standbyCount));setText('[data-epoch-candidates]',String(electionState.producers.length));
    syncVotingSelection();updateAllocation();applyTranslations();
  }catch(error){
    console.error('Failed to load election state',error);electionState=null;
    const nodeList=document.querySelector('.node-list'),selectList=document.querySelector('.select-list');
    if(nodeList)nodeList.innerHTML='<div class="inline-error">链上 BP 数据读取失败，请稍后刷新。</div>';
    if(selectList)selectList.innerHTML='<div class="inline-error">无法验证候选 BP，已禁用投票提交。</div>';
    updateAllocation();
  }
}
async function refreshVotingAccount(){
  votingState=walletSession?await loadVotingAccount(walletSession.account):{epochTiming:await loadEpochTiming(),hasPendingVote:false};
  renderVotingAccount();syncVotingSelection();updateAllocation();
}
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
  const glonAmount=connected?assetAmount(glon).toFixed(8):'—';
  const nodeVoteStake=connected?votingState.nodeVoteStake:'— FLON';
  const nodeVoteAmount=connected?assetAmount(nodeVoteStake).toFixed(8):'—';
  const producers=connected?(votingState.pendingProducers||votingState.effectiveProducers||[]):[];
  const rewards=connected?votingState.unclaimedRewards:'— FLON';
  const owned=connected?assetUnits(nodeVoteStake)+assetUnits(votingState.flon):0n;
  setText('[data-glon-balance]',`${glonAmount} GLON`);setText('[data-profile-glon]',`${glonAmount} GLON`);setText('[data-vote-stake]',connected?nodeVoteStake:'— FLON');setText('[data-vote-liquid]',connected?votingState.flon:'— FLON');setText('[data-vote-owned]',connected?`${formatUnits(owned)} FLON`:'— FLON');
  setText('[data-voting-stake]',connected?nodeVoteAmount:'—');setText('[data-voted-bps]',connected?String(producers.length):'—');setText('[data-profile-votes]',connected?`${producers.length} 个 BP`:'— 个 BP');
  setText('[data-unclaimed-rewards]',rewards);setText('[data-profile-rewards]',rewards);setText('[data-profile-claimable]',connected?rewards:'连接钱包后读取');
  const hasClaimableRewards=connected&&assetAmount(rewards)>0;
  setText('[data-claimable-summary]',connected?(hasClaimableRewards?`链上已结算 ${rewards}`:'暂无已结算奖励可领取'):'连接钱包后读取链上已结算余额');
  setText('[data-claim-action-label]',connected?(hasClaimableRewards?'领取':'不可领取'):'领取');
  document.querySelectorAll('[data-action="claim"]').forEach(button=>{button.disabled=connected&&!hasClaimableRewards;button.classList.toggle('is-unavailable',connected&&!hasClaimableRewards)});
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
  document.querySelectorAll('.select-node').forEach(label=>{const checkbox=label.querySelector('input[type="checkbox"]'),amount=label.querySelector('[data-node-votes]'),units=allocations.get(label.dataset.producer)||0n;if(checkbox)checkbox.checked=units>0n;if(amount){amount.disabled=units<=0n;amount.value=units>0n?formatUnits(units):''}});
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
  openSheet(`<h2 id="sheet-title">补足 BP 自质押</h2><p class="sheet-subtitle">仅申请 BP 的账户需要此操作</p><div class="sign-summary"><div><span>账户</span><strong>${escapeHtml(walletSession.account)}</strong></div><div><span>可用 FLON</span><strong>${escapeHtml(votingState?.flon||'0.00000000 FLON')}</strong></div><div><span>当前 BP 自质押</span><strong>${escapeHtml(current)}</strong></div><div><span>最低门槛</span><strong>${escapeHtml(minimum)}</strong></div></div><form class="wizard-form" data-bp-stake-form><label><span>质押数量</span><input name="amount" type="number" min="0.00000001" step="0.00000001" value="${missing.toFixed(8)}" required></label><p class="field-note">这是 BP 候选人保证金，不是 Voter 节点投票本金。退出 BP 自质押遵循链上 21 天解锁期。</p></form><div class="sheet-actions"><button class="secondary-button" data-action="candidate">返回资格检查</button><button class="primary-button" data-action="bp-stake-sign">在 HuFu 中签名</button></div>`);
}
async function submitBPStake(target){
  if(!walletSession)return;
  const form=sheetContent.querySelector('[data-bp-stake-form]');if(!form||!form.reportValidity())return;
  const amount=Number(form.elements.amount.value),available=assetAmount(votingState?.flon);
  if(!Number.isFinite(amount)||amount<=0){showToast('请输入有效质押数量');return}
  if(amount>available){showToast(`可用余额不足，当前为 ${votingState?.flon||'0.00000000 FLON'}`);return}
  const quantity=formatFlon(amount);target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  try{const result=await transact(walletSession,[{account:'flon',name:'stakebp',data:{owner:walletSession.account,quantity}}]),id=transactionId(result);openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">BP 自质押交易已广播</h2><p>${escapeHtml(quantity)}</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sheet-actions one"><button class="primary-button" data-action="candidate">重新检查资格</button></div>`)}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'在 HuFu 中签名':'Sign in HuFu';showToast(walletErrorMessage(error))}
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
function restoreVoteAllocations(allocations){const values=new Map(allocations.map(item=>[item.producer,BigInt(item.votes)]));document.querySelectorAll('.select-node').forEach(label=>{const checkbox=label.querySelector('input[type="checkbox"]'),input=label.querySelector('[data-node-votes]'),units=values.get(label.dataset.producer)||0n;if(checkbox)checkbox.checked=units>0n;if(input){input.disabled=units<=0n;input.value=units>0n?formatUnits(units):''}});updateAllocation()}
async function confirmVote(){
  if(!walletSession){openWalletSheet();return}
  if(!electionState){showToast('链上 BP 数据尚未就绪');return}
  let allocations;try{allocations=draftVoteAllocations()}catch{showToast('请输入最多 8 位小数的有效 FLON 票数');return}
  if(allocations.length>30){showToast('最多投票给 30 个 BP');return}
  if(allocations.some(item=>item.votes<=0n)){showToast('每个已选 BP 的票数必须大于 0');return}
  const draft=[...allocations];
  try{await refreshVotingAccount()}catch(error){showToast(`读取链上票权失败：${String(error?.message||error)}`);return}
  restoreVoteAllocations(draft);pendingVoteAllocations=draft;
  const total=draft.reduce((sum,item)=>sum+item.votes,0n),current=assetUnits(votingState?.nodeVoteStake),available=assetUnits(votingState?.flon),owned=current+available,delta=total-current;
  if(total>owned){showToast(`分配合计不能超过账户拥有的 ${formatUnits(owned)} FLON`);return}
  if(delta<0n&&votingState?.refund){showToast('已有一笔撤票退款待领取，暂时不能减少投票总额');return}
  if(!votingState?.voteAllocationSupported){showToast('当前链上合约尚未启用逐 BP 票数分配');return}
  const actionNames=[delta>0n?'flon::addvote':delta<0n?'flon::subvote':null,'flon::votealloc'].filter(Boolean).join(' + ');
  openSheet(`<h2 id="sheet-title">确认节点投票</h2><p class="sheet-subtitle">请核对每个 BP 的票数，一次签名后将在下一 Epoch 生效</p><div class="sign-summary"><div><span>网络</span><strong>${escapeHtml(networkName())}</strong></div><div><span>账户</span><strong>${escapeHtml(walletSession.account)}@${escapeHtml(walletSession.permission)}</strong></div><div><span>Action</span><strong>${escapeHtml(actionNames)}</strong></div><div><span>选择 BP</span><strong>${draft.length} 个</strong></div><div><span>分配合计</span><strong>${formatUnits(total)} FLON</strong></div><div><span>账户拥有</span><strong>${formatUnits(owned)} FLON</strong></div></div><div class="profile-review">${draft.map(item=>`<small>${escapeHtml(item.producer)}：${formatUnits(item.votes)} FLON</small>`).join('')||'<small>清空全部 BP 投票</small>'}</div><p class="sign-warning">所有 BP 分配之和必须等于锁定投票本金，且不能超过账户拥有的 FLON。每 1 FLON 最多产生 1 票，不会复制放大。</p><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">取消</button><button class="primary-button" data-action="vote-sign">在 HuFu 中签名</button></div>`);
}
async function submitVote(target){
  if(!walletSession||!pendingVoteAllocations)return;const allocations=pendingVoteAllocations.map(item=>({...item})),total=allocations.reduce((sum,item)=>sum+item.votes,0n),current=assetUnits(votingState?.nodeVoteStake),delta=total-current,actions=[];
  if(delta>0n)actions.push({account:'flon',name:'addvote',data:{voter:walletSession.account,vote_staked:`${formatUnits(delta)} FLON`}});else if(delta<0n)actions.push({account:'flon',name:'subvote',data:{voter:walletSession.account,vote_staked:`${formatUnits(-delta)} FLON`}});
  actions.push({account:'flon',name:'votealloc',data:{voter:walletSession.account,allocations:allocations.map(item=>({producer:item.producer,votes:item.votes.toString()}))}});
  target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  try{const result=await transact(walletSession,actions),id=transactionId(result);const count=allocations.length;pendingVoteAllocations=null;openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">节点投票已广播</h2><p>${formatUnits(total)} FLON · ${count} 个 BP · 下一 Epoch 生效</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);await refreshVotingAccount()}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'在 HuFu 中签名':'Sign in HuFu';showToast(walletErrorMessage(error))}
}
function formatFlon(value){return `${Number(value).toFixed(8)} FLON`}
function refundReadyAt(refund){
  if(!refund?.request_time)return 0;
  const value=String(refund.request_time);
  const timestamp=Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value)?value:`${value}Z`);
  return Number.isFinite(timestamp)?timestamp+180000:0;
}
async function openStakeSheet(){
  if(!walletSession){openWalletSheet();return}
  try{await refreshVotingAccount()}catch(error){showToast(`读取投票本金失败：${String(error?.message||error)}`);return}
  if(!votingState?.stakeSupported){showToast('当前链上合约不支持调整投票本金');return}
  const liquid=votingState.flon||'0.00000000 FLON',staked=votingState.nodeVoteStake||'0.00000000 FLON';
  const refund=votingState.refund,readyAt=refundReadyAt(refund),ready=refund&&Date.now()>=readyAt;
  openSheet(`<h2 id="sheet-title">调整投票本金</h2><p class="sheet-subtitle">质押 FLON 生成等额不可转让 GLON</p><div class="sign-summary"><div><span>可用 FLON</span><strong>${escapeHtml(liquid)}</strong></div><div><span>已投本金</span><strong>${escapeHtml(staked)}</strong></div><div><span>治理凭证</span><strong>${escapeHtml(votingState.glon)}</strong></div></div>${refund?`<div class="pending-note"><svg><use href="#i-clock"/></svg><span><strong>撤票退款 ${escapeHtml(refund.vote_staked)}</strong><small>${ready?'退款已成熟，可以领取':`可领取时间 ${escapeHtml(new Date(readyAt).toLocaleString())}`}</small></span></div>`:''}<form class="wizard-form" data-stake-form><label><span>操作</span><select name="operation"><option value="add">增加投票本金</option><option value="sub" ${refund?'disabled':''}>撤回投票本金</option></select></label><label><span>金额</span><input name="amount" type="number" min="0.00000001" step="0.00000001" inputmode="decimal" required placeholder="0.00000000"></label><p class="field-note">增加本金在下一 Epoch 计入节点票权；撤票会立即销毁等额 GLON，FLON 在 3 分钟冷却期后领取。每个账户同一时间只能有一笔待领取退款。</p></form><div class="sheet-actions">${refund?`<button class="secondary-button" data-action="claim-vote-refund" ${ready?'':'disabled'}>领取退款</button>`:`<button class="secondary-button" data-action="close-sheet">取消</button>`}<button class="primary-button" data-action="stake-sign">检查并签名</button></div>`);
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
  if(target.dataset.viewTarget){showView(target.dataset.viewTarget);if(target.dataset.viewTarget==='nodes')setNodeMode(target.dataset.nodeModeTarget||'directory')}
  if(target.dataset.nodeMode)setNodeMode(target.dataset.nodeMode);
  const action=target.dataset.action;
  if(action==='toast')showToast(target.dataset.message||'操作已完成');
  if(action==='close-sheet')closeSheet();
  if(action==='network')showToast(`当前为 ${networkName()} · Chain ID ${runtimeConfig.chainId.slice(0,4)}…${runtimeConfig.chainId.slice(-3)}`);
  if(action==='account')openWalletSheet();
  if(action==='connect-wallet'){
    target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'连接中…':'Connecting…';
    try{walletSession=await connectWallet();renderWallet();await refreshVotingAccount();closeSheet();showToast(currentLanguage==='zh-CN'?'钱包已连接':'Wallet connected')}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'连接钱包':'Connect wallet';showToast(walletErrorMessage(error))}
  }
  if(action==='disconnect-wallet'){await disconnectWallet();walletSession=null;votingState=null;renderWallet();renderVotingAccount();syncVotingSelection();updateAllocation();closeSheet();showToast(currentLanguage==='zh-CN'?'钱包已断开':'Wallet disconnected')}
  if(action==='clear-selection'){document.querySelectorAll('.select-node').forEach(label=>{const checkbox=label.querySelector('input[type="checkbox"]'),amount=label.querySelector('[data-node-votes]');if(checkbox)checkbox.checked=false;if(amount){amount.value='';amount.disabled=true}});updateAllocation()}
  if(action==='producer-details')await openProducerDetails(target.dataset.producer);
  if(action==='sign-vote')await confirmVote();
  if(action==='vote-sign')await submitVote(target);
  if(action==='governance-unavailable')openSheet(`<h2 id="sheet-title">DAO治理尚未启用</h2><p class="sheet-subtitle">当前站点未配置可验证的治理合约 ABI 与部署地址</p><p class="sign-warning">提案、附议、正式投票、Timelock 和执行按钮已保持只读，不会请求钱包签名，也不会广播模拟交易。</p><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);
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
  if(action==='stake-sign')await submitStake(target);
  if(action==='claim-vote-refund')await claimVoteRefund(target);
});
overlay.addEventListener('click',closeSheet);
document.addEventListener('change',event=>{if(event.target.matches('.select-node input[type="checkbox"]')){const amount=event.target.closest('.select-node')?.querySelector('[data-node-votes]');if(amount){amount.disabled=!event.target.checked;if(!event.target.checked)amount.value='';else amount.focus()}updateAllocation()}if(event.target.matches('[data-resume-confirm]')){const button=sheetContent.querySelector('[data-action="resume-producer-sign"]');if(button)button.disabled=!event.target.checked}});
document.addEventListener('input',event=>{if(event.target.matches('[name="shareRatio"]')){const output=sheetContent.querySelector('[data-share-output]');if(output)output.textContent=`${event.target.value}%`}if(event.target.matches('[data-node-votes]'))updateAllocation()});
document.querySelector('[data-language]').addEventListener('change',event=>{currentLanguage=event.target.value;localStorage.setItem('flon-daogov-language',currentLanguage);applyTranslations();updateEpochCountdown();showToast(currentLanguage==='zh-CN'?'语言已切换为中文':'Language changed to English')});

function selectedCount(){return [...document.querySelectorAll('.select-node input[type="checkbox"]:checked')].length}
function allocationTotal(){try{return draftVoteAllocations().reduce((sum,item)=>sum+item.votes,0n)}catch{return 0n}}
function updateAllocation(){const total=allocationTotal(),count=selectedCount(),owned=assetUnits(votingState?.nodeVoteStake)+assetUnits(votingState?.flon);document.querySelector('[data-selected-count]').textContent=`${count} / 30`;document.querySelector('[data-per-node]').textContent=count?'自定义':'—';document.querySelector('[data-allocation-total]').textContent=`${formatUnits(total)} FLON`;const confirm=document.querySelector('[data-action="sign-vote"]');if(confirm)confirm.disabled=!walletSession||count>30||total>owned}
document.querySelectorAll('[data-node-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-node-filter]').forEach(b=>b.classList.toggle('is-active',b===button));document.querySelectorAll('.node-card').forEach(card=>card.hidden=button.dataset.nodeFilter!=='all'&&card.dataset.status!==button.dataset.nodeFilter)}));
document.querySelector('[data-node-search]').addEventListener('input',event=>{const query=event.target.value.trim().toLowerCase();document.querySelectorAll('.node-card').forEach(card=>card.hidden=query&&!card.dataset.name.includes(query))});
document.querySelectorAll('[data-proposal-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-proposal-filter]').forEach(b=>b.classList.toggle('is-active',b===button));document.querySelectorAll('.proposal-item').forEach(card=>card.hidden=button.dataset.proposalFilter!=='all'&&card.dataset.status!==button.dataset.proposalFilter)}));

applyTranslations();
renderVotingAccount();
refreshElection();
async function initializeWallet(){
  let session=await restoreWallet();
  if(!session&&isHuFuApp())session=await autoConnectHuFuWallet();
  walletSession=session;
  renderWallet();
  await refreshVotingAccount();
}
initializeWallet().catch(error=>{
  walletSession=null;
  renderWallet();
  if(isHuFuApp())showToast(walletErrorMessage(error));
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshVotingAccount().catch(error=>console.error('Failed to refresh epoch timing',error))});
