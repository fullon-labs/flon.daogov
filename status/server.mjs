import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createCollector} from './collector.mjs';
import {normalizeConfig} from './registry.mjs';
import {openStore} from './store.mjs';
import {startAdmin} from './admin.mjs';
import {verifyAdmission} from './admission.mjs';
import {rm} from 'node:fs/promises';
const root=path.dirname(fileURLToPath(import.meta.url));
// An explicit configuration error must stop startup, never silently select another network.
const raw=JSON.parse(await readFile(process.env.STATUS_CONFIG||path.join(root,'config.json'),'utf8').catch(error=>{
 if(error.code==='ENOENT'&&!process.env.STATUS_CONFIG)return readFile(path.join(root,'config.example.json'),'utf8');
 throw error;
}));
const config=normalizeConfig(raw);
const data=process.env.STATUS_DATA||path.join(root,'data');
const store=await openStore(data);store.seed(config.bps);store.registerExisting();
const collectors=new Map(),timers=new Map();
const activeConfigs=new Map();
let policy={};
async function readPolicy(){
 if(process.env.STATUS_ADMISSION_POLICY)policy=JSON.parse(await readFile(process.env.STATUS_ADMISSION_POLICY,'utf8'));
 else policy={};
}
await readPolicy();
async function removeExpired(bp){
 if(!store.admission(bp).expired)return false;
 clearInterval(timers.get(bp.id));timers.delete(bp.id);collectors.delete(bp.id);activeConfigs.delete(bp.id);
 store.purge(bp);
 await rm(path.join(data,bp.id),{recursive:true,force:true});
 return true;
}
async function install(bp){
 if(await removeExpired(bp))return;
 store.verify(bp,await verifyAdmission(bp,policy));
 const collector=await createCollector(bp,store);
 activeConfigs.set(bp.id,bp);collectors.set(bp.id,collector);
 if(timers.has(bp.id))clearInterval(timers.get(bp.id));
 const tick=async()=>{
  if(await removeExpired(bp))return;
  await collector.refresh();await removeExpired(bp);
 };
 timers.set(bp.id,setInterval(()=>tick().catch(()=>{}),collector.interval*1000).unref());
 await tick();
}
await Promise.all(store.configs().map(install));
// Continuous eligibility checks also cover delisted BPs and expired attestations.
let checking=false;
async function recheck(){
 if(checking)return;checking=true;
 try{
  try{await readPolicy()}catch{policy={}}
  await Promise.all([...activeConfigs.values()].map(async bp=>{if(await removeExpired(bp))return;store.verify(bp,await verifyAdmission(bp,policy));await removeExpired(bp)}));
 }finally{checking=false}
}
setInterval(()=>recheck().catch(()=>{}),30000).unref();
setInterval(()=>{for(const bp of activeConfigs.values())removeExpired(bp).catch(()=>{})},1000).unref();
await startAdmin({root,store,config,install});
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
 const json=(value,code=200)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value))};
 if(url.pathname==='/api/bps.json')return json({title:config.title,public_origin:config.publicOrigin,default_bp:collectors.has(config.defaultBp)?config.defaultBp:collectors.keys().next().value,bps:[...collectors.values()].filter(c=>!c.status().admission?.expired).map(c=>{const s=c.status();return {id:s.id,label:s.label,network:s.network,producer:s.producer,role:s.role,status:s.stale?'unknown':s.status,updated_at:s.updated_at,stale:s.stale,admission:s.admission}})});
 if(url.pathname==='/api/status.json'){
  const id=url.searchParams.get('bp')||config.defaultBp;
  const collector=collectors.get(id);
  if(collector?.status().admission?.expired)return json({error:'observation_expired'},410);
  return collector?json(collector.status()):json({error:'unknown_bp'},404);
 }
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
 if(!files[url.pathname]){res.writeHead(404);return res.end('Not found');}
 res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html; charset=utf-8');
 res.end(await readFile(path.join(root,'public',files[url.pathname])));
}).listen(Number(process.env.PORT)||8787,process.env.HOST||'127.0.0.1',()=>console.log('FULLON Status: http://127.0.0.1:'+(process.env.PORT||8787)));
