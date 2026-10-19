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

const translations=new Map([
  ['跳到主要内容','Skip to main content'],['返回 HuFu','Back to HuFu'],['治理中心','DAO Governance'],['治理通知','Governance notifications'],['语言','Language'],
  ['概览','Overview'],['投票','Vote'],['治理','Governance'],['我的','Mine'],['当前治理账户','Governance account'],['日常钱包','Daily wallet'],['我的治理权','My governance power'],['全部已生效','All effective'],
  ['已投 FLON','Staked FLON'],['已选 BP','Selected BPs'],['待领取','Claimable'],['进行中','in progress'],['当前席位','Active seats'],['区块','Block'],['需要你处理','Action required'],['全部','All'],
  ['正式投票','Formal vote'],['剩余','Remaining'],['小时','hours'],['你有','You have'],['票权','voting power'],['去投票','Vote now'],['投票奖励已结算','Voter rewards settled'],['领取','Claim'],['个所投节点进入','voted node entered'],['建议检查节点状态与待生效排名','Review node status and pending ranking'],['查看','View'],
  ['网络概况','Network overview'],['节点排名','Node ranking'],['目标','Target'],['网络出块率','Block production'],['近 24 小时','Last 24 hours'],['总投票本金','Total voting stake'],['活跃投票人','Active voters'],['近 7 天','Last 7 days'],
  ['社区治理','Community governance'],['查看全部','View all'],['投票中','Voting'],['将 Active BP 席位从 3 个扩展至 7 个','Expand Active BP seats from 3 to 7'],['根据候选节点稳定性和网络负载，分阶段扩大出块节点集合。','Expand the producer set in phases based on node stability and network load.'],['赞成','For'],
  ['网络节点','Network nodes'],['BP 竞选','BP Election'],['申请竞选','Apply'],['候选节点','Candidates'],['全部候选','All candidates'],['搜索账户、名称或地区','Search account, name, or region'],['新加坡','Singapore'],['东京','Tokyo'],['法兰克福','Frankfurt'],['香港','Hong Kong'],['首尔','Seoul'],['在线','uptime'],['分享','share'],['有效票权','effective votes'],['差','gap'],
  ['节点投票','Node voting'],['分配治理票权','Allocate governance power'],['总票权在所选 BP 之间平均分配，不会复制放大','Total voting power is divided equally across selected BPs and is never duplicated'],['可分配票权','Allocatable power'],['来自','Backed by'],['投票本金','voting stake'],['已选择','Selected'],['每个 BP','Per BP'],['修改将在','Changes take effect in'],['生效',''],['本 Epoch 奖励仍按当前 6 个节点计算','This epoch reward still uses the current 6-node allocation'],['选择 BP','Select BPs'],['清空','Clear'],['调整本金','Adjust stake'],['确认分配','Confirm allocation'],
  ['社区决策','Community decisions'],['DAO 治理','DAO Governance'],['发起提案','Create proposal'],['附议中','Endorsement'],['待执行','Ready to execute'],['建立生态开发者季度资助计划','Create a quarterly ecosystem developer grants program'],['资金提案','Treasury proposal'],['提案人','Proposer'],['人附议','endorsers'],['可附议','Endorse'],['后可执行','until executable'],['启用六小时奖励 Epoch 与历史票权结算','Enable six-hour reward epochs and historical voting-power settlement'],['合约参数','Contract parameters'],['已通过 · 安全等待期','Passed · security delay'],['执行目标','Execution target'],['查看执行内容','View execution'],
  ['我的治理','My Governance'],['累计奖励','Lifetime rewards'],['领取奖励','Claim rewards'],['我的节点投票','My BP votes'],['竞选管理','Election management'],['未注册','Not registered'],['我的治理任务','My governance tasks'],['等待你投票','awaits your vote'],['快照票权','snapshot power'],['处理','Act'],['节点分配已在','Node allocation became effective in'],['投票奖励完成结算','Voter rewards settled'],['治理记录','Governance history'],['打开完整链上治理记录','Open full on-chain governance history'],['附议','Endorsed'],['交易不可逆','Transaction is irreversible'],['调整 BP 投票分配','Updated BP vote allocation'],['昨天','Yesterday'],
  ['当前为','Current network:'],['当前账户','Current account'],['操作已完成','Done'],['确认节点投票','Confirm node vote'],['请核对交易内容，签名后将在下一 Epoch 生效','Review the transaction. It takes effect in the next epoch after signing.'],['网络','Network'],['账户','Account'],['选择 BP','Selected BPs'],['总票权','Total power'],['每节点票权','Power per node'],['生效 Epoch','Effective epoch'],['已入块不等于立即计入排名。新的节点分配将在 Epoch 1,249 边界生效。','Inclusion in a block does not immediately affect ranking. The new allocation takes effect at the Epoch 1,249 boundary.'],['取消','Cancel'],['在 HuFu 中签名','Sign in HuFu'],['签名请求已发送至 HuFu 钱包','Signature request sent to HuFu'],
  ['领取投票奖励','Claim voter rewards'],['已完成确定性结算','has completed deterministic settlement'],['可领取','Claimable'],['合约','Contract'],['领取账户','Recipient'],['稍后','Later'],['确认签名','Confirm signature'],['发起治理提案','Create governance proposal'],['选择提案类型后进入结构化创建流程','Select a proposal type to start the guided flow'],['文本 / 信号提案','Text / signal proposal'],['表达社区方向，不自动执行链上动作','Express community direction without automatic on-chain execution'],['参数提案','Parameter proposal'],['通过白名单 action 修改网络参数','Modify network parameters through allowlisted actions'],['包含预算、收款方与验收条件','Includes budget, recipient, and acceptance criteria'],
  ['申请 BP 竞选','Apply for BP election'],['提交前将检查自质押、节点状态和公开资料','Self-stake, node status, and public profile are checked before submission'],['当前状态','Current status'],['最低自质押','Minimum self-stake'],['由链上参数决定','Set by on-chain parameters'],['必填资料','Required profile'],['网站、X、地区、状态页','Website, X, region, status page'],['公开资料是候选人声明；已验证状态需经过独立核验。','Public profile data is candidate-declared; verified status requires independent review.'],['开始申请','Start application'],['调整投票本金','Adjust voting stake'],['存入 FLON 将生成等额不可转让 GLON','Depositing FLON mints an equal amount of non-transferable GLON'],['可用 FLON','Available FLON'],['已投本金','Voting stake'],['撤票时 GLON立即销毁，节点排名与奖励票权在下一 Epoch 移除。','GLON is burned immediately when unstaking; ranking and reward power are removed in the next epoch.'],['撤回','Unstake'],['增加投票','Add stake'],
  ['参数提案 ·','Parameter proposal ·'],['快照','Snapshot'],['通过后执行','Executes after approval'],['创建并完成附议','Created and endorsed'],['正式投票中','Formal vote in progress'],['你的快照票权','Your snapshot power'],['达到 quorum 与通过率后进入','Begins after quorum and approval thresholds are met'],['任何账户均可触发执行','Any account may trigger execution'],['仅执行上方已冻结的白名单 action','Only the frozen allowlisted action above can execute'],['参与投票','Cast vote'],['反对','Against'],['不同意本次参数修改','Reject this parameter change'],['弃权','Abstain'],['计入 quorum，不计入赞成或反对','Counts toward quorum but not for or against'],['附议不会自动成为赞成票。本次选择需要再次由 HuFu 钱包签名。','An endorsement does not become a For vote automatically. This choice requires another HuFu signature.']
]);
const sourceText=new WeakMap();
const sourceAttrs=new WeakMap();
let currentLanguage=localStorage.getItem('flon-daogov-language')||((navigator.languages||[navigator.language||'en'])[0].toLowerCase().startsWith('zh')?'zh-CN':'en');

