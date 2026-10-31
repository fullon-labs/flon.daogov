import {renderEpochChart} from './epoch-chart.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={operational:'Operational',degraded:'Degraded',outage:'Outage',maintenance:'Maintenance',unknown:'Unknown'};
const color=s=>s==='operational'?'green':s==='outage'?'red':s==='degraded'?'amber':'';
const fmt=v=>v==null?'—':typeof v==='number'?v.toLocaleString('en-US',{maximumFractionDigits:2}):v;
const metric=(name,value,sub='')=>`<div class="metric"><div class="label">${esc(name)}</div><div class="value">${esc(fmt(value))}</div><div class="sub">${esc(sub)}</div></div>`;
const detail=(name,value)=>`<div><div class="label">${esc(name)}</div><div class="value">${esc(fmt(value))}</div></div>`;
function renderContact(){
 const link=document.createElement('a');
 link.href='https://t.me/flondao';link.target='_blank';link.rel='noopener noreferrer';
 link.textContent='Contact · Telegram @flondao';
 $('contact').replaceChildren(link);
}
renderContact();
let data,days=30,selectedBp,registry,selectedNetwork;
const rememberedBps=new Map();
function services(){if(!data)return;$('services').innerHTML=data.services.map(s=>{const w=s.windows[days];return `<div class="service"><div><div class="service-name">${esc(s.name)}</div><div class="service-detail">${esc(s.detail)}</div><div class="service-detail">P50 ${esc(fmt(w.p50_ms))} / P95 ${esc(fmt(w.p95_ms))} ms</div></div><div><div class="percent">${w.uptime==null?'—':w.uptime.toFixed(3)+'%'}</div><div class="service-detail">覆盖 ${w.coverage.toFixed(2)}%</div></div><div class="bars">${s.days.map(d=>`<div class="bar ${d.uptime==null?'empty':d.uptime===100?'good':d.uptime===0?'bad':'partial'}" title="${esc(d.date)} · ${d.uptime==null?'无观测':d.uptime.toFixed(3)+'%'} · 覆盖 ${d.coverage.toFixed(2)}%"></div>`).join('')}</div><div class="state ${color(s.status)}">● ${esc(labels[s.status])}</div></div>`}).join('')||'<p class="empty-message">尚未配置服务探针</p>'}
function events(id,rows,empty){$(id).innerHTML=rows.length?rows.map(r=>`<div class="event"><strong>${esc(r.title)}</strong><p>${esc(r.description||r.impact||'')}<br>${esc(r.starts_at||r.started_at)} → ${esc(r.ends_at||r.resolved_at||'进行中')}</p></div>`).join(''):`<p class="empty-message">${empty}</p>`}
function render(d){data=d;$('admission').textContent=d.admission?.mode==='catalog'?'链上自动发现 · 仅展示 BP 账号与链上履职数据 · 未接入节点端点监测':d.admission?.mode==='long_term'?'已核验 BP 节点 · 长期观察':'临时观察 · 未通过 BP 节点归属核验 · 到期 '+(d.admission?.expires_at?new Date(d.admission.expires_at).toLocaleString():'未知')+' · 到期停止探测并删除记录';document.title=(d.title||'FULLON Status');$('overall').textContent=labels[d.stale?'unknown':d.status]||'Unknown';$('overall').className=color(d.stale?'unknown':d.status);$('orb').className='orb '+color(d.status);$('identity').textContent=(d.title||'FULLON NETWORK')+' / '+d.network;$('role').textContent=d.role.toUpperCase()+' BP';$('updated').textContent=`最近探测 ${new Date(d.updated_at).toLocaleString()} · 每 ${d.interval_seconds} 秒更新`;$('network').textContent=d.network+' · '+(d.chain_verified?'Chain verified':'Chain unverified');$('notice').hidden=d.status!=='unknown'&&!d.stale;$('notice').textContent=d.rpc_scope==='reference'&&!d.stale?'当前使用公共 RPC 观察此账号；链同步数值属于观察 RPC，不证明 BP 节点自身已同步或可签名。':d.stale?'监测数据已过期，当前状态未知。':'部分状态尚未验证。请配置网络 Chain ID、节点、BP 账号和服务探针；未知指标不计为正常。';$('chain').innerHTML=metric('HEAD BLOCK',d.head_block,d.rpc_scope==='reference'?'公共观察 RPC 链头':'当前节点链头')+metric('LAST IRREVERSIBLE',d.lib_block,'Head / LIB gap: '+fmt(d.head_lib_gap))+metric('SYNC LAG',d.sync_lag_blocks==null?null:fmt(d.sync_lag_blocks)+' blocks','相对同链参考节点 · '+fmt(d.sync_lag_seconds)+' s')+metric('NODE VERSION',d.node_version,'链头年龄 '+fmt(d.head_age_seconds)+' s');$('producer').textContent=d.producer||'尚未配置';$('qualification').textContent=d.qualification||'unassessed';$('duties').innerHTML=d.role==='active'?detail('Schedule version',d.schedule_version)+detail('连续漏块 / 最长连续',fmt(d.consecutive_missed)+' / '+fmt(d.longest_missed_streak))+detail('最近成功出块',d.last_produced_at)+detail('Warnings',d.warning_count)+detail('Finalizer',d.finalizer_status)+detail('统计一致性',d.consistent==null?'Unknown':d.consistent?'Verified':'Mismatch'):detail('候选状态',d.candidate_status)+detail('候选排名',d.rank)+detail('总票数',d.votes)+detail('距前 21 名票差',d.votes_to_21)+detail('当前自质押',d.self_stake)+detail('签名 / 接替准备',d.readiness);$('duties').innerHTML+=detail('地区 / 基础设施',d.location)+detail('P2P peers',d.p2p_peers)+detail('GAS eligible / score',`${fmt(d.gas?.eligible)} / ${fmt(d.gas?.score)}`)+detail('GAS allocated · 非到账',d.gas?.allocated);$('epoch').textContent='Epoch '+fmt(d.current_epoch);$('production').innerHTML=`${d.production_rate==null?'—':d.production_rate.toFixed(2)+'%'}<small>${esc(fmt(d.produced_blocks))} / ${esc(fmt(d.expected_blocks))} produced</small><div class="sub">Missed ${esc(fmt(d.missed_blocks))} · Idle skipped ${esc(fmt(d.idle_skipped_blocks))}</div>`;$('trend').innerHTML=renderEpochChart(d.epoch_history||[],{queryFailed:d.epoch_history_error});$('uptime').innerHTML=[1,7,30,90].map(n=>{const w=d.uptime[n];return `<div><strong>${w.uptime==null?'—':w.uptime.toFixed(3)+'%'}</strong><div class="label">Last ${n===1?'24 hours':n+' days'}</div><small>观测覆盖 ${w.coverage.toFixed(3)}% · ${w.samples} samples</small></div>`}).join('');events('incidents',d.incidents,'尚未录入事故记录。此处不代表历史上未发生故障。');events('maintenance',d.maintenance,'暂无已录入的维护计划。');renderContact();services()}
let busy=false,requestVersion=0;
function statusUrl(){return '/api/status.json?bp='+encodeURIComponent(selectedBp)}
function selectBp(id,{push=true}={}){
 selectedBp=id;rememberedBps.set(selectedNetwork,id);requestVersion++;busy=false;
 $('bp-select').value=id;
 const url=new URL(window.location.href);url.searchParams.set('bp',id);url.searchParams.set('network',selectedNetwork);
 if(push)window.history.pushState({},'',url);
 $('bp-link').href=url.pathname+url.search;
 document.querySelectorAll('[data-status-api]').forEach(a=>a.href=statusUrl());
 // Clear the previous BP's numbers before loading a different identity.
 data=null;
 $('overall').textContent='正在读取状态';$('overall').className='';$('identity').textContent=id;
 $('updated').textContent='等待所选 BP 的最新快照';$('role').textContent='Unknown';
 for(const name of ['chain','duties','production','trend','services','uptime','incidents','maintenance'])$(name).replaceChildren();
 $('producer').textContent='—';$('qualification').textContent='Unknown';$('network').textContent='—';$('epoch').textContent='—';renderContact();$('notice').hidden=true;$('admission').textContent='正在读取接入资格';
 load();
}
async function load(){
 if(busy||!selectedBp)return;busy=true;const version=requestVersion;$('refresh').disabled=true;
 try{const r=await fetch(statusUrl(),{signal:AbortSignal.timeout(10000)});if(r.status===410||r.status===404){if(version===requestVersion){for(const name of ['chain','duties','production','trend','services','uptime','incidents','maintenance'])$(name).replaceChildren();$('admission').textContent='观察已到期或记录已移除';}throw Error()}if(!r.ok)throw Error();const d=await r.json();if(version!==requestVersion)return;render(d)}
 catch{if(version!==requestVersion)return;$('overall').textContent='Unknown';$('overall').className='';$('notice').hidden=false;$('notice').textContent='无法读取所选 BP 的最新数据。下方如有数值，均为此 BP 上次快照。'}
 finally{if(version===requestVersion){busy=false;$('refresh').disabled=false}}
}
$('refresh').onclick=load;
$('windows').onclick=e=>{if(!e.target.dataset.days)return;days=Number(e.target.dataset.days);document.querySelectorAll('[data-days]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.days)===days));services()};
$('bp-select').onchange=e=>selectBp(e.target.value);
function clearDetails(){
 selectedBp=null;data=null;requestVersion++;busy=false;$('refresh').disabled=false;
 for(const name of ['chain','duties','production','trend','services','uptime','incidents','maintenance'])$(name).replaceChildren();
 $('overall').className='';$('orb').className='orb';$('identity').textContent='FULLON / '+selectedNetwork;
 $('producer').textContent='—';$('network').textContent=selectedNetwork;$('updated').textContent='';$('role').textContent='Unknown';$('qualification').textContent='Unknown';$('epoch').textContent='—';renderContact();$('notice').hidden=true;
 document.querySelectorAll('[data-status-api]').forEach(a=>a.href='/api/bps.json');
}
function invalidSelection(){clearDetails();$('overall').textContent='Unknown BP';$('notice').hidden=false;$('notice').textContent='链接中的 BP 不在当前网络列表，请重新选择。';$('bp-select').value='';$('admission').textContent='未选择有效 BP';}
function setNetworkUrl(){const url=new URL(window.location.href);url.searchParams.set('network',selectedNetwork);url.searchParams.delete('bp');window.history.pushState({},'',url);$('bp-link').href=url.pathname+url.search;}
function renderDirectory({fromUrl=false}={}){
 if(!registry)return;
 const roles={active:'Active',standby:'Standby',unknown:'待确认'};
 const visible=registry.bps.filter(b=>b.network===selectedNetwork);
 $('finalizer-link').href='/finalizers?network='+selectedNetwork;
 document.querySelectorAll('[data-network]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.network===selectedNetwork)));
 const groups=['active','standby','unknown'].map(role=>({role,bps:visible.filter(b=>b.role===role)})).filter(g=>g.bps.length);
 $('bp-select').innerHTML=groups.map(g=>`<optgroup label="${roles[g.role]} (${g.bps.length})">${g.bps.map(b=>`<option value="${esc(b.id)}">${esc(b.label)} · ${roles[g.role]}${b.stale?' · 数据过期':''}</option>`).join('')}</optgroup>`).join('');
 const active=visible.filter(b=>b.role==='active').length,standby=visible.filter(b=>b.role==='standby').length;
 $('bp-count').textContent=`${visible.length} BPs · ${active} Active / ${standby} Standby`;
 $('bp-select').disabled=!visible.length;
 if(!visible.length){
  clearDetails();$('overall').textContent=selectedNetwork==='mainnet'?'Mainnet · 暂无 BP 数据':'Testnet · 暂无 BP 数据';
  const source=registry.discovery?.find(n=>n.network===selectedNetwork);
  $('admission').textContent=source?'当前网络暂无可用 BP 列表，等待链上发现刷新。':'当前网络尚未配置发现来源，请在服务端配置对应网络的 RPC 和 Chain ID。';
  const url=new URL(window.location.href);url.searchParams.set('network',selectedNetwork);url.searchParams.delete('bp');$('bp-link').href=url.pathname+url.search;return;
 }
 const requested=fromUrl?new URL(window.location.href).searchParams.get('bp'):null;
 const remembered=rememberedBps.get(selectedNetwork);
 const id=requested|| (visible.some(b=>b.id===selectedBp)?selectedBp:visible.some(b=>b.id===remembered)?remembered:visible.some(b=>b.id===registry.default_bp)?registry.default_bp:visible[0].id);
 if(!visible.some(b=>b.id===id)){invalidSelection();return}
 if(id===selectedBp&&!fromUrl){$('bp-select').value=id;return}
 selectBp(id,{push:!fromUrl});
}
function networkFromUrl(){
 const url=new URL(window.location.href),network=url.searchParams.get('network');
 if(['mainnet','testnet'].includes(network))return network;
 return registry?.bps.find(b=>b.id===url.searchParams.get('bp'))?.network||registry?.bps.find(b=>b.id===registry.default_bp)?.network||'mainnet';
}
$('network-switch').onclick=e=>{
 const network=e.target.dataset.network;if(!network||network===selectedNetwork)return;
 selectedNetwork=network;clearDetails();setNetworkUrl();renderDirectory();
};
window.addEventListener('popstate',()=>{selectedNetwork=networkFromUrl();clearDetails();renderDirectory({fromUrl:true})});
async function refreshDirectory(initial=false){
 try{
  const r=await fetch('/api/bps.json',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();registry=await r.json();
  if(initial||!selectedNetwork)selectedNetwork=networkFromUrl();
  renderDirectory({fromUrl:initial});
 }catch{if(initial){$('overall').textContent='Unknown';$('notice').hidden=false;$('notice').textContent='无法读取 BP 列表，请刷新后重试。'}else{$('bp-count').textContent='列表刷新失败 · 保留上次结果'}}
}
await refreshDirectory(true);
setInterval(load,15000);
setInterval(()=>refreshDirectory(),30000);
