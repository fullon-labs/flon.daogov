import {createHash} from 'node:crypto';
export const TEMPORARY_MS=30*60*1000;
export function targetKey(bp){
 const url=x=>{try{return new URL(x).href}catch{return x||''}};
 const services=(bp.services||[]).map(s=>[s.id,s.type,url(s.url),s.host||'',Number(s.port)||0]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return createHash('sha256').update(JSON.stringify([bp.network,bp.chainId,bp.producer,url(bp.rpc),url(bp.referenceRpc),services,...(bp.foundationGroup?[bp.foundationGroup]:[])])).digest('hex');
}
// The same RPC cannot renew its trial by changing account, label or record ID.
export function retentionKey(bp){
 let endpoint;try{endpoint=new URL(bp.rpc);endpoint.hash='';endpoint.search='';endpoint.pathname='/';endpoint=endpoint.href}catch{endpoint=bp.rpc||''}
 return createHash('sha256').update(endpoint).digest('hex');
}
// Trust comes only from operator-owned policy, never from the observed endpoint or form.
export async function verifyAdmission(bp,policy,now=Date.now(),fetchImpl=fetch,{foundationApproved=false}={}){
 const key=targetKey(bp),network=policy?.networks?.[bp.network];
 const foundation=foundationApproved&&Boolean(bp.foundationGroup)&&bp.rpcScope==='bp';
 if(bp.rpcScope!=='bp')return {verified:false,reason:'reference_rpc_only'};
 const attestation=policy?.attestations?.find(a=>a.target_key===key&&typeof a.evidence==='string'&&a.evidence.trim()&&Date.parse(a.verified_at)<=now&&Date.parse(a.valid_until)>now);
 if(!network||network.chainId!==bp.chainId||(!attestation&&!foundation))return {verified:false,reason:'endpoint_ownership_unverified'};
 try{
  const post=async(method,body)=>{const r=await fetchImpl(new URL('/v1/chain/'+method,network.rpc),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();return r.json()};
  const info=await post('get_info',{});if(info.chain_id!==network.chainId)return {verified:false,reason:'trusted_chain_mismatch'};
  const data=await post('get_table_rows',{json:true,code:'flon',scope:'flon',table:'producers',lower_bound:bp.producer,upper_bound:bp.producer,limit:1});
  const row=data.rows?.find(r=>r.owner===bp.producer);
  if(!row||![true,1].includes(row.is_active))return {verified:false,reason:'not_registered_bp'};
  {
   const r=await fetchImpl(new URL('/v1/chain/get_info',bp.rpc),{method:'POST',headers:{'content-type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(5000)});
   if(!r.ok||(await r.json()).chain_id!==network.chainId)return {verified:false,reason:'bound_node_chain_mismatch'};
  }
  return {verified:true,reason:foundation?'foundation_admin_binding':'registered_bp_and_attested_endpoint'};
 }catch{return {verified:false,reason:'verification_unavailable'}}
}
