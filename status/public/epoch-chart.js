const escape=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stateLabels={observed:'已观测出块率',no_record:'无统计记录',no_expected:'无应出块',query_failed:'查询失败',invalid:'数据无效',inconsistent:'统计不一致'};
export function epochChartPoint(entry){
  const stats=entry.stats,rate=stats?.rate??stats?.production_rate??null;
  const expected=stats?.expected??stats?.expected_blocks??null;
  const state=entry.data_status||(stats?(stats.consistent===false?'inconsistent':Number(expected)===0?'no_expected':rate==null?'invalid':'observed'):'no_record');
  return {epoch:entry.epochId??entry.epoch_id,state,rate:state==='observed'&&Number.isFinite(rate)?Math.max(0,Math.min(100,rate)):null,
    produced:stats?.produced??stats?.produced_blocks??null,expected,
    missed:stats?.missed??stats?.missed_blocks??null,idle:stats?.idleSkipped??stats?.idle_skipped_blocks??null,closed:Boolean(Number(entry.closed))};
}
export function renderEpochChart(history=[],{translate=x=>x,queryFailed=false}={}){
  const text=x=>escape(translate(x));
  const points=history.map(epochChartPoint).sort((a,b)=>Number(a.epoch)-Number(b.epoch));
  if(!points.length)return `<p class="epoch-chart-empty">${text(queryFailed?'查询失败':'暂无 Epoch 记录')}</p>`;
  const legend=['observed','no_record','no_expected','query_failed',...['invalid','inconsistent'].filter(s=>points.some(p=>p.state===s))];
  return `<div class="epoch-chart" aria-label="${text('Epoch 出块率趋势')}">${points.map(p=>{
    const description=`Epoch ${p.epoch} · ${translate(stateLabels[p.state]||'数据无效')}${p.rate===null?'':` ${p.rate.toFixed(2)}%`} · ${p.produced??'—'} / ${p.expected??'—'} ${translate('实出 / 应出')} · Missed ${p.missed??'—'} · Idle skipped ${p.idle??'—'} · ${translate(p.closed?'已封存':'未封存')}`;
    return `<span class="epoch-chart-slot"><i tabindex="0" role="img" class="epoch-chart-bar state-${escape(p.state)}${p.rate!==null&&p.rate<100?' has-misses':''}" style="--epoch-rate:${p.rate??0}%" title="${escape(description)}" aria-label="${escape(description)}"></i><span class="epoch-chart-tooltip" aria-hidden="true">${escape(description)}</span></span>`;
  }).join('')}</div><div class="epoch-chart-axis"><span>Epoch ${escape(points[0].epoch)}</span><span>${points.length} ${text('期记录')}</span><span>Epoch ${escape(points.at(-1).epoch)}</span></div><div class="epoch-chart-legend">${legend.map(s=>`<span><i class="state-${s}"></i>${text(stateLabels[s])}</span>`).join('')}</div><p class="epoch-chart-note">${text('柱高表示出块率，实出数量见提示；无统计记录不代表漏块。')}</p>`;
}
