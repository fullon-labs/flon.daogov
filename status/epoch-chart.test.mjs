import {test} from 'node:test';
import assert from 'node:assert/strict';
import {epochChartPoint,renderEpochChart} from './public/epoch-chart.js';
import {epochPerformance} from './health.mjs';
test('chart preserves data reasons, uses actual epoch range and never fabricates padding',()=>{
 const rows=[epochPerformance({epoch_id:8},null),epochPerformance({epoch_id:9},{expected_blocks:0,produced_blocks:0,missed_blocks:0}),epochPerformance({epoch_id:10},null,{queryFailed:true}),epochPerformance({epoch_id:11},{expected_blocks:12,produced_blocks:12,missed_blocks:0,idle_skipped_blocks:252})];
 assert.deepEqual(rows.map(e=>epochChartPoint(e).state),['no_record','no_expected','query_failed','observed']);
 const html=renderEpochChart(rows);assert.match(html,/Epoch 8/);assert.match(html,/Epoch 11/);assert.match(html,/4 期记录/);
 assert.equal((html.match(/class="epoch-chart-bar /g)||[]).length,4);
 assert.match(html,/12 \/ 12 实出 \/ 应出/);assert.match(html,/Missed 0 · Idle skipped 252/);
 assert.match(html,/查询失败/);assert.match(html,/无应出块/);assert.match(html,/无统计记录/);
 assert.doesNotMatch(html,/Epoch 7/);assert.doesNotMatch(html,/未知 \/ 无应出块/);
});
test('zero percent remains observed misses, not missing data; invalid statistics never become no expected blocks',()=>{
 const missed=epochPerformance({epoch_id:1},{expected_blocks:5,produced_blocks:0,missed_blocks:5});
 assert.equal(epochChartPoint(missed).state,'observed');assert.equal(epochChartPoint(missed).rate,0);
 assert.equal(epochPerformance({epoch_id:2},{expected_blocks:null,produced_blocks:0,missed_blocks:0}).data_status,'invalid');
 const html=renderEpochChart([missed]);assert.match(html,/0\.00%/);assert.match(html,/0 \/ 5 实出 \/ 应出/);
});
