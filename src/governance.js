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
  const executable=Array.isArray(proposal.actions)&&proposal.actions.length>0;
  if(status===4)return executable?'queue':'closed';
  if(status===6&&!executable)return'closed';
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

export function enabledAllowlist(rows=[]){
  return rows.filter(row=>row.enabled===true||Number(row.enabled)===1)
    .map(row=>({contract:String(row.contract),action:String(row.action_name),maxBytes:Number(row.max_data_bytes)}))
    .filter(row=>/^[a-z1-5.]{1,12}$/.test(row.contract)&&/^[a-z1-5.]{1,12}$/.test(row.action)&&Number.isInteger(row.maxBytes)&&row.maxBytes>0)
    .sort((left,right)=>`${left.contract}::${left.action}`.localeCompare(`${right.contract}::${right.action}`));
}

const splitAbiType=type=>{
  let value=String(type||''),array=false,optional=false,extension=false;
  if(value.endsWith('[]')){array=true;value=value.slice(0,-2)}
  if(value.endsWith('?')){optional=true;value=value.slice(0,-1)}
  if(value.endsWith('$')){extension=true;value=value.slice(0,-1)}
  return {value,array,optional,extension};
};

export function actionAbiFields(abi,actionName){
  const actions=Array.isArray(abi?.actions)?abi.actions:[],structs=Array.isArray(abi?.structs)?abi.structs:[],aliases=new Map((abi?.types||[]).map(item=>[item.new_type_name,item.type]));
  const action=actions.find(item=>item.name===actionName);if(!action)throw new Error('ACTION_ABI_NOT_FOUND');
  const resolve=type=>{let current=String(type||''),guard=0;while(aliases.has(current)&&guard++<32)current=aliases.get(current);return current};
  const structMap=new Map(structs.map(item=>[item.name,item]));
  const fields=[];const collect=type=>{const struct=structMap.get(resolve(type));if(!struct)throw new Error('ACTION_STRUCT_NOT_FOUND');if(struct.base)collect(struct.base);fields.push(...(struct.fields||[]))};
  collect(action.type);
  return fields.map(field=>{
    const modifier=splitAbiType(field.type),resolved=resolve(modifier.value);
    return {name:String(field.name),type:String(field.type),baseType:resolved,array:modifier.array,optional:modifier.optional||modifier.extension,structured:structMap.has(resolved)};
  });
}

export function abiFieldValue(field,raw,checked=false){
  if(field.optional&&field.baseType!=='bool'&&!String(raw??'').trim())return null;
  if(field.array||field.structured){try{const value=JSON.parse(String(raw||''));if(field.array&&!Array.isArray(value))throw new Error();if(field.structured&&(value===null||Array.isArray(value)||typeof value!=='object'))throw new Error();return value}catch{throw new Error(`INVALID_ABI_FIELD:${field.name}`)}}
  if(field.baseType==='bool')return Boolean(checked);
  const value=String(raw??'').trim();if(!value&&field.optional)return null;
  if(!value)throw new Error(`REQUIRED_ABI_FIELD:${field.name}`);
  if(/^uint(?:8|16|32|64|128)$/.test(field.baseType)&&!/^\d+$/.test(value))throw new Error(`INVALID_ABI_FIELD:${field.name}`);
  if(/^int(?:8|16|32|64|128)$/.test(field.baseType)&&!/^-?\d+$/.test(value))throw new Error(`INVALID_ABI_FIELD:${field.name}`);
  return value;
}

export function validateFrozenActions(actions,rules,config){
  const maxActions=Number(config?.max_actions||0),maxActionBytes=Number(config?.max_action_bytes||0),maxTotalBytes=Number(config?.max_total_action_bytes||0);
  if(!actions.length)throw new Error('NO_PROPOSAL_ACTIONS');
  if(actions.length>maxActions)throw new Error('TOO_MANY_PROPOSAL_ACTIONS');
  const permitted=new Map(rules.map(rule=>[`${rule.contract}::${rule.action}`,rule]));
  let total=0;
  for(const action of actions){
    const rule=permitted.get(`${action.contract}::${action.action_name}`);if(!rule)throw new Error('ACTION_NOT_ALLOWLISTED');
    const bytes=String(action.data||'').length/2;
    if(!Number.isInteger(bytes)||bytes>maxActionBytes||bytes>rule.maxBytes)throw new Error('ACTION_DATA_TOO_LARGE');
    total+=bytes;
  }
  if(total>maxTotalBytes)throw new Error('TOTAL_ACTION_DATA_TOO_LARGE');
  return total;
}
