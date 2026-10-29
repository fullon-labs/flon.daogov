import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
test('multi-BP collectors isolate networks, histories, API selection and private targets',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'bp-status-'));
 const fixture=http.createServer(async(req,res)=>{let body='';for await(const part of req)body+=part;const b=JSON.parse(body||'{}');let out={};
 if(req.url.endsWith('get_info'))out={chain_id:'test-chain',head_block_num:100,head_block_time:new Date().toISOString().replace('Z',''),last_irreversible_block_num:95,server_version_string:'0.9.0'};
 else if(req.url.endsWith('get_producer_schedule'))out={active:{version:2,producers:[{producer_name:'bp1111111111'}]}};
 else {const tables={epochstats:[{epoch_id:818,closed:false}],bpstats:[{producer:'bp1111111111',expected_blocks:18,produced_blocks:18,missed_blocks:0,idle_skipped_blocks:330,status:1}],producers:[{owner:'bp1111111111',is_active:true,total_votes:'100'}],bpstakes:[],gasnodestats:[]};out={rows:tables[b.table]||[],more:false};}res.setHeader('content-type','application/json');res.end(JSON.stringify(out));});
 await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
 const rpc='http://127.0.0.1:'+fixture.address().port;
 const portServer=netServer();await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
 await writeFile(path.join(temp,'config.json'),JSON.stringify({defaultBp:'active-test',bps:[{id:'active-test',label:'Active BP',rpc,referenceRpc:rpc,chainId:'test-chain',producer:'bp1111111111',network:'testnet',services:[{id:'rpc',name:'RPC',type:'rpc',url:rpc}]},{id:'standby-main',label:'Standby BP',rpc,referenceRpc:rpc,chainId:'different-chain',producer:'bp2222222222',network:'mainnet',services:[]}]}));
 const child=spawn(process.execPath,[new URL('./server.mjs',import.meta.url).pathname],{env:{...process.env,PORT:String(port),STATUS_ADMIN_PORT:'off',STATUS_CONFIG:path.join(temp,'config.json'),STATUS_DATA:path.join(temp,'data')},stdio:['ignore','pipe','pipe']});
 try{await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),10000);t.unref()})]);const r=await fetch('http://127.0.0.1:'+port+'/api/status.json');const text=await r.text();const d=JSON.parse(text);assert.equal(d.status,'operational');assert.equal(d.role,'active');assert.equal(d.production_rate,100);assert.equal(d.idle_skipped_blocks,330);assert.equal(d.sync_lag_blocks,0);assert.equal(d.stale,false);assert.ok(!text.includes(rpc));assert.ok(d.uptime['30'].coverage<1);assert.equal((await fetch('http://127.0.0.1:'+port+'/config.json')).status,404);
 const base='http://127.0.0.1:'+port;
 const list=await (await fetch(base+'/api/bps.json')).json();assert.equal(list.bps.length,2);assert.equal(list.default_bp,'active-test');assert.ok(list.bps.some(b=>b.producer==='bp1111111111'));assert.ok(Array.isArray(list.discovery));assert.ok(!JSON.stringify(list).includes(rpc));
 const standby=await (await fetch(base+'/api/status.json?bp=standby-main')).json();assert.equal(standby.id,'standby-main');assert.equal(standby.role,'standby');assert.equal(standby.network,'mainnet');assert.equal(standby.chain_verified,false);assert.equal(standby.status,'unknown');assert.equal(standby.production_rate,undefined);assert.equal(standby.services.length,0);
 assert.equal((await fetch(base+'/api/status.json?bp=missing')).status,404);
 assert.equal((await fetch(base+'/api/status.json?bp=../../config')).status,404);
 const {readdir}=await import('node:fs/promises');assert.ok((await readdir(path.join(temp,'data'))).includes('status.sqlite'));
 }finally{child.kill();await once(child,'exit');await new Promise(resolve=>fixture.close(resolve));await rm(temp,{recursive:true,force:true})}
});
function netServer(){return http.createServer()}

test('expired trial is removed before startup collection and cannot be returned publicly',async()=>{
 const {openStore}=await import('./store.mjs');const {DatabaseSync}=await import('node:sqlite');
 const temp=await mkdtemp(path.join(os.tmpdir(),'bp-expired-'));const data=path.join(temp,'data');
 const bp={id:'expired',producer:'einstein',network:'testnet',chainId:'a'.repeat(64),rpc:'http://127.0.0.1:1'};
 const store=await openStore(data);store.save(bp);store.append(bp.id,[{at:Date.now(),id:'rpc',status:'operational'}]);store.close();
 const db=new DatabaseSync(path.join(data,'status.sqlite'));db.prepare('UPDATE targets SET deadline=?').run(Date.now()-1);db.close();
 await writeFile(path.join(temp,'config.json'),JSON.stringify({bps:[bp]}));
 const probe=netServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,[new URL('./server.mjs',import.meta.url).pathname],{env:{...process.env,PORT:String(port),STATUS_ADMIN_PORT:'off',STATUS_CONFIG:path.join(temp,'config.json'),STATUS_DATA:data},stdio:['ignore','pipe','pipe']});
 try{await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),10000);t.unref()})]);const base='http://127.0.0.1:'+port;assert.equal((await fetch(base+'/api/status.json?bp=expired')).status,404);assert.equal((await (await fetch(base+'/api/bps.json')).json()).bps.length,0);
 const check=await openStore(data);assert.equal(check.configs().length,0);assert.equal(check.history('expired').length,0);check.close();
 }finally{child.kill();await once(child,'exit');await rm(temp,{recursive:true,force:true})}
});
