import test from 'node:test';
import assert from 'node:assert/strict';
import {readTablePages} from './table-pages.js';

test('loads new producers beyond the first table page',async()=>{
  const calls=[];
  const result=await readTablePages(async(path,params)=>{
    calls.push(params);
    return params.lower_bound?{rows:[{owner:'newbp'}],more:false}:{rows:[{owner:'oldbp'}],more:true,next_key:'newbp'};
  },{table:'producers',limit:200});
  assert.deepEqual(result.rows.map(row=>row.owner),['oldbp','newbp']);
  assert.equal(calls[1].lower_bound,'newbp');
  assert.equal(calls[1].table,'producers');
});

test('rejects repeated pagination cursors instead of looping forever',async()=>{
  await assert.rejects(readTablePages(async()=>({rows:[],more:true,next_key:'same'}),{}),/pagination cursor/);
});
