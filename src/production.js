function blockCount(value){
  const normalized=String(value??0);
  return /^\d+$/.test(normalized)?BigInt(normalized):0n;
}

export function latestCompleteEpoch(rows=[]){
  return rows
    .filter(row=>Boolean(Number(row?.closed))&&Boolean(Number(row?.complete_sample)))
    .reduce((latest,row)=>Number(row.epoch_id)>Number(latest?.epoch_id??-1)?row:latest,null);
}

export function rewardEpochsEnabled(globalRow){
  const value=String(globalRow?.reward_started_time||'');
  const timestamp=Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value)?value:`${value}Z`);
  return Number.isFinite(timestamp)&&timestamp>=Date.UTC(2000,0,1);
}

export function summarizeBPProduction(rows=[]){
  const totals=rows.reduce((result,row)=>({
    expected:result.expected+blockCount(row?.expected_blocks),
    produced:result.produced+blockCount(row?.produced_blocks),
    missed:result.missed+blockCount(row?.missed_blocks),
    idleSkipped:result.idleSkipped+blockCount(row?.idle_skipped_blocks),
  }),{expected:0n,produced:0n,missed:0n,idleSkipped:0n});
  if(totals.expected===0n)return {...totals,rate:null};
  // Keep two extra decimal places while doing integer arithmetic so large
  // on-chain counters do not lose precision before the final conversion.
  const basisPoints=totals.produced*1000000n/totals.expected;
  return {...totals,rate:Number(basisPoints)/10000};
}