function translateText(value){if(currentLanguage==='zh-CN')return value;let output=value;[...translations.entries()].sort((a,b)=>b[0].length-a[0].length).forEach(([zh,en])=>{output=output.split(zh).join(en)});return output}
function applyTranslations(root=document){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){if(!sourceText.has(node))sourceText.set(node,node.nodeValue);node.nodeValue=currentLanguage==='zh-CN'?sourceText.get(node):translateText(sourceText.get(node))}
  root.querySelectorAll?.('[placeholder],[aria-label],[data-message]').forEach(el=>{if(!sourceAttrs.has(el))sourceAttrs.set(el,{placeholder:el.getAttribute('placeholder'),ariaLabel:el.getAttribute('aria-label'),message:el.getAttribute('data-message')});const attrs=sourceAttrs.get(el);for(const [key,value] of Object.entries(attrs)){const name=key==='ariaLabel'?'aria-label':key==='message'?'data-message':key;if(value!==null)el.setAttribute(name,currentLanguage==='zh-CN'?value:translateText(value))}});
  document.documentElement.lang=currentLanguage;const picker=document.querySelector('[data-language]');if(picker)picker.value=currentLanguage;
}

document.documentElement.dataset.network=runtimeConfig.network;
document.querySelectorAll('[data-network-name]').forEach(node=>node.textContent=runtimeConfig.networkName);

