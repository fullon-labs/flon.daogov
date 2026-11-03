import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {publicKeyForSecret,signReadiness,verifyBLS,encodeBLS} from './bls-readiness.mjs';
import {createFinalizerService,challengeMessage} from './finalizer-service.mjs';
import {openFinalizerStore} from './finalizer-store.mjs';
const secret=new Uint8Array(32);secret[31]=1;const key=publicKeyForSecret(secret);const secret2=new Uint8Array(32);secret2[31]=2;const key2=publicKeyForSecret(secret2);
const chain='a'.repeat(64),blockId=n=>n.toString(16).padStart(8,'0')+'11'.repeat(28);
async function fixture(){
 const dir=await mkdtemp(path.join(os.tmpdir(),'readiness-')),store=await openFinalizerStore(path.join(dir,'finalizer.sqlite'));
 const state={time:Date.parse('2026-10-31T04:45:00Z'),key,votes:[],active:false,pending:false,wrongChain:false,wrongBlock:false};
 const fetchImpl=async(url,options)=>{const b=JSON.parse(options.body),method=url.pathname.split('/').at(-1);let data;
  if(method==='get_info')data={chain_id:state.wrongChain?'wrong':chain,head_block_num:200,last_irreversible_block_num:100,last_irreversible_block_id:blockId(100)};
  else if(method==='get_block'){const n=typeof b.block_num_or_id==='number'?b.block_num_or_id:Number.parseInt(b.block_num_or_id.slice(0,8),16);data={id:state.wrongBlock?blockId(n+1):blockId(n),block_num:n,timestamp:'2026-10-31T04:44:59.000'}}
  else if(method==='get_finalizer_info')data={active_finalizer_policy:state.active?{generation:2,finalizers:[{description:'not-the-account',public_key:state.key}]}:null,pending_finalizer_policy:state.pending?{generation:3,finalizers:[{public_key:state.key}]}:null,last_tracked_votes:state.votes};
  else data={rows:b.table==='finkeys'?[{id:1,finalizer_name:'einstein',finalizer_key:state.key}]:b.table==='finalizers'?[{finalizer_name:'einstein',active_key_id:1}]:[{owner:'einstein',is_active:true}],more:false};
  return {ok:true,json:async()=>data};
 };
 const service=createFinalizerService([{network:'testnet',chainId:chain,rpc:'https://private.invalid'}],store,{fetchImpl,now:()=>state.time});
 return {state,service,store,async close(){store.close();await rm(dir,{recursive:true,force:true})}};
}
test('registered standby key never becomes online or ready without evidence',async()=>{const f=await fixture();try{const d=await f.service.list('testnet'),e=d.finalizers[0];assert.equal(e.registration_status,'key_prepared');assert.equal(e.policy_status,'outside_policy');assert.equal(e.readiness,'key_prepared_only');assert.equal(e.last_vote_block,null);assert.equal(e.online_proof,null);assert.ok(!JSON.stringify(d).includes('private.invalid'))}finally{await f.close()}});
test('policy membership matches registered public keys, not descriptive names',async()=>{const f=await fixture();try{f.state.active=true;f.state.pending=true;const e=(await f.service.list('testnet')).finalizers[0];assert.equal(e.policy_status,'active_and_pending');assert.equal(e.active_generation,2);assert.equal(e.readiness,'key_prepared_only')}finally{await f.close()}});
test('challenge is domain separated, chain/account/block/expiry bound and one-use',async()=>{const f=await fixture();try{
 const c=await f.service.issue('testnet','einstein');assert.equal(c.payload.chain_id,chain);assert.equal(c.payload.block_num,100);assert.equal(c.payload.block_id,blockId(100));assert.equal(c.message,challengeMessage(c.payload));assert.equal(Date.parse(c.payload.expires_at)-Date.parse(c.payload.issued_at),300000);assert.equal((await f.service.issue('testnet','einstein')).id,c.id);
 const wrong=signReadiness(secret,challengeMessage({...c.payload,account:'newton'}));await assert.rejects(f.service.submit(c.id,wrong),/INVALID_BLS_SIGNATURE/);
 await assert.rejects(f.service.submit(c.id,signReadiness(secret2,c.message)),/INVALID_BLS_SIGNATURE/);
 const proof=await f.service.submit(c.id,signReadiness(secret,c.message));assert.equal(proof.valid,true);assert.equal((await f.service.list('testnet')).finalizers[0].readiness,'time_limited_online_proof');
 await assert.rejects(f.service.submit(c.id,proof.signature),/USED/);
 f.state.time=Date.parse(c.payload.expires_at);assert.equal((await f.service.list('testnet')).finalizers[0].online_proof.valid,false);
 }finally{await f.close()}});
