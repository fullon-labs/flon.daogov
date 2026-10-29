export function producerStatusUrl(network,account){
  if(!['mainnet','testnet'].includes(network)||!/^[a-z1-5.]{1,12}$/.test(account||''))return null;
  const url=new URL('https://status.flon.network/');
  url.searchParams.set('network',network);
  url.searchParams.set('bp',`${network}-${account}`);
  return url.href;
}
function normalizeStats(row){
  if(!row||['expected_blocks','produced_blocks','missed_blocks'].some(k=>!/^\d+$/.test(String(row[k]??''))))return null;
  const expected=BigInt(row.expected_blocks),produced=BigInt(row.produced_blocks),missed=BigInt(row.missed_blocks);
  const consistent=expected===produced+missed;
  return {expected:expected.toString(),produced:produced.toString(),missed:missed.toString(),
    idleSkipped:/^\d+$/.test(String(row.idle_skipped_blocks??''))?String(row.idle_skipped_blocks):null,
    consistent,rate:expected>0n&&consistent?Number(produced*1000000n/expected)/10000:null};
}
export async function loadProducerEpochs(request,account){
  if(!/^[a-z1-5.]{1,12}$/.test(account||''))throw Error('INVALID_BP_ACCOUNT');
  const response=await request('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'epochstats',reverse:true,limit:30});
  if(!Array.isArray(response.rows))throw Error('INVALID_EPOCH_STATS');
  const epochs=response.rows.slice(0,30).sort((a,b)=>Number(b.epoch_id)-Number(a.epoch_id));
  const history=await Promise.all(epochs.map(async epoch=>{
    try{
      const data=await request('/v1/chain/get_table_rows',{json:true,code:'flon',scope:String(epoch.epoch_id),table:'bpstats',lower_bound:account,upper_bound:account,limit:1});
      const row=data.rows?.find(r=>r.producer===account&&(r.epoch_id==null||String(r.epoch_id)===String(epoch.epoch_id)));
      return {epochId:epoch.epoch_id,closed:Boolean(Number(epoch.closed)),stats:normalizeStats(row)};
    }catch{return {epochId:epoch.epoch_id,closed:Boolean(Number(epoch.closed)),stats:null}}
  }));
  return {current:history[0]??null,history};
}
const escape=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderProducerPerformance(performance,{url,translate=x=>x}={}){
  const t=text=>escape(translate(text)),current=performance?.current,stats=current?.stats;
  const bars=[...Array(Math.max(0,30-(performance?.history.length||0))).fill(null),...(performance?.history||[]).slice().reverse()];
  return `<header><strong>${t('Epoch 表现')}</strong><span>Epoch ${escape(current?.epochId)}</span></header>
    <div class="bp-epoch-rate"><b class="din">${stats?.rate==null?'—':stats.rate.toFixed(2)+'%'}</b><span>${escape(stats?.produced)} / ${escape(stats?.expected)} ${t('实出 / 应出')}</span></div>
    <p class="bp-epoch-counts">Missed ${escape(stats?.missed)} · Idle skipped ${escape(stats?.idleSkipped)}${stats?.consistent===false?` · ${t('统计不一致')}`:''}</p>
    <div class="bp-epoch-trend" role="img" aria-label="${t('最近 30 个 Epoch 出块率')}">${bars.map(e=>{const rate=e?.stats?.rate;return `<i class="${rate==null?'is-unknown':rate<100?'is-warning':''}" style="--epoch-rate:${rate==null?0:Math.max(0,Math.min(100,rate))}%" title="${e?'Epoch '+escape(e.epochId)+' · '+(rate==null?t('未知 / 无应出块'):rate.toFixed(2)+'%')+' · '+t(e.closed?'已封存':'未封存'):t('无观测数据')}"></i>`}).join('')}</div>
    <div class="bp-epoch-legend"><span>● ${t('已观测出块率')}</span><span>▧ ${t('未知 / 无应出块')}</span></div>
    <footer><small>${t('Idle skipped 不计入出块率')}</small>${url?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${t('完整节点状态')} ↗</a>`:''}</footer>`;
}
