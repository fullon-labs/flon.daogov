import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createDiscussionsClient} from './discussions.js';

test('lists discussions through the unified API with cookie credentials',async()=>{
  let request;
  const client=createDiscussionsClient({baseUrl:'https://community.example/api/',network:'testnet',fetchImpl:async(url,options)=>{request={url,options};return{ok:true,json:async()=>({items:[{id:'D_1'}]})}}});
  assert.deepEqual(await client.list(),[{id:'D_1'}]);
  assert.equal(request.url,'https://community.example/api/v1/discussions?network=testnet');
  assert.equal(request.options.credentials,'include');
});

test('does not call the network when the API is not configured',async()=>{
  const client=createDiscussionsClient({baseUrl:'',fetchImpl:async()=>assert.fail('unexpected request')});
  assert.equal(client.configured,false);
  await assert.rejects(client.list(),/DISCUSSIONS_API_NOT_CONFIGURED/);
});

test('governance view provides desktop columns and mobile discussion/proposal tabs',async()=>{
  const [html,css]=await Promise.all([readFile(new URL('../index.html',import.meta.url),'utf8'),readFile(new URL('./styles.css',import.meta.url),'utf8')]);
  assert.match(html,/data-governance-panel="discussions"[\s\S]*data-governance-panel="proposals"/);
  assert.match(html,/data-governance-tab="discussions"[\s\S]*data-governance-tab="proposals"/);
  assert.match(css,/@media\(min-width:900px\)\{\.governance-mobile-tabs\{display:none\}/);
  assert.match(css,/@media\(max-width:899px\)\{\.governance-column\.is-mobile-hidden\{display:none\}/);
});