test('key rotation and unavailable chain immediately invalidate readiness evidence',async()=>{const f=await fixture();try{const c=await f.service.issue('testnet','einstein');await f.service.submit(c.id,signReadiness(secret,c.message));f.state.key=key2;f.state.time+=16000;assert.equal((await f.service.list('testnet')).finalizers[0].online_proof.status,'key_changed');f.state.wrongChain=true;f.state.time+=16000;const e=(await f.service.list('testnet')).finalizers[0];assert.equal(e.stale,true);assert.equal(e.readiness,'unknown');assert.equal(e.online_proof.valid,false)}finally{await f.close()}});
test('expired or rotated challenges and invalid canonical blocks cannot publish proofs',async()=>{const f=await fixture();try{
 const c=await f.service.issue('testnet','einstein');f.state.time+=300000;await assert.rejects(f.service.submit(c.id,signReadiness(secret,c.message)),/EXPIRED/);
 f.state.key=key2;const newer=await f.service.issue('testnet','einstein');f.state.key=key;await assert.rejects(f.service.submit(newer.id,signReadiness(secret2,newer.message)),/KEY_CHANGED/);
 f.state.wrongBlock=true;await assert.rejects(f.service.issue('testnet','einstein'),/INVALID_CHALLENGE_BLOCK/);
 }finally{await f.close()}});
test('QC vote is published only after canonical block check and retains evidence provenance',async()=>{const f=await fixture();try{
 f.state.active=true;f.state.votes=[{public_key:key,description:'different-description',is_vote_strong:true,finalizer_policy_generation:2,voted_for_block_num:150,voted_for_block_id:blockId(150),voted_for_block_timestamp:'2026-10-31T04:44:59.000'}];
 f.state.wrongBlock=true;assert.equal((await f.service.list('testnet')).finalizers[0].last_vote_block,null);
 f.state.wrongBlock=false;f.state.time+=16000;const e=(await f.service.list('testnet')).finalizers[0];assert.equal(e.last_vote_block,150);assert.equal(e.last_verifiable_vote.independently_verified_signature,false);assert.equal(e.readiness,'recent_qc_vote');
 f.state.votes=[];f.state.time+=16000;assert.equal((await f.service.list('testnet')).finalizers[0].last_vote_block,150);
 }finally{await f.close()}});
test('BLS rejects wrong domain, infinity, invalid checksum and malformed encoding',()=>{
 const m='FULLON_FINALIZER_READINESS_V1\ntest',sig=signReadiness(secret,m);assert.equal(verifyBLS(key,m,sig),true);assert.equal(verifyBLS(key,m+'x',sig),false);
 assert.equal(verifyBLS(encodeBLS(Buffer.alloc(96),'PUB_BLS_'),m,sig),false);assert.equal(verifyBLS(key,m,encodeBLS(Buffer.alloc(192),'SIG_BLS_')),false);
 assert.equal(verifyBLS(key+'!',m,sig),false);assert.equal(verifyBLS(key,m,sig.slice(0,-1)+'!'),false);
});

test('owning native C++ BLS fixture verifies with exactly the chain serialization and DST',async()=>{
 const vector=JSON.parse(await readFile(new URL('./bls-native-vector.json',import.meta.url),'utf8'));assert.equal(verifyBLS(vector.public_key,vector.message,vector.signature),true);assert.equal(verifyBLS(vector.public_key,vector.message+'wrong-chain',vector.signature),false);
});
