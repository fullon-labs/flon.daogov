import {epochPerformance,summary} from './health.mjs';
export function discoverySources(raw){
 const sources=raw.discovery??(raw.bps||[raw]).filter(b=>b.network&&b.chainId&&b.rpc);
 const seen=new Set();
 return sources.filter(s=>{const key=s.network+':'+s.chainId;if(seen.has(key))return false;seen.add(key);return true}).map(s=>({network:s.network,chainId:s.chainId,rpc:s.rpc}));
}
export function createDiscovery(sources,{title='FULLON Status',fetchImpl=fetch,now=Date.now}={}){
 const networks=new Map();let refreshing=false;
 const post=async(source,method,body={})=>{
  const r=await fetchImpl(new URL('/v1/chain/'+method,source.rpc),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(7000)});
  if(!r.ok)throw Error('RPC unavailable');return r.json();
 };
 async function rows(source,table,scope='flon',extra={}){
  const result=[];let cursor;
  for(let page=0;page<100;page++){
   const data=await post(source,'get_table_rows',{json:true,code:'flon',scope,table,limit:200,...extra,...(cursor?{lower_bound:cursor}:{})});
   if(!Array.isArray(data.rows))throw Error('Invalid table');result.push(...data.rows);
   if(!data.more)return result;
   if(!data.next_key||data.next_key===cursor)throw Error('Incomplete pagination');cursor=data.next_key;
  }
  throw Error('Pagination limit');
 }
 const optional=p=>p.catch(()=>null);
 async function refreshNetwork(source){
  const key=source.network+':'+source.chainId;
  try{
   const info=await post(source,'get_info');if(info.chain_id!==source.chainId)throw Error('Wrong network');
   const [schedule,producers,epochs,stakes]=await Promise.all([
    post(source,'get_producer_schedule'),rows(source,'producers'),optional(post(source,'get_table_rows',{json:true,code:'flon',scope:'flon',table:'epochstats',reverse:true,limit:30})),optional(rows(source,'bpstakes'))]);
   if(!Array.isArray(schedule.active?.producers))throw Error('Missing active schedule');
   const active=new Set(schedule.active.producers.map(p=>p.producer_name));
   const ranked=producers.filter(p=>[true,1].includes(p.is_active)||active.has(p.owner)).sort((a,b)=>Number(b.total_votes)-Number(a.total_votes)||a.owner.localeCompare(b.owner));
   // Active schedule members remain visible during registration/schedule transitions.
   for(const owner of active)if(!ranked.some(p=>p.owner===owner))ranked.push({owner,is_active:false});
   const history=await Promise.all((epochs?.rows||[]).map(async e=>({...e,stats:await optional(rows(source,'bpstats',String(e.epoch_id)))})));
   const gas=history[0]?await optional(rows(source,'gasnodestats',String(history[0].epoch_id))):null;
   networks.set(key,{source,info,schedule,ranked,active,history,stakes,gas,epoch_history_error:epochs===null,updated_at:new Date(now()).toISOString(),failed:false});
  }catch{const previous=networks.get(key);networks.set(key,previous?{...previous,failed:true}:{source,failed:true,ranked:[]})}
 }
 function snapshots(){
  const out=[];
  for(const n of networks.values())for(const [index,p] of n.ranked.entries()){
   const account=p.owner,epochHistory=n.history.map(e=>epochPerformance(e,e.stats?.find(r=>r.producer===account),{queryFailed:e.stats===null}));
   const stats=epochHistory[0]?.stats;
   const g=n.gas?.find(r=>r.owner===account);
   const stale=n.failed||now()-Date.parse(n.updated_at)>75000;
   out.push({id:`${n.source.network}-${account}`,label:account,title,network:n.source.network,producer:account,
    role:n.active.has(account)?'active':'standby',status:'unknown',rpc_scope:'reference',source:'chain_discovery',stale,
    admission:{mode:'catalog',reason:'chain_account_only',expires_at:null,expired:false},
    chain_id:n.info.chain_id,chain_verified:true,head_block:n.info.head_block_num,lib_block:n.info.last_irreversible_block_num,
    head_lib_gap:n.info.head_block_num-n.info.last_irreversible_block_num,node_version:n.info.server_version_string??null,
    sync_lag_blocks:null,sync_lag_seconds:null,head_age_seconds:Math.max(0,(now()-Date.parse(n.info.head_block_time+(n.info.head_block_time.endsWith('Z')?'':'Z')))/1000),
    schedule_version:n.schedule.active.version,current_epoch:epochHistory[0]?.epoch_id??null,...stats,
    epoch_history:epochHistory,epoch_history_error:n.epoch_history_error,candidate_status:p.is_active?'registered':'schedule_transition',rank:index+1,votes:p.total_votes??null,
    votes_to_21:n.ranked[20]&&p.total_votes!=null?Math.max(0,Number(n.ranked[20].total_votes)-Number(p.total_votes)):null,
    self_stake:n.stakes?.find(r=>r.owner===account)?.staked??null,gas:g?{eligible:g.eligible,score:g.score,allocated:g.allocated}:null,
    readiness:'unknown',finalizer_status:'unknown',p2p_peers:null,last_produced_at:null,location:null,contact:null,
    services:[],incidents:[],maintenance:[],uptime:Object.fromEntries([1,7,30,90].map(d=>[d,summary([],now(),d,30)])),
    updated_at:n.updated_at,interval_seconds:30});
  }
  return out;
 }
 return {async refresh(){if(refreshing)return;refreshing=true;try{await Promise.all(sources.map(refreshNetwork))}finally{refreshing=false}},snapshots,
  health(){return sources.map(source=>{const n=networks.get(source.network+':'+source.chainId);return {network:source.network,status:n&&!n.failed?'operational':'unknown',updated_at:n?.updated_at??null}})}};
}
export function mergeDirectory(discovered,monitored){
 const entries=new Map(discovered.map(d=>[d.network+':'+d.chain_id+':'+d.producer,d]));
 for(const m of monitored){const key=m.network+':'+m.chain_id+':'+m.producer;const chain=entries.get(key);entries.set(key,chain?{...m,role:chain.stale?m.role:chain.role}:m)}
 return [...entries.values()].sort((a,b)=>a.network.localeCompare(b.network)||(a.role==='active'?0:1)-(b.role==='active'?0:1)||a.producer?.localeCompare(b.producer??'')||a.id.localeCompare(b.id));
}
