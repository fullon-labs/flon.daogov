import net from 'node:net';
import {epochPerformance,aggregate,summary} from './health.mjs';
export async function createCollector(config,store){
const interval=Math.max(15,Number(config.intervalSeconds)||30);
await store.migrate(config.id);
let history=store.history(config.id);
let snapshot={status:'unknown',updated_at:null,services:[]};
const rpc=async(base,method,body={})=>{
  if(!base)throw Error('unconfigured');
  const res=await fetch(new URL('/v1/chain/'+method,base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(7000)});
  if(!res.ok)throw Error('unavailable');return res.json();
};
const table=async(name,scope='flon',extra={})=> (await rpc(config.rpc,'get_table_rows',{json:true,code:'flon',scope,table:name,limit:30,...extra})).rows;
const safe=promise=>promise.catch(()=>null);
async function probe(s){
  const start=performance.now();let status='unknown',detail='未配置';
  if(s.type==='tcp'&&s.host&&s.port){
    status=await new Promise(resolve=>{const socket=net.connect({host:s.host,port:s.port});const finish=x=>{socket.destroy();resolve(x)};socket.setTimeout(5000,()=>finish('outage'));socket.once('connect',()=>finish('operational'));socket.once('error',()=>finish('outage'))});detail='TCP connectivity · 不代表 P2P 握手或同步';
  }else if(s.url){try{
    if(s.type==='rpc'){const info=await rpc(s.url,'get_info');status=info.chain_id&&(!config.chainId||info.chain_id===config.chainId)?'operational':'degraded';detail='get_info · HTTP / JSON';}
    else{const r=await fetch(s.url,{signal:AbortSignal.timeout(7000),redirect:'error'});status=r.ok?'operational':'outage';await r.body?.cancel();detail='HTTP reachability';}
  }catch{status='outage';detail='探测失败';}}
  return {id:s.id,name:s.name,type:s.type,status,detail,latency_ms:status==='unknown'?null:Math.round(performance.now()-start)};
}
async function collect(){
 const now=Date.now();
 const [info,reference,schedule,epochs,services]=await Promise.all([safe(rpc(config.rpc,'get_info')),safe(rpc(config.referenceRpc,'get_info')),safe(rpc(config.rpc,'get_producer_schedule')),safe(table('epochstats','flon',{reverse:true,limit:30})),Promise.all((config.services||[]).map(probe))]);
 const chainMatches=info&&config.chainId?info.chain_id===config.chainId:null;
 const refMatches=info&&reference&&info.chain_id===reference.chain_id;
 const lag=refMatches?Math.max(0,reference.head_block_num-info.head_block_num):null;
 const chainTime=info?Date.parse(info.head_block_time+(info.head_block_time.endsWith('Z')?'':'Z')):NaN;
 const age=Number.isFinite(chainTime)?Math.max(0,(now-chainTime)/1000):null;
 const role=schedule?.active&&config.producer?(schedule.active.producers.some(p=>p.producer_name===config.producer)?'active':'standby'):'unknown';
 const epoch=epochs?.[0];
 const [producers,stakes,gasRows]=await Promise.all([
 safe((async()=>{const rows=[];let cursor;for(let page=0;page<100;page++){const r=await rpc(config.rpc,'get_table_rows',{json:true,code:'flon',scope:'flon',table:'producers',limit:200,...(cursor?{lower_bound:cursor}:{})});rows.push(...r.rows);if(!r.more)return rows;if(!r.next_key||r.next_key===cursor)throw Error('pagination');cursor=r.next_key;}throw Error('pagination limit');})()),
 config.producer?safe(table('bpstakes','flon',{lower_bound:config.producer,upper_bound:config.producer,limit:1})):null,
 epoch&&config.producer?safe(table('gasnodestats',String(epoch.epoch_id),{lower_bound:config.producer,upper_bound:config.producer,limit:1})):null]);
 const ranked=producers?.filter(p=>p.is_active!==false&&p.is_active!==0).sort((a,b)=>Number(b.total_votes)-Number(a.total_votes));
 const candidate=producers?.find(p=>p.owner===config.producer);
 const rank=candidate&&ranked?ranked.findIndex(p=>p.owner===config.producer)+1:null;
 const gas=gasRows?.find(p=>p.owner===config.producer);

 const rows=await Promise.all((epochs||[]).map(async e=>{
  try{const entries=await table('bpstats',String(e.epoch_id),{lower_bound:config.producer,upper_bound:config.producer,limit:1});
    if(!Array.isArray(entries))throw Error('Invalid response');
    return epochPerformance(e,entries.find(r=>r.producer===config.producer));
  }catch{return epochPerformance(e,null,{queryFailed:true})}
 }));
 const stats=rows[0]?.stats;
 const chainStatus=!config.rpc?'unknown':!info?'outage':chainMatches!==true?'unknown':age===null?'unknown':age>(config.lagThresholdSeconds||36)||lag>12?'degraded':config.referenceRpc&&!refMatches?'unknown':'operational';
 const bpStatus=role==='unknown'?'unknown':role==='active'&&(!stats||!stats.consistent)?'unknown':role==='active'&&['warning','degraded','suspended'].includes(stats?.qualification)?'degraded':'operational';
 const maintenance=(config.maintenance||[]).filter(m=>Date.parse(m.starts_at)<=now&&Date.parse(m.ends_at)>now);
 const overall=aggregate([chainStatus,bpStatus,config.rpcScope==='reference'?'unknown':'operational',...services.map(s=>s.status)]);
 const status=maintenance.length&&overall==='operational'?'maintenance':overall;
 store.append(config.id,[{at:now,id:'overall',status,latency_ms:null},...services.map(s=>({at:now,id:s.id,status:s.status,latency_ms:s.latency_ms}))]);
 history=store.history(config.id);
 snapshot={rpc_scope:config.rpcScope||'unverified',id:config.id,label:config.label,title:config.title,network:config.network,producer:config.producer||null,role,status,chain_status:chainStatus,
 chain_id:info?.chain_id??null,chain_verified:chainMatches,node_version:info?.server_version_string??null,
 head_block:info?.head_block_num??null,lib_block:info?.last_irreversible_block_num??null,
 head_lib_gap:info?info.head_block_num-info.last_irreversible_block_num:null,sync_lag_blocks:lag,head_age_seconds:age,
 sync_lag_seconds:refMatches?Math.max(0,(Date.parse(reference.head_block_time+(reference.head_block_time.endsWith('Z')?'':'Z'))-chainTime)/1000):null,
 schedule_version:schedule?.active?.version??null,current_epoch:epoch?.epoch_id??null,...stats,
 last_produced_at:null,last_produced_block:null,protocol_version:null,p2p_peers:null,finalizer_status:'unknown',
 location:config.location||null,contact:config.contact||null,readiness:'unknown',standby_proof:'unknown',
 candidate_status:candidate?(candidate.is_active?'registered':'inactive'):'unknown',rank:rank||null,
 votes:candidate?.total_votes??null,votes_to_21:ranked?.[20]&&candidate?Math.max(0,Number(ranked[20].total_votes)-Number(candidate.total_votes)):null,
 self_stake:stakes?.find(p=>p.owner===config.producer)?.staked??null,
 gas:gas?{eligible:gas.eligible,score:gas.score,allocated:gas.allocated}:null,
 incidents:config.incidents||[],maintenance:config.maintenance||[],epoch_history:rows,epoch_history_error:epochs===null,
 uptime:Object.fromEntries([1,7,30,90].map(d=>[d,summary(history.filter(r=>r.id==='overall'),now,d,interval)])),
 services:services.map(s=>({...s,windows:Object.fromEntries([1,7,30,90].map(d=>[d,summary(history.filter(r=>r.id===s.id),now,d,interval)])),days:Array.from({length:90},(_,i)=>{const end=now-(89-i)*86400000;return {date:new Date(end).toISOString().slice(0,10),...summary(history.filter(r=>r.id===s.id&&r.at>end-86400000&&r.at<=end),end,1,interval)}})})),
 updated_at:new Date(now).toISOString(),interval_seconds:interval};
}

 let collecting=false;
 async function refresh(){
  if(collecting||store.admission(config).expired)return;
  collecting=true;
  try{await collect()}catch{snapshot={...snapshot,status:'unknown',collection_error:true}}finally{collecting=false}
 }
 return {refresh,interval,status(){return {...snapshot,admission:store.admission(config),id:config.id,label:config.label,network:config.network,producer:config.producer||null,stale:!snapshot.updated_at||Date.now()-Date.parse(snapshot.updated_at)>interval*2500}}};
}
