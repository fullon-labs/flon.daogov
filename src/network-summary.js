const precision=8;
const scale=10n**BigInt(precision);

function unitsFromAsset(value){
  const match=String(value??'').trim().match(/^(\d+)(?:\.(\d{0,8}))?/);
  if(!match)return 0n;
  return BigInt(match[1])*scale+BigInt((match[2]||'').padEnd(precision,'0'));
}

function formatUnits(value,symbol){
  const units=BigInt(value||0),whole=units/scale,fraction=(units%scale).toString().padStart(precision,'0');
  return `${whole}.${fraction} ${symbol}`;
}

export function summarizeNetworkEconomics(producers=[],stakes=[],glonStats={}){
  const totalVoteUnits=producers.reduce((total,row)=>total+BigInt(row?.total_votes||0),0n);
  const totalStakeUnits=stakes.reduce((total,row)=>total+unitsFromAsset(row?.staked),0n);
  const supply=glonStats?.GLON?.supply;
  return {
    totalBpStake:formatUnits(totalStakeUnits,'FLON'),
    totalNetworkStake:typeof supply==='string'?formatUnits(totalStakeUnits+unitsFromAsset(supply),'FLON'):'— FLON',
    totalVotes:formatUnits(totalVoteUnits,'FLON'),
    governancePower:typeof supply==='string'?supply:'— GLON',
  };
}

export function formatOverviewAsset(value){
  const match=String(value||'').match(/^(\d+)(?:\.(\d+))?\s+([A-Z]+)$/);
  if(!match)return String(value||'—');
  const whole=match[1].replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const fraction=(match[2]||'').replace(/0+$/,'');
  return `${whole}${fraction?`.${fraction}`:''} ${match[3]}`;
}
