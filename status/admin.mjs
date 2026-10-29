import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {targetKey} from './admission.mjs';
export function validateBP(body){
 if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(body.id||''))throw Error('ID 需为唯一的小写字母、数字或连字符');
 if(!/^[a-z1-5.]{1,12}$/.test(body.producer||''))throw Error('请输入合法 BP account');
 if(!['mainnet','testnet'].includes(body.network))throw Error('请选择主网或测试网');
 if(!/^[a-f0-9]{64}$/.test(body.chainId||''))throw Error('需要完整 Chain ID');
 const url=value=>{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('RPC 需为无凭据的 HTTP(S) 地址');return u.href.replace(/\/$/,'')};
 const rpc=url(body.rpc),referenceRpc=body.referenceRpc?url(body.referenceRpc):'';
 const services=[{id:'rpc',name:'Chain RPC',type:'rpc',url:rpc}];
 if(body.p2pHost||body.p2pPort){if(!net.isIP(body.p2pHost)||!Number.isInteger(Number(body.p2pPort))||Number(body.p2pPort)<1||Number(body.p2pPort)>65535)throw Error('P2P 需输入合法 IP 与 1–65535 端口');services.push({id:'p2p',name:'P2P Network',type:'tcp',host:body.p2pHost,port:Number(body.p2pPort)})}
 return {id:body.id,label:String(body.label||body.producer).slice(0,100),producer:body.producer,network:body.network,chainId:body.chainId,rpc,referenceRpc,services,rpcScope:body.rpcScope==='bp'?'bp':'reference',intervalSeconds:30};
}
export async function startAdmin({root,store,config,install}){
 if(process.env.STATUS_ADMIN_PORT==='off')return;
 const port=Number(process.env.STATUS_ADMIN_PORT)||8788;
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  const json=(x,code=200)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(x))};
  const host=req.headers.host,allowed=['127.0.0.1:'+port,'localhost:'+port];
  if(!allowed.includes(host))return json({error:'Forbidden host'},403);
  if(req.method==='GET'&&req.url==='/api/configs')return json({bps:store.configs().map(bp=>({...bp,target_key:targetKey(bp),admission:store.admission(bp)}))});
  if(req.method==='POST'&&req.url==='/api/bps'){
   if(req.headers.origin!=='http://'+host||req.headers['content-type']!=='application/json')return json({error:'Forbidden origin'},403);
   try{
    let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>16384)return json({error:'Payload too large'},413)}
    const bp=validateBP(JSON.parse(body));
    if(store.configs().some(c=>c.id===bp.id))return json({error:'ID 已存在；请使用新 ID，避免混入不同节点的历史'},409);
    const normalized={...bp,title:config.title};store.save(normalized);if(store.admission(normalized).expired){store.purge(normalized);return json({error:'该目标的临时观察已满 30 分钟，不能通过新 ID 延期'},410)}await install(normalized);return json({id:bp.id,admission:store.admission(normalized)},201);
   }catch(error){return json({error:error.message?.startsWith('SQL')?'保存失败':error.message},400)}
  }
  if(req.method!=='GET')return json({error:'Method not allowed'},405);
  const files={'/':'index.html','/admin.js':'admin.js','/style.css':'style.css'};
  if(!files[req.url])return json({error:'Not found'},404);
  res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(await readFile(path.join(root,'admin',files[req.url])));
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
 console.log('BP configuration (local only): http://127.0.0.1:'+port);
 return server;
}
