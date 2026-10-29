import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {openStore} from './store.mjs';
import {validateBP,startAdmin} from './admin.mjs';
import http from 'node:http';
test('SQLite persists config and samples across restart and separates BPs',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'status-db-'));let store;
 try{store=await openStore(directory);store.seed([{id:'bp-a',network:'testnet',rpc:'http://node-a',incidents:[{title:'test'}]},{id:'bp-b',network:'mainnet'}]);const at=Date.now();store.append('bp-a',[{at,id:'rpc',status:'outage',latency_ms:7}]);store.append('bp-b',[{at,id:'rpc',status:'operational',latency_ms:5}]);store.close();store=await openStore(directory);assert.equal(store.configs().length,2);assert.equal(store.history('bp-a')[0].status,'outage');assert.equal(store.history('bp-b')[0].status,'operational');store.seed([{id:'bp-a',rpc:'http://different'}]);assert.equal(store.configs()[0].rpc,'http://node-a');store.save({id:'bp-a',rpc:'http://new'});assert.equal(store.history('bp-a').length,0);assert.equal(store.history('bp-b').length,1)}finally{store?.close();await rm(directory,{recursive:true,force:true})}
});
test('admin input validates ports, accounts, network and URLs',()=>{
 const bp={id:'test-bp',producer:'einstein',network:'testnet',chainId:'a'.repeat(64),rpc:'http://127.0.0.1:8888',p2pHost:'127.0.0.1',p2pPort:'9876'};
 assert.equal(validateBP(bp).services[1].port,9876);assert.equal(validateBP(bp).rpcScope,'reference');
 for(const change of [{p2pPort:65536},{producer:'BAD ACCOUNT'},{rpc:'file:///etc/passwd'},{rpc:'http://user:secret@host'},{chainId:'short'},{p2pHost:'not-an-ip'}])assert.throws(()=>validateBP({...bp,...change}));
});
test('local admin rejects external origins and persists valid additions',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'status-admin-'));const store=await openStore(directory);const portProbe=http.createServer();await new Promise(r=>portProbe.listen(0,'127.0.0.1',r));const port=portProbe.address().port;await new Promise(r=>portProbe.close(r));process.env.STATUS_ADMIN_PORT=String(port);let server;
 try{let installed;server=await startAdmin({root:'.',store,config:{title:'Test'},install:async bp=>{installed=bp.id}});const base='http://127.0.0.1:'+port;const body=JSON.stringify({id:'test-bp',producer:'einstein',network:'testnet',chainId:'a'.repeat(64),rpc:'http://127.0.0.1:8888'});const post=origin=>fetch(base+'/api/bps',{method:'POST',headers:{'content-type':'application/json',origin},body});assert.equal((await post('http://evil.invalid')).status,403);assert.equal((await post(base)).status,201);assert.equal(installed,'test-bp');assert.equal(store.configs()[0].producer,'einstein');assert.equal((await post(base)).status,409)}finally{if(server)await new Promise(r=>server.close(r));store.close();delete process.env.STATUS_ADMIN_PORT;await rm(directory,{recursive:true,force:true})}
});

test('admin bulk foundation binding is whitelist-gated and atomic',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'status-admin-bulk-'));const store=await openStore(directory);const chainId='a'.repeat(64);
 store.setFoundationAccounts(['einstein','newton'].map(producer=>({producer,network:'testnet',chainId})));
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));process.env.STATUS_ADMIN_PORT=String(port);let server;
 try{server=await startAdmin({root:'.',store,config:{title:'Test'},install:async()=>{}});const base='http://127.0.0.1:'+port;
  const post=body=>fetch(base+'/api/bps',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify(body)});
  const input={id:'legacy-one',producer:'einstein',network:'testnet',chainId,rpc:'http://192.0.2.10:8888',p2pHost:'192.0.2.10',p2pPort:9876,rpcScope:'bp',foundationGroup:'legacy-1',foundationAccounts:'newton'};
  const response=await post(input);assert.equal(response.status,201);assert.equal((await response.json()).ids.length,2);assert.equal(store.configs().length,2);
  const invalid=await post({...input,id:'bad-legacy',producer:'sagan',foundationAccounts:'newbp'});assert.equal(invalid.status,400);assert.equal(store.configs().length,2);
  const third=await post({...input,id:'third',producer:'newbp',foundationGroup:'',foundationAccounts:'',rpc:'http://192.0.2.10:9999'});assert.equal(third.status,400);
  const view=await (await fetch(base+'/api/configs')).json();assert.equal(view.foundation_accounts.length,2);assert.equal(view.bps[0].foundationGroup,'legacy-1');
 }finally{if(server)await new Promise(r=>server.close(r));store.close();delete process.env.STATUS_ADMIN_PORT;await rm(directory,{recursive:true,force:true})}
});
