import {randomBytes} from 'node:crypto';
import {verifyBLS} from './bls-readiness.mjs';
export function challengeMessage(p){return 'FULLON_FINALIZER_READINESS_V1\n'+JSON.stringify(p)}
const accountPattern=/^[a-z1-5.]{1,12}$/;
export function createFinalizerService(sources,store,{audience='https://status.flon.network',fetchImpl=fetch,now=Date.now,verify=verifyBLS}={}){
 const networks=new Map(),pending=new Map(),observations=new WeakMap();
 const sourceFor=network=>{const source=sources.find(s=>s.network===network);if(!source)throw Error('UNKNOWN_NETWORK');return source};
 async function rpc(source,method,body={}){const r=await fetchImpl(new URL('/v1/chain/'+method,source.rpc),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(7000)});if(!r.ok)throw Error('FINALIZER_RPC_UNAVAILABLE');return r.json()}
 async function table(source,name){let cursor;const result=[];for(let page=0;page<100;page++){const d=await rpc(source,'get_table_rows',{json:true,code:'flon',scope:'flon',table:name,limit:200,...(cursor?{lower_bound:cursor}:{})});if(!Array.isArray(d.rows))throw Error('INVALID_CHAIN_TABLE');result.push(...d.rows);if(!d.more||d.more==='false')return result;if(!d.next_key||d.next_key===cursor)throw Error('INCOMPLETE_CHAIN_TABLE');cursor=d.next_key}throw Error('CHAIN_TABLE_LIMIT')}
 async function refresh(network,{force=false}={}){
  const source=sourceFor(network),old=networks.get(network);if(!force&&old&&!old.failed&&now()-old.fetched<15000)return old;
  if(pending.has(network))return pending.get(network);
  const promise=(async()=>{try{
   const info=await rpc(source,'get_info');if(info.chain_id!==source.chainId)throw Error('CHAIN_ID_MISMATCH');
   const [keys,registered,finality,producers]=await Promise.all([table(source,'finkeys'),table(source,'finalizers'),rpc(source,'get_finalizer_info').catch(()=>null),table(source,'producers').catch(()=>[])]);
   const result={info,keys,registered,finality,producers,fetched:now(),failed:false};networks.set(network,result);return result;
  }catch(e){if(old)networks.set(network,{...old,failed:true});throw e}finally{pending.delete(network)}})();pending.set(network,promise);return promise;
 }
 function entry(network,account,data){
  const registration=data.registered.find(r=>r.finalizer_name===account),keys=data.keys.filter(k=>k.finalizer_name===account);
  const selected=registration?keys.find(k=>String(k.id)===String(registration.active_key_id)):null;
  const key=selected?.finalizer_key??null;
  const membership=policy=>Boolean(key&&policy?.finalizers?.some(f=>f.public_key===key));
  const active=membership(data.finality?.active_finalizer_policy),pending=membership(data.finality?.pending_finalizer_policy);
  const proof=store.proof(network,account),stale=data.failed||now()-data.fetched>75000;
  const proofValid=Boolean(proof&&!stale&&proof.payload.chain_id===data.info.chain_id&&proof.payload.public_key===key&&now()<Date.parse(proof.payload.expires_at));
  const vote=store.vote(network+':'+data.info.chain_id,account);
  const voteAge=vote?now()-Date.parse(vote.voted_for_block_timestamp+(vote.voted_for_block_timestamp.endsWith('Z')?'':'Z')):Infinity;
  return {account,network,chain_id:data.info.chain_id,registered_public_key:key,registered_keys:keys.map(k=>({id:String(k.id),public_key:k.finalizer_key})),
   registration_status:key?'key_prepared':keys.length?'keys_registered_no_selected_key':'not_registered',
   policy_status:data.finality?active&&pending?'active_and_pending':active?'active':pending?'pending':'outside_policy':'unknown',active,pending,
   active_generation:data.finality?.active_finalizer_policy?.generation??null,pending_generation:data.finality?.pending_finalizer_policy?.generation??null,
   last_verifiable_vote:vote?{...vote,matches_registered_key:vote.public_key===key}:null,last_vote_block:vote?.voted_for_block_num??null,last_vote_at:vote?.voted_for_block_timestamp??null,
   vote_evidence:vote?'node_validated_qc_and_canonical_block':'unavailable',
   online_proof:proof?{...proof,valid:proofValid,status:proofValid?'valid':stale?'chain_state_unavailable':proof.payload.chain_id!==data.info.chain_id?'chain_changed':proof.payload.public_key!==key?'key_changed':'expired'}:null,
   readiness:stale?'unknown':proofValid?'time_limited_online_proof':vote&&vote.public_key===key&&voteAge>=0&&voteAge<300000?'recent_qc_vote':key?'key_prepared_only':'unknown',
   stale,updated_at:new Date(data.fetched).toISOString()};
 }
 async function observeVotes(network,data){
  const source=sourceFor(network),votes=data.finality?.last_tracked_votes||[];
  const blocks=new Map();
  await Promise.all(votes.slice(0,256).map(async vote=>{try{
   const owner=data.keys.find(k=>k.finalizer_key===vote.public_key)?.finalizer_name;if(!owner)return;
   const previous=store.vote(network+':'+data.info.chain_id,owner);if(previous?.voted_for_block_id===vote.voted_for_block_id&&previous.public_key===vote.public_key)return;
   if(!Number.isSafeInteger(vote.voted_for_block_num)||vote.voted_for_block_num<1||!/^[a-f0-9]{64}$/.test(vote.voted_for_block_id))return;
   if(!blocks.has(vote.voted_for_block_id))blocks.set(vote.voted_for_block_id,rpc(source,'get_block',{block_num_or_id:vote.voted_for_block_id}));
   const block=await blocks.get(vote.voted_for_block_id);
   if(block.id!==vote.voted_for_block_id||block.block_num!==vote.voted_for_block_num||Date.parse(block.timestamp.replace(/Z$/,'')+'Z')!==Date.parse(String(vote.voted_for_block_timestamp).replace(/Z$/,'')+'Z'))return;
   store.vote(network+':'+data.info.chain_id,owner,{...vote,chain_id:data.info.chain_id,observed_at:new Date(now()).toISOString(),verification:'rpc_validated_qc_block_matched',independently_verified_signature:false});
  }catch{}}));
 }
 async function list(network){let data;try{data=await refresh(network);if(!observations.has(data))observations.set(data,observeVotes(network,data));await observations.get(data)}catch{data=networks.get(network);if(!data)throw Error('FINALIZER_DATA_UNAVAILABLE')}
  const accounts=[...new Set([...data.producers.map(p=>p.owner),...data.registered.map(r=>r.finalizer_name),...data.keys.map(k=>k.finalizer_name)])].filter(a=>accountPattern.test(a)).sort();
  return {network,chain_id:data.info.chain_id,updated_at:new Date(data.fetched).toISOString(),stale:data.failed||now()-data.fetched>75000,policy_available:Boolean(data.finality),vote_tracking_available:Boolean(data.finality?.last_tracked_votes?.length),finalizers:accounts.map(a=>entry(network,a,data))};
 }
 async function issue(network,account){
  if(!accountPattern.test(account||''))throw Error('INVALID_ACCOUNT');
  const data=await refresh(network,{force:true}),e=entry(network,account,data);
  if(!e.registered_public_key)throw Error('NO_CURRENT_REGISTERED_KEY');
  const existing=store.existing(network,account,now());if(existing&&existing.payload.public_key===e.registered_public_key)return existing;
  const source=sourceFor(network),block=await rpc(source,'get_block',{block_num_or_id:data.info.last_irreversible_block_num});
  if(block.block_num!==data.info.last_irreversible_block_num||!/^[a-f0-9]{64}$/.test(block.id)||block.id!==data.info.last_irreversible_block_id)throw Error('INVALID_CHALLENGE_BLOCK');
  const payload={domain:'fullon.finalizer.readiness.v1',audience,network,chain_id:source.chainId,account,public_key:e.registered_public_key,block_num:block.block_num,block_id:block.id,issued_at:new Date(now()).toISOString(),expires_at:new Date(now()+300000).toISOString(),nonce:randomBytes(32).toString('hex')};
  const c={id:randomBytes(24).toString('hex'),payload,message:challengeMessage(payload),signature_format:'SIG_BLS_affine_le_checksum',ciphersuite:'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_'};store.issue(c,now());return c;
 }
 async function submit(id,signature){
  if(!/^[a-f0-9]{48}$/.test(id||'')||typeof signature!=='string'||signature.length>400||!signature.startsWith('SIG_BLS_'))throw Error('INVALID_PROOF_INPUT');
  const c=store.getChallenge(id);if(!c||c.used)throw Error('UNKNOWN_OR_USED_CHALLENGE');if(now()>=Date.parse(c.payload.expires_at))throw Error('CHALLENGE_EXPIRED');
  const data=await refresh(c.payload.network,{force:true}),e=entry(c.payload.network,c.payload.account,data);
  if(data.info.chain_id!==c.payload.chain_id||e.registered_public_key!==c.payload.public_key)throw Error('REGISTERED_KEY_CHANGED');
  if(!verify(c.payload.public_key,c.message,signature))throw Error('INVALID_BLS_SIGNATURE');
  if(now()>=Date.parse(c.payload.expires_at))throw Error('CHALLENGE_EXPIRED');
  const proof={challenge_id:c.id,payload:c.payload,message:c.message,signature,verified_at:new Date(now()).toISOString(),verifier:'BLS12-381 Basic G2 signature; registered G1 public key'};store.publish(c,proof);return {...proof,valid:true};
 }
 return {list,issue,submit,refresh};
}
