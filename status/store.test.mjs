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
