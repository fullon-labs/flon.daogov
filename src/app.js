import {connectWallet,disconnectWallet,isHuFuApp,loadBPAccount,loadElection,loadVotingAccount,restoreWallet,transact} from './wallet.js';

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
  rpcUrl:'https://t.flonscan.io',
  ...(window.__DAO_GOV_CONFIG__||{})
});
let toastTimer;
let walletSession=null;
let bpRecoveryState=null;
let bpRecoveryRequest=0;
let votingState=null;
let electionState=null;
let pendingVoteProducers=null;
let candidateStep=1;
let candidateChainState={loading:false,registered:false,producer:null,error:''};
const candidateDraft={
  account:'flonian',website:'',xAccount:'',region:'702',statusUrl:'',
  producerKey:'',p2pEndpoint:'',apiEndpoint:'',shareRatio:'40'
};

const translations=new Map([
  ['跳到主要内容','Skip to main content'],['返回 HuFu','Back to HuFu'],['治理中心','DAO Governance'],['治理通知','Governance notifications'],['语言','Language'],['未连接','Not connected'],['连接钱包','Connect wallet'],['断开连接','Disconnect'],['钱包连接','Wallet connection'],['使用 HuFu 钱包连接','Connect with HuFu Wallet'],['使用 HuFu 或 Anchor 钱包连接','Connect with HuFu or Anchor Wallet'],['普通浏览器将显示 Anchor 二维码；HuFu 内会直接请求当前账户。','A standard browser displays an Anchor QR code; HuFu requests the current account directly.'],['钱包只负责账户授权与交易签名，DApp 不接触私钥。','The wallet only authorizes the account and signs transactions. The DApp never accesses private keys.'],['连接中…','Connecting…'],['钱包已连接','Wallet connected'],['钱包已断开','Wallet disconnected'],
  ['概览','Overview'],['投票','Vote'],['治理','Governance'],['我的','Profile'],['当前治理账户','Governance account'],['日常钱包','Daily wallet'],['我的治理权','My governance power'],['全部已生效','All effective'],
  ['已投 FLON','Staked FLON'],['已选 BP','Selected BPs'],['待领取','Claimable'],['进行中','in progress'],['当前席位','Active seats'],['区块','Block'],['需要你处理','Action required'],['全部','All'],
  ['正式投票','Formal vote'],['剩余','Remaining'],['小时','hours'],['你有','You have'],['票权','voting power'],['去投票','Vote now'],['投票奖励已结算','Voter rewards settled'],['领取','Claim'],['个所投节点进入','voted node entered'],['建议检查节点状态与待生效排名','Review node status and pending ranking'],['查看','View'],
  ['网络概况','Network overview'],['节点排名','Node ranking'],['目标','Target'],['网络出块率','Block production'],['近 24 小时','Last 24 hours'],['总投票本金','Total voting stake'],['活跃投票人','Active voters'],['近 7 天','Last 7 days'],
  ['社区治理','Community governance'],['查看全部','View all'],['投票中','Voting'],['将 Active BP 席位从 3 个扩展至 7 个','Expand Active BP seats from 3 to 7'],['根据候选节点稳定性和网络负载，分阶段扩大出块节点集合。','Expand the producer set in phases based on node stability and network load.'],['赞成','For'],
  ['网络节点','Network nodes'],['BP 与投票','BPs & Voting'],['BP 排名','BP Rankings'],['BP 竞选','BP Election'],['申请竞选','Apply'],['候选节点','Candidates'],['全部候选','All candidates'],['搜索账户、名称或地区','Search account, name, or region'],['新加坡','Singapore'],['东京','Tokyo'],['法兰克福','Frankfurt'],['香港','Hong Kong'],['首尔','Seoul'],['在线','uptime'],['分享','share'],['有效票权','effective votes'],['差','gap'],
  ['节点投票','Node voting'],['分配 FLON 节点票权','Allocate FLON node voting power'],['锁定的 FLON 在所选 BP 之间平均分配，不会复制放大','Locked FLON is divided equally across selected BPs and is never duplicated'],['节点投票本金','Node voting stake'],['投票后生成等额不可转让 GLON，用于 DAO 治理','Voting mints an equal amount of non-transferable GLON for DAO governance'],['来自','Backed by'],['投票本金','voting stake'],['已选择','Selected'],['每个 BP','Per BP'],['修改将在','Changes take effect in'],['生效',''],['本 Epoch 奖励仍按当前 6 个节点计算','This epoch reward still uses the current 6-node allocation'],['选择 BP','Select BPs'],['清空','Clear'],['调整本金','Adjust stake'],['确认分配','Confirm allocation'],
  ['社区决策','Community decisions'],['DAO 治理','DAO Governance'],['发起提案','Create proposal'],['附议中','Endorsement'],['待执行','Ready to execute'],['建立生态开发者季度资助计划','Create a quarterly ecosystem developer grants program'],['资金提案','Treasury proposal'],['提案人','Proposer'],['人附议','endorsers'],['可附议','Endorse'],['后可执行','until executable'],['启用六小时奖励 Epoch 与历史票权结算','Enable six-hour reward epochs and historical voting-power settlement'],['合约参数','Contract parameters'],['已通过 · 安全等待期','Passed · security delay'],['执行目标','Execution target'],['查看执行内容','View execution'],
  ['我的治理','My Governance'],['累计奖励','Lifetime rewards'],['领取奖励','Claim rewards'],['我的节点投票','My BP votes'],['竞选管理','Election management'],['未注册','Not registered'],['我的治理任务','My governance tasks'],['等待你投票','awaits your vote'],['快照票权','snapshot power'],['处理','Act'],['节点分配已在','Node allocation became effective in'],['投票奖励完成结算','Voter rewards settled'],['治理记录','Governance history'],['打开完整链上治理记录','Open full on-chain governance history'],['附议','Endorsed'],['交易不可逆','Transaction is irreversible'],['调整 BP 投票分配','Updated BP vote allocation'],['昨天','Yesterday'],
  ['当前为','Current network:'],['当前账户','Current account'],['操作已完成','Done'],['确认节点投票','Confirm node vote'],['请核对交易内容，签名后将在下一 Epoch 生效','Review the transaction. It takes effect in the next epoch after signing.'],['网络','Network'],['账户','Account'],['选择 BP','Selected BPs'],['FLON 投票本金','FLON voting stake'],['每节点票权','Power per node'],['DAO 治理凭证','DAO governance receipt'],['GLON 仅用于 DAO 治理，不参与 BP 排名计算。','GLON is used only for DAO governance and does not count toward BP ranking.'],['总票权','Total power'],['生效 Epoch','Effective epoch'],['已入块不等于立即计入排名。新的节点分配将在 Epoch 1,249 边界生效。','Inclusion in a block does not immediately affect ranking. The new allocation takes effect at the Epoch 1,249 boundary.'],['取消','Cancel'],['在 HuFu 中签名','Sign in HuFu'],['签名请求已发送至 HuFu 钱包','Signature request sent to HuFu'],
  ['领取投票奖励','Claim voter rewards'],['已完成确定性结算','has completed deterministic settlement'],['可领取','Claimable'],['合约','Contract'],['领取账户','Recipient'],['稍后','Later'],['确认签名','Confirm signature'],['发起治理提案','Create governance proposal'],['选择提案类型后进入结构化创建流程','Select a proposal type to start the guided flow'],['文本 / 信号提案','Text / signal proposal'],['表达社区方向，不自动执行链上动作','Express community direction without automatic on-chain execution'],['参数提案','Parameter proposal'],['通过白名单 action 修改网络参数','Modify network parameters through allowlisted actions'],['包含预算、收款方与验收条件','Includes budget, recipient, and acceptance criteria'],
  ['申请 BP 竞选','Apply for BP election'],['提交前将检查自质押、节点状态和公开资料','Self-stake, node status, and public profile are checked before submission'],['当前状态','Current status'],['最低自质押','Minimum self-stake'],['由链上参数决定','Set by on-chain parameters'],['必填资料','Required profile'],['网站、X、地区、状态页','Website, X, region, status page'],['公开资料是候选人声明；已验证状态需经过独立核验。','Public profile data is candidate-declared; verified status requires independent review.'],['开始申请','Start application'],['注册进度','Registration progress'],['资格检查','Eligibility'],['公开资料','Public profile'],['节点配置','Node setup'],['确认注册','Review'],['账户存在','Account exists'],['尚未注册为 BP','Not registered as a BP'],['已注册，可更新资料','Registered; profile can be updated'],['注册权限','Registration authority'],['使用当前账户 active 权限签名','Signed with the current account active permission'],['当前合约未设置单独 BP 自质押门限','The current contract has no separate BP self-stake threshold'],['主网节点竞选尚未启用','Mainnet BP election is not enabled'],['当前主网 flon ABI 尚未包含 regproducer 和 producers 状态表。请先完成主网合约升级。','The current mainnet flon ABI does not yet include regproducer or the producers table. Upgrade the mainnet contract first.'],['下一步','Continue'],['上一步','Back'],['节点名称','Node name'],['官方网站','Official website'],['X 账号','X account'],['国家或地区','Country or region'],['状态页','Status page'],['出块公钥','Block signing key'],['用于签署区块，不应填写私钥','Used to sign blocks; never enter a private key'],['P2P 节点地址','P2P endpoint'],['API 节点地址','API endpoint'],['投票人奖励分享比例','Voter reward share'],['提交后，该比例将用于后续 Epoch 奖励分配。','After submission, this ratio applies to reward distribution in subsequent epochs.'],['检查并签名','Review and sign'],['注册交易预览','Registration transaction'],['合约参数与填写内容一致后，再请求 HuFu 签名。','Verify the contract parameters before requesting a HuFu signature.'],['注册成功时 flon.system 会同步注册 voter.reward。','On successful registration, flon.system also registers the producer with voter.reward.'],['X、状态页、P2P 和 API 地址不会进入当前 regproducer 状态表，需后续元数据服务保存。','X, status page, P2P, and API endpoints are not stored by the current regproducer table and require a metadata service.'],['正在请求钱包签名…','Requesting wallet signature…'],['注册交易已广播','Registration transaction broadcast'],['更新 BP 资料','Update BP profile'],['签名并注册','Sign and register'],['BP 注册签名请求已发送至 HuFu','BP registration signature request sent to HuFu'],['FullOn 主网','FullOn Mainnet'],['FullOn 测试网','FullOn Testnet'],['调整投票本金','Adjust voting stake'],['存入 FLON 将生成等额不可转让 GLON','Depositing FLON mints an equal amount of non-transferable GLON'],['可用 FLON','Available FLON'],['已投本金','Voting stake'],['撤票时 GLON立即销毁，节点排名与奖励票权在下一 Epoch 移除。','GLON is burned immediately when unstaking; ranking and reward power are removed in the next epoch.'],['撤回','Unstake'],['增加投票','Add stake'],
  ['参数提案 ·','Parameter proposal ·'],['快照','Snapshot'],['通过后执行','Executes after approval'],['创建并完成附议','Created and endorsed'],['正式投票中','Formal vote in progress'],['你的快照票权','Your snapshot power'],['达到 quorum 与通过率后进入','Begins after quorum and approval thresholds are met'],['任何账户均可触发执行','Any account may trigger execution'],['仅执行上方已冻结的白名单 action','Only the frozen allowlisted action above can execute'],['参与投票','Cast vote'],['反对','Against'],['不同意本次参数修改','Reject this parameter change'],['弃权','Abstain'],['计入 quorum，不计入赞成或反对','Counts toward quorum but not for or against'],['附议不会自动成为赞成票。本次选择需要再次由 HuFu 钱包签名。','An endorsement does not become a For vote automatically. This choice requires another HuFu signature.']
]);
[
  ['BP 生产状态','BP production status'],['连接 BP 账户钱包后读取链上状态','Connect the BP account wallet to load on-chain status'],['正在读取链上状态…','Loading on-chain status…'],['当前账户未注册为 BP','The current account is not registered as a BP'],['当前合约尚未支持 BP 自助恢复','The current contract does not yet support BP self-service recovery'],['链上状态读取失败','Failed to load on-chain status'],['暂停次数','Suspensions'],['当前 Epoch','Current Epoch'],['连续漏块','Consecutive misses'],['恢复生产','Resume production'],['冷却期尚未结束','Cooldown has not ended'],['暂停','Suspended'],['试运行','Probation'],['合格','Qualified'],['降级','Degraded'],['警告','Warning'],['样本不足','Insufficient sample'],['网络事件','Network incident'],['未评估','Not assessed'],['恢复后先进入试运行，不会直接视为合格。','Recovery starts probation and does not immediately restore qualified status.'],['试运行期间连续漏掉 12 个分配槽位会立即再次暂停。','Missing 12 consecutive assigned slots during probation causes immediate re-suspension.'],['再次暂停的冷却期按 6、12、24、48 小时递增，最高 48 小时。','Repeated suspension cooldowns escalate through 6, 12, 24, and 48 hours, capped at 48 hours.'],['需要 BP 账户 active 权限签名','Requires the BP account active permission'],['确认恢复生产','Confirm production recovery'],['交易成功后进入试运行，排班更新后才会重新获得出块槽位。','After the transaction succeeds, probation begins; block slots return only after the schedule updates.'],['我确认节点已在线并可持续签署区块','I confirm the node is online and can continuously sign blocks'],['签名并进入试运行','Sign and enter probation'],['正在请求钱包签名…','Requesting wallet signature…'],['恢复交易已广播','Recovery transaction broadcast'],['已进入试运行','Probation started'],['刷新状态','Refresh status']
].forEach(([zh,en])=>translations.set(zh,en));
[
  ['连接钱包后读取链上已结算余额','Connect wallet to load the settled on-chain balance'],['提案、附议、投票与 Timelock','Proposals, endorsement, voting, and Timelock'],['当前尚未配置可验证的治理合约数据源；本页不会构造或广播模拟治理交易。','No verified governance contract data source is configured. This page does not construct or broadcast simulated governance transactions.'],['待接入','Pending integration'],['候选','Candidates'],
  ['连接钱包后读取','Connect wallet to load'],['链上选举状态','On-chain election status'],['实时 RPC','Live RPC'],['链上候选排名','On-chain candidate ranking'],['历史索引服务待接入','History indexer not connected'],['正在读取链上 BP 排名…','Loading on-chain BP ranking…'],['正在读取候选 BP…','Loading candidate BPs…'],['链上 BP 数据读取失败，请稍后刷新。','Failed to load on-chain BP data. Please try again later.'],['链上 BP 数据尚未就绪','On-chain BP data is not ready yet'],['投票分配在下一 Epoch 生效','Vote allocation takes effect next epoch'],['待生效状态以 flon::pendingvote 链上记录为准','Pending state is read from flon::pendingvote'],['DAO 提案功能待接入','DAO proposal integration pending'],['治理合约 ABI 与部署地址确认后开放','Available after the governance ABI and deployment are verified'],['说明','Details'],['读取链上状态','Load on-chain status'],['待领取奖励','Claimable rewards'],['存在下一 Epoch 待生效修改','A change is pending for the next epoch'],['链上已结算','Settled on-chain'],['DAO Governance 尚未启用','DAO Governance is not enabled'],['当前站点未配置可验证的治理合约 ABI 与部署地址','This site has no verified governance contract ABI or deployment configured'],['提案、附议、正式投票、Timelock 和执行按钮已保持只读，不会请求钱包签名，也不会广播模拟交易。','Proposal, endorsement, formal voting, Timelock, and execution remain read-only; they neither request a wallet signature nor broadcast simulated transactions.'],['调整投票本金尚未启用','Voting stake adjustment is not enabled'],['需要先确认 addvote / subvote 的主网 ABI 与资产精度','The production addvote/subvote ABI and asset precision must be verified first'],['当前版本不会根据示例余额构造质押或撤票交易。节点选择与投票奖励领取已使用真实链上状态。','This version does not construct stake or unstake transactions from sample balances. BP selection and voter reward claims use real on-chain state.']
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
function closeSheet(){pendingVoteProducers=null;overlay.hidden=true;sheet.hidden=true;document.body.style.overflow=''}
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
function walletErrorMessage(error){const code=String(error?.message||error);const zh={WALLET_CHAIN_ID_MISMATCH:'钱包网络与当前站点不一致，请在 HuFu 中切换到对应网络',RPC_CHAIN_ID_MISMATCH:'RPC Chain ID 配置错误',RPC_TIMEOUT:'链上 RPC 连接超时',WALLET_RPC_TIMEOUT:'HuFu 当前节点 RPC 连接超时',HUFU_NETWORK_TIMEOUT:'HuFu 当前节点网络查询超时',HUFU_RPC_UNAVAILABLE:'当前 HuFu 版本未提供节点 RPC 接口',CHAIN_TIME_STALE:'节点区块时间异常或同步已停滞，请等待网络恢复后重试',HUFU_ACCOUNT_TIMEOUT:'HuFu 账户选择超时',HUFU_ACCOUNT_UNAVAILABLE:'未获取到 HuFu 账户',HUFU_PROVIDER_UNAVAILABLE:'未检测到 HuFu 钱包'};const en={WALLET_CHAIN_ID_MISMATCH:'The wallet network does not match this site. Switch to the corresponding network in HuFu.',WALLET_RPC_TIMEOUT:'The RPC node selected in HuFu timed out.',HUFU_NETWORK_TIMEOUT:'The network query to the node selected in HuFu timed out.',HUFU_RPC_UNAVAILABLE:'This HuFu version does not expose its node RPC interface.',CHAIN_TIME_STALE:'RPC block time is stale or incorrect. Retry after the network recovers.'};return currentLanguage==='zh-CN'?(zh[code]||`钱包连接失败：${code}`):(en[code]||`Wallet connection failed: ${code}`)}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function assetAmount(value){const amount=Number.parseFloat(String(value||'0'));return Number.isFinite(amount)?amount:0}
function formatVotes(value){const amount=Number(value||0)/100000000;if(amount>=1000000)return`${(amount/1000000).toFixed(2)}M`;if(amount>=1000)return`${(amount/1000).toFixed(1)}K`;return amount.toFixed(2)}
function producerInitials(account){return String(account).split('.').map(part=>part[0]||'').join('').slice(0,2).toUpperCase()||'BP'}
async function refreshElection(){
  try{
    electionState=await loadElection();
    const nodeList=document.querySelector('.node-list'),selectList=document.querySelector('.select-list');
    if(nodeList)nodeList.innerHTML=electionState.producers.map((producer,index)=>`<button class="node-card" type="button" data-status="${escapeHtml(producer.status)}" data-name="${escapeHtml(`${producer.owner} ${producer.url||''}`.toLowerCase())}"><span class="rank din">${String(index+1).padStart(2,'0')}</span><span class="node-logo blue-logo">${escapeHtml(producerInitials(producer.owner))}</span><span class="node-main"><strong>${escapeHtml(producer.owner)}</strong><small>${escapeHtml(producer.url||'No public URL')}</small><span><b>${escapeHtml(producer.status)}</b><em>分享 ${Number(producer.reward_shared_ratio||0)/100}%</em></span></span><span class="node-votes"><strong class="din">${escapeHtml(formatVotes(producer.total_votes))}</strong><small>有效票权</small><svg><use href="#i-chevron"/></svg></span></button>`).join('');
    if(selectList)selectList.innerHTML=electionState.producers.filter(producer=>producer.status!=='suspended').slice(0,51).map((producer,index)=>`<label class="select-node" data-producer="${escapeHtml(producer.owner)}"><input type="checkbox"><span class="check"><svg><use href="#i-check"/></svg></span><span class="node-logo blue-logo">${escapeHtml(producerInitials(producer.owner))}</span><span><strong>${escapeHtml(producer.owner)}</strong><small>#${index+1} · ${escapeHtml(producer.status)}</small></span><em>分享 ${Number(producer.reward_shared_ratio||0)/100}%</em></label>`).join('');
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
  votingState=walletSession?await loadVotingAccount(walletSession.account):null;
  renderVotingAccount();syncVotingSelection();updateAllocation();
}
function setText(selector,value){document.querySelectorAll(selector).forEach(node=>node.textContent=value)}
function renderVotingAccount(){
  const connected=Boolean(walletSession&&votingState);
  const glon=connected?votingState.glon:'— GLON';
  const glonAmount=connected?assetAmount(glon).toFixed(8):'—';
  const nodeVoteStake=connected?votingState.nodeVoteStake:'— FLON';
  const nodeVoteAmount=connected?assetAmount(nodeVoteStake).toFixed(8):'—';
  const producers=connected?(votingState.pendingProducers||votingState.effectiveProducers||[]):[];
  const rewards=connected?votingState.unclaimedRewards:'— FLON';
  setText('[data-glon-balance]',`${glonAmount} GLON`);setText('[data-profile-glon]',`${glonAmount} GLON`);setText('[data-vote-stake]',connected?nodeVoteStake:'— FLON');
  setText('[data-voting-stake]',connected?nodeVoteAmount:'—');setText('[data-voted-bps]',connected?`${producers.length} / 30`:'— / 30');setText('[data-profile-votes]',connected?`${producers.length} 个 BP`:'— 个 BP');
  setText('[data-unclaimed-rewards]',rewards);setText('[data-profile-rewards]',rewards);setText('[data-profile-claimable]',connected?rewards:'连接钱包后读取');
  setText('[data-claimable-summary]',connected?`链上已结算 ${rewards}`:'连接钱包后读取链上已结算余额');
  setText('[data-voting-status]',connected?(votingState.pendingProducers?'存在下一 Epoch 待生效修改':'全部已生效'):'连接钱包后读取');
  setText('[data-vote-source]',connected?'投票后生成等额不可转让 GLON，用于 DAO 治理':'连接钱包后读取链上 FLON 投票本金');
  applyTranslations();
}
function syncVotingSelection(){
  if(!votingState)return;
  const selected=new Set(votingState.pendingProducers||votingState.effectiveProducers||[]);
  document.querySelectorAll('.select-node').forEach(label=>{const input=label.querySelector('input');if(input)input.checked=selected.has(label.dataset.producer)});
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
function openCandidateWizard(step=1){
  candidateStep=step;
  let body='';
  if(step===1){const minimum=candidateChainState.selfStakeConfig?.min_self_stake||'未配置';const current=candidateChainState.selfStake?.staked||'0 FLON';const qualified=candidateChainState.selfStakeSupported&&assetAmount(current)>=assetAmount(minimum);body=`<div class="eligibility-list"><article><i>✓</i><span><strong>账户存在</strong><small>${escapeHtml(candidateDraft.account)}@${escapeHtml(walletSession?.permission||'active')}</small></span></article><article><i>✓</i><span><strong>${candidateChainState.registered?'已注册，可更新资料':'尚未注册为 BP'}</strong><small>flon::producers</small></span></article><article><i>✓</i><span><strong>注册权限</strong><small>使用当前账户 active 权限签名</small></span></article><article class="${qualified?'':'is-pending'}"><i>${qualified?'✓':'i'}</i><span><strong>自质押门限</strong><small>${candidateChainState.selfStakeSupported?`已质押 ${escapeHtml(current)} / 最低 ${escapeHtml(minimum)}`:'当前链上合约尚未启用 BP 自质押表'}</small></span></article></div><p class="sign-warning">${qualified?'公开资料是候选人声明；已验证状态需经过独立核验。':'请先通过 flon::stakebp 补足自质押；不足时注册或更新交易会被链上拒绝。'}</p><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">取消</button><button class="primary-button" data-action="candidate-next" ${candidateChainState.selfStakeSupported&&!qualified?'disabled':''}>下一步</button></div>`;}
  if(step===2)body=`<form class="wizard-form" data-candidate-form><label><span>节点名称</span><input name="nodeName" required maxlength="50" value="${escapeHtml(candidateDraft.nodeName||'')}"></label><label><span>官方网站</span><input name="website" type="url" required maxlength="511" placeholder="https://example.com" value="${escapeHtml(candidateDraft.website)}"></label><label><span>X 账号</span><input name="xAccount" required maxlength="32" placeholder="@example" value="${escapeHtml(candidateDraft.xAccount)}"></label><label><span>国家或地区</span><select name="region" required><option value="702" ${candidateDraft.region==='702'?'selected':''}>Singapore · 702</option><option value="156" ${candidateDraft.region==='156'?'selected':''}>China · 156</option><option value="344" ${candidateDraft.region==='344'?'selected':''}>Hong Kong · 344</option><option value="392" ${candidateDraft.region==='392'?'selected':''}>Japan · 392</option><option value="840" ${candidateDraft.region==='840'?'selected':''}>United States · 840</option></select></label><label><span>状态页</span><input name="statusUrl" type="url" required placeholder="https://status.example.com" value="${escapeHtml(candidateDraft.statusUrl)}"></label></form><div class="sheet-actions"><button class="secondary-button" data-action="candidate-back">上一步</button><button class="primary-button" data-action="candidate-next">下一步</button></div>`;
  if(step===3)body=`<form class="wizard-form" data-candidate-form><label><span>出块公钥</span><textarea name="producerKey" required minlength="50" rows="3" placeholder="FU…">${escapeHtml(candidateDraft.producerKey)}</textarea><small>用于签署区块，不应填写私钥</small></label><label><span>P2P 节点地址</span><input name="p2pEndpoint" required placeholder="p2p.example.com:9876" value="${escapeHtml(candidateDraft.p2pEndpoint)}"></label><label><span>API 节点地址</span><input name="apiEndpoint" type="url" required placeholder="https://api.example.com" value="${escapeHtml(candidateDraft.apiEndpoint)}"></label><label><span>投票人奖励分享比例 <b data-share-output>${escapeHtml(candidateDraft.shareRatio)}%</b></span><input name="shareRatio" type="range" min="0" max="100" step="1" value="${escapeHtml(candidateDraft.shareRatio)}"></label><p class="field-note">提交后，该比例将用于后续 Epoch 奖励分配。</p></form><div class="sheet-actions"><button class="secondary-button" data-action="candidate-back">上一步</button><button class="primary-button" data-action="candidate-next">检查并签名</button></div>`;
  if(step===4){const ratio=Math.round(Number(candidateDraft.shareRatio)*100);body=`<div class="sign-summary"><div><span>网络</span><strong>${escapeHtml(networkName())}</strong></div><div><span>账户</span><strong>${escapeHtml(candidateDraft.account)}@${escapeHtml(walletSession?.permission||'active')}</strong></div><div><span>Action</span><strong>flon::regproducer</strong></div><div><span>producer_key</span><strong class="truncate-value">${escapeHtml(candidateDraft.producerKey)}</strong></div><div><span>url</span><strong>${escapeHtml(candidateDraft.website)}</strong></div><div><span>location</span><strong>${escapeHtml(candidateDraft.region)}</strong></div><div><span>reward_shared_ratio</span><strong>${ratio} (${escapeHtml(candidateDraft.shareRatio)}%)</strong></div></div><div class="profile-review"><strong>${escapeHtml(candidateDraft.nodeName)}</strong><small>${escapeHtml(candidateDraft.xAccount)} · ${escapeHtml(candidateDraft.statusUrl)}</small><small>P2P ${escapeHtml(candidateDraft.p2pEndpoint)}</small><small>API ${escapeHtml(candidateDraft.apiEndpoint)}</small></div><p class="sign-warning">合约参数与填写内容一致后，再请求 HuFu 签名。注册成功时 flon.system 会同步注册 voter.reward。X、状态页、P2P 和 API 地址不会进入当前 regproducer 状态表，需后续元数据服务保存。</p><div class="sheet-actions"><button class="secondary-button" data-action="candidate-back">上一步</button><button class="primary-button" data-action="candidate-sign">${candidateChainState.registered?'更新 BP 资料':'签名并注册'}</button></div>`}
  openSheet(`<h2 id="sheet-title">申请 BP 竞选</h2><p class="sheet-subtitle">${candidateStep}/4 · ${['资格检查','公开资料','节点配置','确认注册'][candidateStep-1]}</p>${candidateSteps()}${body}`);
}

function selectedProducers(){return [...document.querySelectorAll('.select-node input:checked')].map(input=>input.closest('.select-node')?.dataset.producer).filter(Boolean).sort()}
function restoreSelectedProducers(producers){
  const selected=new Set(producers);
  document.querySelectorAll('.select-node').forEach(label=>{const input=label.querySelector('input');if(input)input.checked=selected.has(label.dataset.producer)});
  updateAllocation();
}
async function confirmVote(){
  if(!walletSession){openWalletSheet();return}
  if(!electionState){showToast('链上 BP 数据尚未就绪');return}
  const producers=selectedProducers();if(producers.length>30){showToast('最多选择 30 个 BP');return}
  try{await refreshVotingAccount()}catch(error){showToast(`读取链上票权失败：${String(error?.message||error)}`);return}
  // refreshVotingAccount synchronizes the checkboxes with the current on-chain
  // allocation. Restore the user's draft before rendering and signing it.
  restoreSelectedProducers(producers);pendingVoteProducers=producers;
  const nodeVoteStake=votingState?.nodeVoteStake||'0.00000000 FLON';
  const powerPerNode=producers.length?(assetAmount(nodeVoteStake)/producers.length).toFixed(8):'0.00000000';
  openSheet(`<h2 id="sheet-title">确认节点投票</h2><p class="sheet-subtitle">请核对交易内容，签名后将在下一 Epoch 生效</p><div class="sign-summary"><div><span>网络</span><strong>${escapeHtml(networkName())}</strong></div><div><span>账户</span><strong>${escapeHtml(walletSession.account)}@${escapeHtml(walletSession.permission)}</strong></div><div><span>Action</span><strong>flon::voteproducer</strong></div><div><span>选择 BP</span><strong>${producers.length} 个</strong></div><div><span>FLON 投票本金</span><strong>${escapeHtml(nodeVoteStake)}</strong></div><div><span>每节点票权</span><strong>${escapeHtml(powerPerNode)} FLON</strong></div><div><span>DAO 治理凭证</span><strong>${escapeHtml(votingState?.glon||'0.00000000 GLON')}</strong></div></div><p class="sign-warning">目标列表将按账户名排序提交。交易入块后，新的分配在下一 Epoch 边界生效。GLON 仅用于 DAO 治理，不参与 BP 排名计算。</p><div class="profile-review"><small>${escapeHtml(producers.join(' · ')||'清空全部 BP 投票')}</small></div><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">取消</button><button class="primary-button" data-action="vote-sign">在 HuFu 中签名</button></div>`);
}
async function submitVote(target){
  if(!walletSession)return;const producers=pendingVoteProducers?[...pendingVoteProducers]:selectedProducers();target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  try{const result=await transact(walletSession,[{account:'flon',name:'voteproducer',data:{voter:walletSession.account,producers}}]),id=transactionId(result);pendingVoteProducers=null;openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">节点投票已广播</h2><p>${escapeHtml(producers.length)} 个 BP · 下一 Epoch 生效</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);await refreshVotingAccount()}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'在 HuFu 中签名':'Sign in HuFu';showToast(String(error?.message||error))}
}
async function confirmClaimRewards(){
  if(!walletSession){openWalletSheet();return}
  try{await refreshVotingAccount()}catch(error){showToast(`读取奖励失败：${String(error?.message||error)}`);return}
  openSheet(`<h2 id="sheet-title">领取投票奖励</h2><p class="sheet-subtitle">奖励不会自动空投；未领取余额持续累积，不会因错过 Epoch 丢失</p><div class="sign-summary"><div><span>链上已结算</span><strong>${escapeHtml(votingState?.unclaimedRewards||'0.00000000 FLON')}</strong></div><div><span>合约</span><strong>voter.reward</strong></div><div><span>Action</span><strong>claimrewards</strong></div><div><span>领取账户</span><strong>${escapeHtml(walletSession.account)}</strong></div></div><p class="sign-warning">领取必须由当前受益账户本人签名，第三方不能代领。最终到账金额以交易执行结果为准。</p><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">稍后</button><button class="primary-button" data-action="claim-sign">确认签名</button></div>`);
}
async function submitClaimRewards(target){
  if(!walletSession)return;target.disabled=true;target.textContent=currentLanguage==='zh-CN'?'正在请求钱包签名…':'Requesting wallet signature…';
  try{const result=await transact(walletSession,[{account:'voter.reward',name:'claimrewards',data:{voter:walletSession.account}}]),id=transactionId(result);openSheet(`<div class="success-result"><span>✓</span><h2 id="sheet-title">奖励领取交易已广播</h2><p>${escapeHtml(walletSession.account)}</p>${id?`<code>${escapeHtml(id)}</code>`:''}</div><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);await refreshVotingAccount()}catch(error){target.disabled=false;target.textContent=currentLanguage==='zh-CN'?'确认签名':'Confirm signature';showToast(String(error?.message||error))}
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
  if(action==='clear-selection'){document.querySelectorAll('.select-node input').forEach(input=>input.checked=false);updateAllocation()}
  if(action==='sign-vote')await confirmVote();
  if(action==='vote-sign')await submitVote(target);
  if(action==='governance-unavailable')openSheet(`<h2 id="sheet-title">DAO Governance 尚未启用</h2><p class="sheet-subtitle">当前站点未配置可验证的治理合约 ABI 与部署地址</p><p class="sign-warning">提案、附议、正式投票、Timelock 和执行按钮已保持只读，不会请求钱包签名，也不会广播模拟交易。</p><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`);
  if(action==='claim')await confirmClaimRewards();
  if(action==='claim-sign')await submitClaimRewards(target);
  if(action==='candidate')await prepareCandidate();
  if(action==='candidate-next'&&saveCandidateStep())openCandidateWizard(Math.min(4,candidateStep+1));
  if(action==='candidate-back'){saveCandidateStep();openCandidateWizard(Math.max(1,candidateStep-1))}
  if(action==='candidate-sign')await submitCandidate(target);
  if(action==='refresh-bp-status')await refreshBPRecovery();
  if(action==='resume-producer')confirmResumeProducer();
  if(action==='resume-producer-sign')await submitResumeProducer(target);
  if(action==='stake')openSheet(`<h2 id="sheet-title">调整投票本金尚未启用</h2><p class="sheet-subtitle">需要先确认 addvote / subvote 的主网 ABI 与资产精度</p><p class="sign-warning">当前版本不会根据示例余额构造质押或撤票交易。节点选择与投票奖励领取已使用真实链上状态。</p><div class="sheet-actions one"><button class="primary-button" data-action="close-sheet">完成</button></div>`)
});
overlay.addEventListener('click',closeSheet);
document.addEventListener('change',event=>{if(event.target.matches('.select-node input'))updateAllocation();if(event.target.matches('[data-resume-confirm]')){const button=sheetContent.querySelector('[data-action="resume-producer-sign"]');if(button)button.disabled=!event.target.checked}});
document.addEventListener('input',event=>{if(event.target.matches('[name="shareRatio"]')){const output=sheetContent.querySelector('[data-share-output]');if(output)output.textContent=`${event.target.value}%`}});
document.querySelector('[data-language]').addEventListener('change',event=>{currentLanguage=event.target.value;localStorage.setItem('flon-daogov-language',currentLanguage);applyTranslations();showToast(currentLanguage==='zh-CN'?'语言已切换为中文':'Language changed to English')});

function selectedCount(){return [...document.querySelectorAll('.select-node input:checked')].length}
function perNode(){const count=selectedCount(),total=assetAmount(votingState?.nodeVoteStake);return count?(total/count).toFixed(8):'0.00000000'}
function updateAllocation(){document.querySelector('[data-selected-count]').textContent=`${selectedCount()} / 30`;document.querySelector('[data-per-node]').textContent=perNode()}
document.querySelectorAll('[data-node-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-node-filter]').forEach(b=>b.classList.toggle('is-active',b===button));document.querySelectorAll('.node-card').forEach(card=>card.hidden=button.dataset.nodeFilter!=='all'&&card.dataset.status!==button.dataset.nodeFilter)}));
document.querySelector('[data-node-search]').addEventListener('input',event=>{const query=event.target.value.trim().toLowerCase();document.querySelectorAll('.node-card').forEach(card=>card.hidden=query&&!card.dataset.name.includes(query))});
document.querySelectorAll('[data-proposal-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-proposal-filter]').forEach(b=>b.classList.toggle('is-active',b===button));document.querySelectorAll('.proposal-item').forEach(card=>card.hidden=button.dataset.proposalFilter!=='all'&&card.dataset.status!==button.dataset.proposalFilter)}));

applyTranslations();
renderVotingAccount();
refreshElection();
restoreWallet().then(async session=>{walletSession=session;renderWallet();await refreshVotingAccount()}).catch(()=>renderWallet());
