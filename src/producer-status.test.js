import {test} from 'node:test';
import assert from 'node:assert/strict';
import {producerStatusUrl,loadProducerEpochs,renderProducerPerformance} from './producer-status.js';
test('status deep links bind exact network and BP',()=>{
 for(const network of ['mainnet','testnet']){const url=new URL(producerStatusUrl(network,'einstein'));assert.equal(url.origin,'https://status.flon.network');assert.equal(url.searchParams.get('network'),network);assert.equal(url.searchParams.get('bp'),network+'-einstein')}
 assert.equal(producerStatusUrl('unknown','einstein'),null);assert.equal(producerStatusUrl('testnet','<invalid>'),null);
});
test('producer history uses the exact BP and epoch, with idle slots excluded',async()=>{
 const request=async(_path,b)=>{
  if(b.table==='epochstats')return {rows:[{epoch_id:818,closed:1},{epoch_id:819,closed:0}]};
  assert.equal(b.lower_bound,'einstein');assert.equal(b.upper_bound,'einstein');assert.equal(b.limit,1);
  if(b.scope==='819')return {rows:[{producer:'einstein',epoch_id:819,expected_blocks:12,produced_blocks:12,missed_blocks:0,idle_skipped_blocks:252}]};
  return {rows:[{producer:'einstein',epoch_id:818,expected_blocks:10,produced_blocks:8,missed_blocks:2,idle_skipped_blocks:90}]};
 };
 const data=await loadProducerEpochs(request,'einstein');assert.equal(data.current.epochId,819);assert.equal(data.current.stats.rate,100);assert.equal(data.current.stats.idleSkipped,'252');assert.equal(data.history[1].stats.rate,80);
 const html=renderProducerPerformance(data,{url:producerStatusUrl('testnet','einstein')});assert.match(html,/100\.00%/);assert.match(html,/Missed 0 · Idle skipped 252/);assert.equal((html.match(/<i class=/g)||[]).length,30);assert.ok(html.indexOf('title="Epoch 818')<html.indexOf('title="Epoch 819'));
});
test('missing, failed, wrong-owner or inconsistent rows do not fabricate rates',async()=>{
 for(const row of [null,{producer:'other'}, {producer:'einstein',expected_blocks:12,produced_blocks:12,missed_blocks:1},{producer:'einstein',expected_blocks:0,produced_blocks:0,missed_blocks:0},{producer:'einstein',epoch_id:800,expected_blocks:12,produced_blocks:12,missed_blocks:0}]){
  const d=await loadProducerEpochs(async(_p,b)=>b.table==='epochstats'?{rows:[{epoch_id:819}]}:{rows:row?[row]:[]},'einstein');assert.equal(d.current.stats?.rate??null,null);assert.ok(!renderProducerPerformance(d).includes('100.00%'));
 }
 const d=await loadProducerEpochs(async(_p,b)=>{if(b.table==='epochstats')return {rows:[{epoch_id:819}]};throw Error('timeout')},'einstein');assert.equal(d.current.stats,null);
});
