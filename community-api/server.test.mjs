import assert from 'node:assert/strict';
import test from 'node:test';
import {createCommunityServer} from './server.mjs';

function response(body,status=200){return{ok:status>=200&&status<300,status,json:async()=>body}}
const repository={id:'R_1',discussionCategories:{nodes:[{id:'C_1',name:'General'}]},discussions:{nodes:[]}};
const options={botToken:'bot-token',dataFile:'',allowedOrigins:['https://daogov.flon.network'],fetchImpl:async(url,request)=>{const input=JSON.parse(request.body||'{}');if(input.query?.includes('createDiscussion'))return response({data:{createDiscussion:{discussion:{id:'D_1',number:1,title:input.variables.title,bodyText:input.variables.body,url:'https://github.com/fullon-labs/flon.daogov/discussions/1',comments:{totalCount:0},author:{login:'fullon-dao-bot'}}}}});if(input.query?.includes('addDiscussionComment'))return response({data:{addDiscussionComment:{comment:{id:'DC_1',bodyText:input.variables.body,createdAt:'2026-10-27T00:00:00Z',author:{login:'fullon-dao-bot'}}}}});if(input.query?.includes('discussion(number'))return response({data:{repository:{discussion:{id:'D_1',number:1,title:'Example topic',bodyText:'Example body',createdAt:'2026-10-27T00:00:00Z',upvoteCount:2,reactionGroups:[],author:{login:'fullon-dao-bot'},comments:{nodes:[]}}}}});return response({data:{repository}})}};
async function withServer(run){const server=createCommunityServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{await run(`http://127.0.0.1:${server.address().port}`)}finally{await new Promise(resolve=>server.close(resolve))}}

test('bot mode is ready without per-user GitHub authentication',()=>withServer(async base=>{
  const health=await fetch(`${base}/community-api/healthz`).then(response=>response.json());assert.deepEqual(health,{ok:true,mode:'dao-bot'});
  const session=await fetch(`${base}/community-api/v1/session`).then(response=>response.json());assert.deepEqual(session,{authenticated:true,mode:'dao-bot'});
  const discussions=await fetch(`${base}/community-api/v1/discussions`).then(response=>response.json());assert.deepEqual(discussions,{items:[],mode:'dao-bot'});
}));

test('DAO bot publishes a discussion with the connected FLON account attribution',()=>withServer(async base=>{
  const response=await fetch(`${base}/community-api/v1/discussions`,{method:'POST',headers:{origin:'https://daogov.flon.network','content-type':'application/json'},body:JSON.stringify({actor:'hellotoworld',title:'Example topic',body:'A sufficiently long discussion body.'})});assert.equal(response.status,201);const item=await response.json();assert.match(item.bodyText,/FLON account `hellotoworld`/);
}));

test('discussion creation rejects missing or invalid FLON account attribution',()=>withServer(async base=>{
  const response=await fetch(`${base}/community-api/v1/discussions`,{method:'POST',headers:{origin:'https://daogov.flon.network','content-type':'application/json'},body:JSON.stringify({title:'Example',body:'A sufficiently long discussion body.'})});assert.equal(response.status,422);
}));

test('short but complete CJK discussion content is accepted',()=>withServer(async base=>{
  const response=await fetch(`${base}/community-api/v1/discussions`,{method:'POST',headers:{origin:'https://daogov.flon.network','content-type':'application/json'},body:JSON.stringify({actor:'hellotoworld',title:'降低单块收益',body:'增发太大了'})});assert.equal(response.status,201);
}));

test('discussion detail and replies are available through the DAO API',()=>withServer(async base=>{
  const detail=await fetch(`${base}/community-api/v1/discussions/1`).then(response=>response.json());assert.equal(detail.title,'Example topic');assert.deepEqual(detail.comments,[]);
  const response=await fetch(`${base}/community-api/v1/discussions/1/comments`,{method:'POST',headers:{origin:'https://daogov.flon.network','content-type':'application/json'},body:JSON.stringify({actor:'hellotoworld',body:'支持进一步讨论'})});assert.equal(response.status,201);const comment=await response.json();assert.match(comment.bodyText,/FLON account `hellotoworld`/);
}));

test('wallet community vote is mutually exclusive and removable',()=>withServer(async base=>{
  const headers={origin:'https://daogov.flon.network','content-type':'application/json'};
  let response=await fetch(`${base}/community-api/v1/discussions/1/vote`,{method:'PUT',headers,body:JSON.stringify({network:'testnet',actor:'hellotoworld',vote:'up'})});
  assert.equal(response.status,200);assert.deepEqual((await response.json()).community.votes,{up:1,down:0});
  response=await fetch(`${base}/community-api/v1/discussions/1/vote`,{method:'PUT',headers,body:JSON.stringify({network:'testnet',actor:'hellotoworld',vote:'down'})});
  const changed=(await response.json()).community;assert.deepEqual(changed.votes,{up:0,down:1});assert.equal(changed.viewer.vote,'down');
  response=await fetch(`${base}/community-api/v1/discussions/1/vote`,{method:'PUT',headers,body:JSON.stringify({network:'testnet',actor:'hellotoworld',vote:null})});
  assert.deepEqual((await response.json()).community.votes,{up:0,down:0});
}));

test('wallet emoji reactions toggle independently on comments',()=>withServer(async base=>{
  const headers={origin:'https://daogov.flon.network','content-type':'application/json'},url=`${base}/community-api/v1/discussions/1/comments/DC_1/reactions/ROCKET`;
  let response=await fetch(url,{method:'PUT',headers,body:JSON.stringify({network:'testnet',actor:'hellotoworld',active:true})});
  let community=(await response.json()).community;assert.equal(community.reactions.ROCKET,1);assert.deepEqual(community.viewer.reactions,['ROCKET']);
  response=await fetch(url,{method:'PUT',headers,body:JSON.stringify({network:'testnet',actor:'hellotoworld',active:false})});
  community=(await response.json()).community;assert.equal(community.reactions.ROCKET,undefined);assert.deepEqual(community.viewer.reactions,[]);
}));
