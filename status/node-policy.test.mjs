import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {openStore} from './store.mjs';
import {canonicalIP,validateNodeTopology} from './node-policy.mjs';
import {verifyAdmission} from './admission.mjs';
import {createProbeCache} from './probe-cache.mjs';
const chainId='a'.repeat(64);
const node=(id,producer,ip='192.0.2.10',port=8888)=>({id,producer,network:'testnet',chainId,rpc:`http://${ip}:${port}`,rpcScope:'bp',services:[{id:'p2p',type:'tcp',host:ip,port:9876}]});
const roster=['einstein','newton'].map(producer=>({network:'testnet',chainId,producer}));
test('third-party nodes cannot reuse IP by changing ports or DNS spelling',()=>{
 const first=node('one','einstein');assert.throws(()=>validateNodeTopology(node('two','newton','192.0.2.10',9999),[first],[]));
 assert.throws(()=>validateNodeTopology({...node('dns','newton'),rpc:'https://alias.example.invalid'},[],[]));
 assert.equal(canonicalIP('::ffff:192.0.2.10'),'192.0.2.10');assert.equal(canonicalIP('2001:0db8:0:0:0:0:0:1'),canonicalIP('2001:db8::1'));
 assert.throws(()=>validateNodeTopology({...node('mapped','newton'),rpc:'http://[::ffff:c000:20a]:9999',services:[{id:'p2p',type:'tcp',host:'::ffff:192.0.2.10',port:9876}]},[first],[]));
 assert.doesNotThrow(()=>validateNodeTopology(node('other','newton','192.0.2.11'),[first],[]));
});
test('only explicit frozen foundation members can share a node, with consistent group endpoints',()=>{
 const first={...node('one','einstein'),foundationGroup:'legacy-1'},second={...node('two','newton'),foundationGroup:'legacy-1'};
 assert.doesNotThrow(()=>validateNodeTopology(second,[first],roster));
 assert.throws(()=>validateNodeTopology({...second,producer:'newbp'},[first],roster));
 assert.throws(()=>validateNodeTopology({...second,rpc:'http://192.0.2.10:9999'},[first],roster));
 assert.throws(()=>validateNodeTopology({...second,foundationGroup:undefined},[first],roster));
 assert.throws(()=>validateNodeTopology({...second,network:'mainnet'},[],roster));
});
test('bulk bindings are atomic and whitelist persists independently of schedule changes',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'status-foundation-'));let store=await openStore(dir);
 try{store.setFoundationAccounts(roster);const first={...node('one','einstein'),foundationGroup:'legacy-1'},second={...node('two','newton'),foundationGroup:'legacy-1'};
 assert.throws(()=>store.saveMany([first,{...second,producer:'newbp'}]));assert.equal(store.configs().length,0);
 store.saveMany([first,second]);store.append('one',[{at:Date.now(),id:'rpc',status:'operational'}]);store.append('two',[{at:Date.now(),id:'rpc',status:'outage'}]);assert.equal(store.history('one')[0].status,'operational');assert.equal(store.history('two')[0].status,'outage');
 store.close();store=await openStore(dir);assert.equal(store.foundationAccounts().length,2);assert.equal(store.foundationEligible({...first,producer:'newbp'}),false);assert.equal(store.configs().length,2);
 }finally{store.close();await rm(dir,{recursive:true,force:true})}
});
test('operator-approved foundation binding still needs valid BP membership and correct target chain',async()=>{
 const bp={...node('one','einstein'),foundationGroup:'legacy-1'},policy={networks:{testnet:{chainId,rpc:'https://trusted.invalid'}}};let member=true,wrongTarget=false;
 const fetchImpl=async(url)=>({ok:true,json:async()=>url.pathname.endsWith('get_info')?{chain_id:wrongTarget&&url.hostname!=='trusted.invalid'?'wrong':chainId}:{rows:member?[{owner:'einstein',is_active:true}]:[]}});
 assert.equal((await verifyAdmission(bp,policy,Date.now(),fetchImpl)).verified,false);
 assert.equal((await verifyAdmission(bp,policy,Date.now(),fetchImpl,{foundationApproved:true})).verified,true);
 member=false;assert.equal((await verifyAdmission(bp,policy,Date.now(),fetchImpl,{foundationApproved:true})).verified,false);
 member=true;wrongTarget=true;assert.equal((await verifyAdmission(bp,policy,Date.now(),fetchImpl,{foundationApproved:true})).verified,false);
});
test('shared probe cache coalesces concurrent checks and refreshes after expiry',async()=>{
 let time=0,calls=0;const cache=createProbeCache({now:()=>time,ttl:25});const probe=async()=>{calls++;return {status:'operational'}};
 const [a,b]=await Promise.all([cache('same-node',probe),cache('same-node',probe)]);assert.equal(calls,1);assert.deepEqual(a,b);
 time=26;await cache('same-node',probe);assert.equal(calls,2);await cache('different-chain',probe);assert.equal(calls,3);
});