function showView(name){
  views.forEach(view=>{const active=view.dataset.view===name;view.hidden=!active;view.classList.toggle('is-active',active)});
  nav.forEach(button=>button.classList.toggle('is-active',button.dataset.viewTarget===name));
  window.scrollTo({top:0,behavior:'smooth'});
}
function showToast(message){clearTimeout(toastTimer);toast.textContent=message;toast.hidden=false;toastTimer=setTimeout(()=>toast.hidden=true,2200)}
function openSheet(html){sheetContent.innerHTML=html;applyTranslations(sheetContent);overlay.hidden=false;sheet.hidden=false;document.body.style.overflow='hidden'}
function closeSheet(){overlay.hidden=true;sheet.hidden=true;document.body.style.overflow=''}

document.addEventListener('click',event=>{
  const target=event.target.closest('button,[data-action]');if(!target)return;
  if(target.dataset.viewTarget)showView(target.dataset.viewTarget);
  const action=target.dataset.action;
  if(action==='toast')showToast(target.dataset.message||'操作已完成');
  if(action==='close-sheet')closeSheet();
  if(action==='network')showToast(`当前为 ${runtimeConfig.networkName} · Chain ID ${runtimeConfig.chainId.slice(0,4)}…${runtimeConfig.chainId.slice(-3)}`);
  if(action==='account')showToast('当前账户 flonian · 日常钱包');
  if(action==='clear-selection'){document.querySelectorAll('.select-node input').forEach(input=>input.checked=false);updateAllocation()}
  if(action==='sign-vote')openSheet(`<h2 id="sheet-title">确认节点投票</h2><p class="sheet-subtitle">请核对交易内容，签名后将在下一 Epoch 生效</p><div class="sign-summary"><div><span>网络</span><strong>${runtimeConfig.networkName}</strong></div><div><span>账户</span><strong>flonian@active</strong></div><div><span>Action</span><strong>flon::voteproducer</strong></div><div><span>选择 BP</span><strong>${selectedCount()} 个</strong></div><div><span>总票权</span><strong>1,200.00000000 GLON</strong></div><div><span>每节点票权</span><strong>${perNode()} GLON</strong></div><div><span>生效 Epoch</span><strong>1,249</strong></div></div><p class="sign-warning">已入块不等于立即计入排名。新的节点分配将在 Epoch 1,249 边界生效。</p><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">取消</button><button class="primary-button" data-action="signed">在 HuFu 中签名</button></div>`);
  if(action==='signed'){closeSheet();showToast('签名请求已发送至 HuFu 钱包')}
  if(action==='claim')openSheet(`<h2 id="sheet-title">领取投票奖励</h2><p class="sheet-subtitle">Epoch 1,246–1,247 已完成确定性结算</p><div class="sign-summary"><div><span>可领取</span><strong>18.42000000 FLON</strong></div><div><span>合约</span><strong>voter.reward</strong></div><div><span>Action</span><strong>claimrewards</strong></div><div><span>领取账户</span><strong>flonian</strong></div></div><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">稍后</button><button class="primary-button" data-action="signed">确认签名</button></div>`);
  if(action==='proposal-detail')openProposal();
  if(action==='create-proposal')openSheet(`<h2 id="sheet-title">发起治理提案</h2><p class="sheet-subtitle">选择提案类型后进入结构化创建流程</p><div class="task-list"><button class="task" data-action="toast" data-message="进入文本提案创建器"><span class="task-icon blue"><svg><use href="#i-edit"/></svg></span><span><strong>文本 / 信号提案</strong><small>表达社区方向，不自动执行链上动作</small></span><svg><use href="#i-chevron"/></svg></button><button class="task" data-action="toast" data-message="进入参数提案创建器"><span class="task-icon purple"><svg><use href="#i-dao"/></svg></span><span><strong>参数提案</strong><small>通过白名单 action 修改网络参数</small></span><svg><use href="#i-chevron"/></svg></button><button class="task" data-action="toast" data-message="进入资金提案创建器"><span class="task-icon mint"><svg><use href="#i-reward"/></svg></span><span><strong>资金提案</strong><small>包含预算、收款方与验收条件</small></span><svg><use href="#i-chevron"/></svg></button></div>`);
  if(action==='candidate')openSheet(`<h2 id="sheet-title">申请 BP 竞选</h2><p class="sheet-subtitle">提交前将检查自质押、节点状态和公开资料</p><div class="sign-summary"><div><span>账户</span><strong>flonian</strong></div><div><span>当前状态</span><strong>未注册</strong></div><div><span>最低自质押</span><strong>由链上参数决定</strong></div><div><span>必填资料</span><strong>网站、X、地区、状态页</strong></div></div><p class="sign-warning">公开资料是候选人声明；已验证状态需经过独立核验。</p><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">取消</button><button class="primary-button" data-action="toast" data-message="进入 BP 注册向导">开始申请</button></div>`);
  if(action==='stake')openSheet(`<h2 id="sheet-title">调整投票本金</h2><p class="sheet-subtitle">存入 FLON 将生成等额不可转让 GLON</p><div class="sign-summary"><div><span>可用 FLON</span><strong>8,426.12000000</strong></div><div><span>已投本金</span><strong>1,200.00000000</strong></div><div><span>GLON</span><strong>1,200.00000000</strong></div></div><p class="sign-warning">撤票时 GLON立即销毁，节点排名与奖励票权在下一 Epoch 移除。</p><div class="sheet-actions"><button class="secondary-button" data-action="toast" data-message="进入撤票流程">撤回</button><button class="primary-button" data-action="toast" data-message="进入增加投票流程">增加投票</button></div>`)
});
overlay.addEventListener('click',closeSheet);
document.addEventListener('change',event=>{if(event.target.matches('.select-node input'))updateAllocation()});
document.querySelector('[data-language]').addEventListener('change',event=>{currentLanguage=event.target.value;localStorage.setItem('flon-daogov-language',currentLanguage);applyTranslations();showToast(currentLanguage==='zh-CN'?'语言已切换为中文':'Language changed to English')});

