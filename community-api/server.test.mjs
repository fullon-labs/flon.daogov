import assert from 'node:assert/strict';
import test from 'node:test';
import {createCommunityServer} from './server.mjs';

function response(body,status=200){return{ok:status>=200&&status<300,status,json:async()=>body}}
const repository={id:'R_1',discussionCategories:{nodes:[{id:'C_1',name:'General'}]},discussions:{nodes:[]}};
const options={botToken:'bot-token',allowedOrigins:['https://daogov.flon.network'],fetchImpl:async(url,request)=>{const input=JSON.parse(request.body||'{}');if(input.query?.includes('createDiscussion'))return response({data:{createDiscussion:{discussion:{id:'D_1',number:1,title:input.variables.title,bodyText:input.variables.body,url:'https://github.com/fullon-labs/flon.daogov/discussions/1',comments:{totalCount:0},author:{login:'fullon-dao-bot'}}}}});return response({data:{repository}})}};
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
