export function voteAllocationChanges(beforeItems,afterItems){
  const before=new Map((beforeItems||[]).map(item=>[item.producer,BigInt(item.votes||0)]));
  const after=new Map((afterItems||[]).map(item=>[item.producer,BigInt(item.votes||0)]));
  return [...new Set([...before.keys(),...after.keys()])]
    .sort()
    .map(producer=>{
      const previous=before.get(producer)||0n;
      const next=after.get(producer)||0n;
      return{producer,previous,next,type:previous===0n?'added':next===0n?'removed':'changed'};
    })
    .filter(item=>item.previous!==item.next);
}

export function formatVoteInput(units){
  const value=BigInt(units||0);
  const whole=value/100000000n;
  const fraction=(value%100000000n).toString().padStart(8,'0').replace(/0+$/,'');
  return fraction?`${whole}.${fraction}`:String(whole);
}
