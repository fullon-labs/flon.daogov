const $=id=>document.getElementById(id),esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={operational:'Operational',degraded:'Degraded',outage:'Outage',maintenance:'Maintenance',unknown:'Unknown'};
const color=s=>s==='operational'?'green':s==='outage'?'red':s==='degraded'?'amber':'';
const fmt=v=>v==null?'—':typeof v==='number'?v.toLocaleString('en-US',{maximumFractionDigits:2}):v;
const metric=(name,value,sub='')=>`<div class="metric"><div class="label">${esc(name)}</div><div class="value">${esc(fmt(value))}</div><div class="sub">${esc(sub)}</div></div>`;
const detail=(name,value)=>`<div><div class="label">${esc(name)}</div><div class="value">${esc(fmt(value))}</div></div>`;
let data,days=30,selectedBp,registry;
function services(){if(!data)return;$('services').innerHTML=data.services.map(s=>{const w=s.windows[days];return `<div class="service"><div><div class="service-name">${esc(s.name)}</div><div class="service-detail">${esc(s.detail)}</div><div class="service-detail">P50 ${esc(fmt(w.p50_ms))} / P95 ${esc(fmt(w.p95_ms))} ms</div></div><div><div class="percent">${w.uptime==null?'—':w.uptime.toFixed(3)+'%'}</div><div class="service-detail">覆盖 ${w.coverage.toFixed(2)}%</div></div><div class="bars">${s.days.map(d=>`<div class="bar ${d.uptime==null?'empty':d.uptime===100?'good':d.uptime===0?'bad':'partial'}" title="${esc(d.date)} · ${d.uptime==null?'无观测':d.uptime.toFixed(3)+'%'} · 覆盖 ${d.coverage.toFixed(2)}%"></div>`).join('')}</div><div class="state ${color(s.status)}">● ${esc(labels[s.status])}</div></div>`}).join('')||'<p class="empty-message">尚未配置服务探针</p>'}
function events(id,rows,empty){$(id).innerHTML=rows.length?rows.map(r=>`<div class="event"><strong>${esc(r.title)}</strong><p>${esc(r.description||r.impact||'')}<br>${esc(r.starts_at||r.started_at)} → ${esc(r.ends_at||r.resolved_at||'进行中')}</p></div>`).join(''):`<p class="empty-message">${empty}</p>`}
function render(d){data=d;$('admission').textContent=d.admission?.mode==='long_term'?'已核验 BP 节点 · 长期观察':'临时观察 · 未通过 BP 节点归属核验 · 到期 '+(d.admission?.expires_at?new Date(d.admission.expires_at).toLocaleString():'未知')+' · 到期停止探测并删除记录';document.title=(d.title||'FULLON Status');$('overall').textContent=labels[d.stale?'unknown':d.status]||'Unknown';$('overall').className=color(d.stale?'unknown':d.status);$('orb').className='orb '+color(d.status);$('identity').textContent=(d.title||'FULLON NETWORK')+' / '+d.network;$('role').textContent=d.role.toUpperCase()+' BP';$('updated').textContent=`最近探测 ${new Date(d.updated_at).toLocaleString()} · 每 ${d.interval_seconds} 秒更新`;$('network').textContent=d.network+' · '+(d.chain_verified?'Chain verified':'Chain unverified');$('notice').hidden=d.status!=='unknown'&&!d.stale;$('notice').textContent=d.rpc_scope==='reference'&&!d.stale?'当前使用公共 RPC 观察此账号；链同步数值属于观察 RPC，不证明 BP 节点自身已同步或可签名。':d.stale?'监测数据已过期，当前状态未知。':'部分状态尚未验证。请配置网络 Chain ID、节点、BP 账号和服务探针；未知指标不计为正常。';$('chain').innerHTML=metric('HEAD BLOCK',d.head_block,d.rpc_scope==='reference'?'公共观察 RPC 链头':'当前节点链头')+metric('LAST IRREVERSIBLE',d.lib_block,'Head / LIB gap: '+fmt(d.head_lib_gap))+metric('SYNC LAG',d.sync_lag_blocks==null?null:fmt(d.sync_lag_blocks)+' blocks','相对同链参考节点 · '+fmt(d.sync_lag_seconds)+' s')+metric('NODE VERSION',d.node_version,'链头年龄 '+fmt(d.head_age_seconds)+' s');$('producer').textContent=d.producer||'尚未配置';$('qualification').textContent=d.qualification||'unassessed';$('duties').innerHTML=d.role==='active'?detail('Schedule version',d.schedule_version)+detail('连续漏块 / 最长连续',fmt(d.consecutive_missed)+' / '+fmt(d.longest_missed_streak))+detail('最近成功出块',d.last_produced_at)+detail('Warnings',d.warning_count)+detail('Finalizer',d.finalizer_status)+detail('统计一致性',d.consistent==null?'Unknown':d.consistent?'Verified':'Mismatch'):detail('候选状态',d.candidate_status)+detail('候选排名',d.rank)+detail('总票数',d.votes)+detail('距前 21 名票差',d.votes_to_21)+detail('当前自质押',d.self_stake)+detail('签名 / 接替准备',d.readiness);$('duties').innerHTML+=detail('地区 / 基础设施',d.location)+detail('P2P peers',d.p2p_peers)+detail('GAS eligible / score',`${fmt(d.gas?.eligible)} / ${fmt(d.gas?.score)}`)+detail('GAS allocated · 非到账',d.gas?.allocated);$('epoch').textContent='Epoch '+fmt(d.current_epoch);$('production').innerHTML=`${d.production_rate==null?'—':d.production_rate.toFixed(2)+'%'}<small>${esc(fmt(d.produced_blocks))} / ${esc(fmt(d.expected_blocks))} produced</small><div class="sub">Missed ${esc(fmt(d.missed_blocks))} · Idle skipped ${esc(fmt(d.idle_skipped_blocks))}</div>`;$('trend').innerHTML=[...(d.epoch_history||[])].reverse().map(e=>`<i class="${e.stats?.production_rate==null?'unknown':''}" style="height:${e.stats?.production_rate??0}%" title="Epoch ${esc(e.epoch_id)} · ${esc(e.stats?.production_rate??'无应出块 / 未知')}% · ${e.closed?'已封存':'未封存'}"></i>`).join('')||'<div class="empty-message">尚无 Epoch 数据</div>';$('uptime').innerHTML=[1,7,30,90].map(n=>{const w=d.uptime[n];return `<div><strong>${w.uptime==null?'—':w.uptime.toFixed(3)+'%'}</strong><div class="label">Last ${n===1?'24 hours':n+' days'}</div><small>观测覆盖 ${w.coverage.toFixed(3)}% · ${w.samples} samples</small></div>`}).join('');events('incidents',d.incidents,'尚未录入事故记录。此处不代表历史上未发生故障。');events('maintenance',d.maintenance,'暂无已录入的维护计划。');$('contact').textContent=d.contact||'Contact · 尚未配置';services()}
let busy=false,requestVersion=0;
function statusUrl(){return '/api/status.json?bp='+encodeURIComponent(selectedBp)}
function selectBp(id,{push=true}={}){
 selectedBp=id;requestVersion++;busy=false;
 $('bp-select').value=id;
 const url=new URL(window.location.href);url.searchParams.set('bp',id);
 if(push)window.history.pushState({},'',url);
 $('bp-link').href=url.pathname+url.search;
 document.querySelectorAll('[data-status-api]').forEach(a=>a.href=statusUrl());
 // Clear the previous BP's numbers before loading a different identity.
 data=null;
 $('overall').textContent='正在读取状态';$('overall').className='';$('identity').textContent=id;
 $('updated').textContent='等待所选 BP 的最新快照';$('role').textContent='Unknown';
 for(const name of ['chain','duties','production','trend','services','uptime','incidents','maintenance'])$(name).replaceChildren();
 $('producer').textContent='—';$('qualification').textContent='Unknown';$('network').textContent='—';$('epoch').textContent='—';$('contact').textContent='';$('notice').hidden=true;$('admission').textContent='正在读取接入资格';
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
window.addEventListener('popstate',()=>{const id=new URL(window.location.href).searchParams.get('bp')||registry.default_bp;if(registry.bps.some(b=>b.id===id))selectBp(id,{push:false});else invalidSelection()});
function invalidSelection(){for(const name of ['chain','duties','production','trend','services','uptime','incidents','maintenance'])$(name).replaceChildren();$('producer').textContent='—';$('network').textContent='—';$('updated').textContent='未选择有效 BP';$('overall').textContent='Unknown BP';$('notice').hidden=false;$('notice').textContent='链接中的 BP 未配置，请从列表选择。';$('bp-select').value='';selectedBp=null;requestVersion++;busy=false;data=null;}
try{
 const r=await fetch('/api/bps.json',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();registry=await r.json();
 $('bp-select').innerHTML=registry.bps.map(b=>`<option value="${esc(b.id)}">${esc(b.label)} · ${esc(b.network)}${b.producer?' · '+esc(b.producer):''}</option>`).join('');
 $('bp-count').textContent=registry.bps.length+' BPs';
 if(!registry.bps.length){$('overall').textContent='暂无观察目标';$('admission').textContent='临时观察已到期的目标已清理，可在本机管理端添加节点。';$('bp-select').disabled=true;}
 const id=new URL(window.location.href).searchParams.get('bp')||registry.default_bp;
 if(!registry.bps.length){}else if(registry.bps.some(b=>b.id===id))selectBp(id,{push:false});else invalidSelection();
}catch{$('overall').textContent='Unknown';$('notice').hidden=false;$('notice').textContent='无法读取 BP 列表，请刷新后重试。'}
setInterval(load,15000);
