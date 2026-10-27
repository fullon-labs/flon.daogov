import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createDiscussionsClient} from './discussions.js';

test('lists discussions through the unified API with cookie credentials',async()=>{
  let request;
  const client=createDiscussionsClient({baseUrl:'https://community.example/api/',network:'testnet',fetchImpl:async(url,options)=>{request={url,options};return{ok:true,json:async()=>({items:[{id:'D_1'}]})}}});
  assert.deepEqual(await client.list(),[{id:'D_1'}]);
  assert.equal(request.url,'https://community.example/api/v1/discussions?network=testnet&actor=');
  assert.equal(request.options.credentials,'include');
});

test('writes wallet community votes and emoji through the unified API',async()=>{
  const requests=[];
  const client=createDiscussionsClient({baseUrl:'https://community.example/api',network:'testnet',fetchImpl:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({community:{}})}}});
  await client.vote(7,{actor:'hellotoworld',vote:'up'});
  await client.react(7,{actor:'hellotoworld',emoji:'ROCKET',active:true,commentId:'DC_1'});
  assert.equal(requests[0].url,'https://community.example/api/v1/discussions/7/vote');
  assert.deepEqual(JSON.parse(requests[0].options.body),{network:'testnet',actor:'hellotoworld',vote:'up'});
  assert.equal(requests[1].url,'https://community.example/api/v1/discussions/7/comments/DC_1/reactions/ROCKET');
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
  assert.match(html,/id="governance-discussions"[\s\S]*id="governance-proposals"/);
  assert.match(html,/id="governance-proposals"[\s\S]*data-action="create-proposal"/);
  assert.match(css,/\.governance-columns\{grid-template-columns:minmax\(0,2fr\) minmax\(0,3fr\)/);
  assert.match(css,/@media\(min-width:900px\)\{\.governance-mobile-tabs\{display:none\}/);
  assert.match(css,/@media\(max-width:899px\)\{\.governance-column\.is-mobile-hidden\{display:none\}/);
});