function selectedCount(){return [...document.querySelectorAll('.select-node input:checked')].length}
function perNode(){const count=selectedCount();return count?(1200/count).toFixed(8):'0.00000000'}
function updateAllocation(){document.querySelector('[data-selected-count]').textContent=`${selectedCount()} / 30`;document.querySelector('[data-per-node]').textContent=perNode()}
function openProposal(){openSheet(`<div class="proposal-detail-head"><div class="detail-status"><span class="status voting">投票中</span><span class="proposal-id">FIP-0002</span></div><h2 id="sheet-title">将 Active BP 席位从 3 个扩展至 7 个</h2><p class="sheet-subtitle">参数提案 · fullonlabs · 快照 Epoch 1,247</p></div><div class="vote-result"><span><i style="width:71%"></i></span><small><b>赞成 71%</b><em>Quorum 54% / 40%</em></small></div><div class="detail-actions">通过后执行<code>flon::setparams { active_bp_quorum: 7 }</code></div><div class="detail-timeline"><article><strong>创建并完成附议</strong><small>128 人附议 · 2026-10-17 10:30</small></article><article><strong>正式投票中</strong><small>剩余 18 小时 · 你的快照票权 1,200 GLON</small></article><article><strong>48 小时 Timelock</strong><small>达到 quorum 与通过率后进入</small></article><article><strong>任何账户均可触发执行</strong><small>仅执行上方已冻结的白名单 action</small></article></div><div class="sheet-actions"><button class="secondary-button" data-action="close-sheet">稍后</button><button class="primary-button" data-action="vote-proposal">参与投票</button></div>`)}

document.addEventListener('click',event=>{const target=event.target.closest('[data-action="vote-proposal"]');if(!target)return;openSheet(`<h2 id="sheet-title">FIP-0002 投票</h2><p class="sheet-subtitle">你的快照票权：1,200.00000000 GLON</p><div class="task-list"><button class="task" data-action="signed"><span class="record-icon success"><svg><use href="#i-check"/></svg></span><span><strong>赞成</strong><small>支持按提案内容执行</small></span></button><button class="task" data-action="signed"><span class="record-icon"><svg><use href="#i-close"/></svg></span><span><strong>反对</strong><small>不同意本次参数修改</small></span></button><button class="task" data-action="signed"><span class="record-icon"><svg><use href="#i-info"/></svg></span><span><strong>弃权</strong><small>计入 quorum，不计入赞成或反对</small></span></button></div><p class="sign-warning">附议不会自动成为赞成票。本次选择需要再次由 HuFu 钱包签名。</p>`)});

document.querySelectorAll('[data-node-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-node-filter]').forEach(b=>b.classList.toggle('is-active',b===button));document.querySelectorAll('.node-card').forEach(card=>card.hidden=button.dataset.nodeFilter!=='all'&&card.dataset.status!==button.dataset.nodeFilter)}));
document.querySelector('[data-node-search]').addEventListener('input',event=>{const query=event.target.value.trim().toLowerCase();document.querySelectorAll('.node-card').forEach(card=>card.hidden=query&&!card.dataset.name.includes(query))});
document.querySelectorAll('[data-proposal-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-proposal-filter]').forEach(b=>b.classList.toggle('is-active',b===button));document.querySelectorAll('.proposal-item').forEach(card=>card.hidden=button.dataset.proposalFilter!=='all'&&card.dataset.status!==button.dataset.proposalFilter)}));

let remaining=2*3600+17*60+36;setInterval(()=>{remaining=Math.max(0,remaining-1);const h=String(Math.floor(remaining/3600)).padStart(2,'0');const m=String(Math.floor(remaining%3600/60)).padStart(2,'0');const s=String(remaining%60).padStart(2,'0');document.querySelector('[data-countdown]').textContent=`${h}:${m}:${s}`},1000);
applyTranslations();
