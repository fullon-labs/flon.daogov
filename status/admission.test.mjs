import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {openStore} from './store.mjs';
import {verifyAdmission,targetKey,retentionKey,TEMPORARY_MS} from './admission.mjs';
const bp={id:'trial',producer:'einstein',network:'testnet',chainId:'a'.repeat(64),rpc:'http://example.invalid:8888',rpcScope:'bp'};
test('account and self-declared BP scope do not grant long-term admission',async()=>{assert.equal((await verifyAdmission(bp,{})).verified,false)});
test('long-term admission needs matching private endpoint evidence and trusted registered BP',async()=>{
 const now=Date.now(),policy={networks:{testnet:{chainId:bp.chainId,rpc:'https://trusted.invalid'}},attestations:[{target_key:targetKey(bp),verified_at:new Date(now-1).toISOString(),valid_until:new Date(now+60000).toISOString(),evidence:'Independent operator verification'}]};
 let active=true,chain=bp.chainId;
 const mock=async url=>({ok:true,json:async()=>url.pathname.endsWith('get_info')?{chain_id:chain}:{rows:[{owner:bp.producer,is_active:active}]}});
 assert.equal((await verifyAdmission(bp,policy,now,mock)).verified,true);
 active=false;assert.equal((await verifyAdmission(bp,policy,now,mock)).verified,false);
 active=true;chain='wrong';assert.equal((await verifyAdmission(bp,policy,now,mock)).verified,false);
 assert.equal((await verifyAdmission({...bp,rpc:'http://other.invalid'},policy,now,mock)).verified,false);
 assert.equal((await verifyAdmission(bp,policy,now+60001,mock)).verified,false);
});
test('30 minute deadline survives restart and aliases; expired configs and samples can be purged without renewal',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'status-trial-'));let store;
 try{store=await openStore(dir);store.save(bp);const first=store.admission(bp);const end=Date.parse(first.expires_at);assert.equal(store.admission(bp,end-1).expired,false);assert.equal(store.admission(bp,end).expired,true);
 store.verify(bp,{verified:false,reason:'still_unverified'},end-10);assert.equal(store.admission(bp).expires_at,first.expires_at);
 store.close();store=await openStore(dir);assert.equal(store.admission(bp).expires_at,first.expires_at);
 const alias={...bp,id:'different',producer:'newton',referenceRpc:'http://new-reference.invalid'};assert.equal(retentionKey(alias),retentionKey(bp));store.save(alias);assert.equal(store.admission(alias).expires_at,first.expires_at);
 store.append(bp.id,[{at:Date.now(),id:'rpc',status:'operational'}]);store.purge(bp);assert.equal(store.history(bp.id).length,0);assert.ok(!store.configs().some(c=>c.id===bp.id));
 store.verify(alias,{verified:true,reason:'too_late'},end);assert.equal(store.admission(alias,end).expired,true);
 }finally{store?.close();await rm(dir,{recursive:true,force:true})}
});
test('losing long-term eligibility starts one bounded grace period without extension',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'status-revoke-'));const store=await openStore(dir);
 try{store.save(bp);const now=Date.now();store.verify(bp,{verified:true,reason:'verified'},now);assert.equal(store.admission(bp).mode,'long_term');assert.equal(store.admission(bp).expires_at,null);
 store.verify(bp,{verified:false,reason:'delisted'},now+1);const end=Date.parse(store.admission(bp).expires_at);assert.equal(end,now+1+TEMPORARY_MS);
 store.verify(bp,{verified:false,reason:'still_delisted'},now+100);assert.equal(Date.parse(store.admission(bp).expires_at),end);
 }finally{store.close();await rm(dir,{recursive:true,force:true})}
});
