import assert from 'node:assert/strict';
import test from 'node:test';
import {createCommunityServer} from './server.mjs';

const options={clientId:'id',clientSecret:'secret',sessionSecret:'session-secret',cookieDomain:'',allowedOrigins:['https://daogov.flon.network'],fetchImpl:async()=>{throw new Error('unexpected fetch')}};
async function withServer(run){const server=createCommunityServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{await run(`http://127.0.0.1:${server.address().port}`)}finally{await new Promise(resolve=>server.close(resolve))}}

test('health and anonymous session do not expose credentials',()=>withServer(async base=>{
  const health=await fetch(`${base}/community-api/healthz`).then(r=>r.json());assert.deepEqual(health,{ok:true});
  const session=await fetch(`${base}/community-api/v1/session`).then(r=>r.json());assert.deepEqual(session,{authenticated:false});
  const discussions=await fetch(`${base}/community-api/v1/discussions`).then(r=>r.json());assert.deepEqual(discussions,{items:[],authenticated:false});
}));

test('OAuth start only accepts configured return origins',()=>withServer(async base=>{
  const response=await fetch(`${base}/community-api/v1/auth/github?return_to=https%3A%2F%2Fevil.example%2Fpwn`,{redirect:'manual'});const target=new URL(response.headers.get('location'));assert.equal(target.origin,'https://github.com');assert.equal(target.pathname,'/login/oauth/authorize');assert.equal(target.searchParams.get('client_id'),'id');assert.ok(target.searchParams.get('state'));
}));

test('discussion creation requires an authenticated session',()=>withServer(async base=>{
  const response=await fetch(`${base}/community-api/v1/discussions`,{method:'POST',headers:{origin:'https://daogov.flon.network','content-type':'application/json'},body:JSON.stringify({title:'Example',body:'A sufficiently long discussion body.'})});assert.equal(response.status,401);
}));
