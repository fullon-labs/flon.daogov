import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDiscovery,discoverySources,mergeDirectory} from './discovery.mjs';
const source={network:'testnet',chainId:'test-chain',rpc:'https://observer.invalid'};
test('chain discovery paginates all registered BPs, uses schedule roles and shares statistics',async()=>{
 let fail=false,failStats=false,calls=0;
 const mock=async(url,options)=>{calls++;if(fail)throw Error('unavailable');const b=JSON.parse(options.body);let d;
  if(url.pathname.endsWith('get_info'))d={chain_id:'test-chain',head_block_num:100,last_irreversible_block_num:95,head_block_time:'2026-10-29T06:00:00'};
  else if(url.pathname.endsWith('get_producer_schedule'))d={active:{version:7,producers:[{producer_name:'activebp'}]}};
  else if(b.table==='producers')d=b.lower_bound?{rows:[{owner:'standbybp',is_active:1,total_votes:'999'},{owner:'inactive',is_active:0,total_votes:'1000'}],more:false}:{rows:[{owner:'activebp',is_active:true,total_votes:'1'}],more:true,next_key:'standbybp'};
  else if(b.table==='epochstats')d={rows:[{epoch_id:819,closed:false}],more:false};
  else if(b.table==='bpstats'&&failStats)throw Error('stats unavailable');
  else if(b.table==='bpstats')d={rows:[{producer:'activebp',expected_blocks:4,produced_blocks:4,missed_blocks:0,idle_skipped_blocks:80}],more:false};
  else d={rows:[],more:false};return {ok:true,json:async()=>d};
 };
 const discovery=createDiscovery([source],{fetchImpl:mock,now:()=>Date.parse('2026-10-29T06:00:05Z')});await discovery.refresh();
 const entries=discovery.snapshots();assert.equal(entries.length,2);const active=entries.find(b=>b.producer==='activebp'),standby=entries.find(b=>b.producer==='standbybp');
 assert.equal(active.role,'active');assert.equal(standby.role,'standby');assert.equal(active.production_rate,100);assert.equal(active.idle_skipped_blocks,80);assert.equal(standby.production_rate,undefined);
 assert.equal(active.admission.mode,'catalog');assert.equal(active.services.length,0);assert.equal(active.status,'unknown');assert.equal(active.rpc_scope,'reference');assert.ok(!JSON.stringify(entries).includes(source.rpc));
 const count=calls;discovery.snapshots();assert.equal(calls,count);
 assert.equal(active.epoch_history[0].data_status,'observed');assert.equal(standby.epoch_history[0].data_status,'no_record');
 failStats=true;await discovery.refresh();assert.equal(discovery.snapshots()[0].epoch_history[0].data_status,'query_failed');failStats=false;
 const merged=mergeDirectory(entries,[{...active,id:'custom-node',source:'node_monitor'}]);assert.equal(merged.length,2);assert.ok(merged.some(b=>b.id==='custom-node'));
 fail=true;await discovery.refresh();assert.equal(discovery.snapshots().length,2);assert.equal(discovery.snapshots()[0].stale,true);
});
test('wrong chain yields no invented BP list',async()=>{
 const d=createDiscovery([source],{fetchImpl:async()=>({ok:true,json:async()=>({chain_id:'wrong'})})});await d.refresh();assert.equal(d.snapshots().length,0);assert.equal(d.health()[0].status,'unknown');
});
test('legacy configured networks are discovered once and explicit discovery works without monitors',()=>{
 assert.equal(discoverySources({bps:[source,{...source,producer:'other'}]}).length,1);
 assert.equal(discoverySources({discovery:[source],bps:[]}).length,1);
});
