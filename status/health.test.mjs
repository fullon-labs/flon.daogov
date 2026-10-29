import {test} from 'node:test';
import assert from 'node:assert/strict';
import {production,aggregate,summary} from './health.mjs';
test('elastic idle slots do not lower production rate',()=>{const r=production({expected_blocks:18,produced_blocks:18,missed_blocks:0,idle_skipped_blocks:330,status:1});assert.equal(r.production_rate,100);assert.equal(r.idle_skipped_blocks,330)});
test('zero expected is not an outage or fabricated 100 percent',()=>assert.equal(production({expected_blocks:0,produced_blocks:0,missed_blocks:0}).production_rate,null));
test('inconsistent chain accounting cannot yield a rate',()=>{const r=production({expected_blocks:18,produced_blocks:17,missed_blocks:0});assert.equal(r.consistent,false);assert.equal(r.production_rate,null)});
test('missing metrics remain unavailable',()=>assert.equal(production({produced_blocks:2}),null));
test('unknown service never becomes operational',()=>{assert.equal(aggregate(['operational','unknown']),'unknown');assert.equal(aggregate(['outage','unknown']),'outage')});
test('unknown and missing time are not silently counted up',()=>{const now=100000000;const s=summary([{at:now-10,status:'operational',latency_ms:10},{at:now-20,status:'outage',latency_ms:30},{at:now-30,status:'unknown'}],now,1,30);assert.equal(s.uptime,50);assert.equal(s.samples,2);assert.ok(s.coverage<1);assert.equal(s.p95_ms,30);assert.equal(summary([],now,1,30).uptime,null)});

import {normalizeConfig} from './registry.mjs';
test('registry preserves legacy configs and rejects ambiguous or unsafe IDs',()=>{
 assert.equal(normalizeConfig({producer:'bp1111111111'}).defaultBp,'default');
 assert.throws(()=>normalizeConfig({bps:[{id:'same'},{id:'same'}]}));
 assert.throws(()=>normalizeConfig({bps:[{id:'../private'}]}));
 assert.throws(()=>normalizeConfig({bps:[{id:'bp1'}],defaultBp:'absent'}));
});
