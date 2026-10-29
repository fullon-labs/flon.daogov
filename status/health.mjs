export function production(row) {
  if (!row) return null;
  const keys=['expected_blocks','produced_blocks','missed_blocks'];
  if(keys.some(k=>!Number.isSafeInteger(Number(row[k]))||Number(row[k])<0)) return null;
  const [expected,produced,missed]=keys.map(k=>Number(row[k]));
  return {...Object.fromEntries(keys.map(k=>[k,Number(row[k])])),idle_skipped_blocks:row.idle_skipped_blocks??null,
    production_rate:expected>0&&expected===produced+missed?produced/expected*100:null,
    consistent:expected===produced+missed,consecutive_missed:row.trailing_missed_streak??null,
    longest_missed_streak:row.longest_missed_streak??null,warning_count:row.warning_count??null,
    qualification:['unassessed','qualified','degraded','warning','suspended','insufficient_sample','network_incident','probation'][row.status]??'unknown'};
}
export function aggregate(states){
  if(states.includes('outage'))return 'outage';
  if(states.includes('degraded'))return 'degraded';
  if(states.includes('unknown')||!states.length)return 'unknown';
  if(states.includes('maintenance'))return 'maintenance';
  return 'operational';
}
export function summary(samples,now,days,interval){
  const rows=samples.filter(r=>r.at>now-days*86400000&&r.at<=now);
  const known=rows.filter(r=>['operational','degraded','outage'].includes(r.status));
  const times=known.map(r=>r.latency_ms).filter(Number.isFinite).sort((a,b)=>a-b);
  return {uptime:known.length?known.filter(r=>r.status==='operational').length/known.length*100:null,
    coverage:Math.min(100,known.length*interval/(days*86400)*100),samples:known.length,
    p50_ms:times.length?times[Math.ceil(times.length*.5)-1]:null,p95_ms:times.length?times[Math.ceil(times.length*.95)-1]:null};
}
