export const DAO_STATUS_META={
  0:['附议中','endorsement'],1:['投票等待期','voting'],2:['投票中','voting'],
  3:['未通过','closed'],4:['已通过','execution'],5:['已取消','closed'],
  6:['Timelock','execution'],7:['已执行','closed'],8:['已过期','closed']
};

const timestamp=value=>{
  const text=String(value||'');
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(text)?text:`${text}Z`);
};

export function effectiveProposalPhase(proposal,now=Date.now()){
  const status=Number(proposal.status);
  if(status===0&&now>=timestamp(proposal.endorsement_end))return'activation';
  if((status===1||status===2)&&now>=timestamp(proposal.vote_end))return'finalization';
  if(status===1&&now>=timestamp(proposal.vote_start))return'voting';
  if(status===4&&Array.isArray(proposal.actions)&&proposal.actions.length)return'queue';
  if(status===6&&now>=timestamp(proposal.execute_before))return'expiry';
  if(status===6&&now>=timestamp(proposal.execute_after))return'execution';
  return DAO_STATUS_META[status]?.[1]||'closed';
}

export function governanceAction(proposal,{endorsed=false,voted=false,now=Date.now()}={}){
  const phase=effectiveProposalPhase(proposal,now),id=Number(proposal.proposal_id);
  if(phase==='activation')return{action:'dao-advance',label:'进入投票',name:'activate',id};
  if(phase==='finalization')return{action:'dao-advance',label:'结算投票',name:'finalize',id};
  if(phase==='queue')return{action:'dao-advance',label:'进入 Timelock',name:'queue',id};
  if(phase==='execution')return{action:'dao-advance',label:'执行',name:'execute',id};
  if(phase==='expiry')return{action:'dao-advance',label:'标记过期',name:'expire',id};
  if(phase==='endorsement'&&!endorsed)return{action:'dao-endorse',label:'附议',id};
  if(phase==='voting'&&!voted)return{action:'dao-vote',label:'投票',id};
  return null;
}

export function proposalCounts(proposals,now=Date.now()){
  const counts={endorsement:0,voting:0,execution:0};
  for(const proposal of proposals||[]){
    const phase=effectiveProposalPhase(proposal,now);
    if(phase==='endorsement'||phase==='activation')counts.endorsement++;
    else if(phase==='voting'||phase==='finalization')counts.voting++;
    else if(['queue','execution','expiry'].includes(phase))counts.execution++;
  }
  return counts;
}
