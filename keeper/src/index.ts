import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {ChainClient} from './chain.js';
import {loadConfig} from './config.js';
import {acquireLock} from './lock.js';

const sleep=(ms:number,s:AbortSignal)=>new Promise<void>(r=>{if(s.aborted)return r();const t=setTimeout(r,ms);s.addEventListener('abort',()=>{clearTimeout(t);r();},{once:true});});
const log=(level:string,event:string,fields:Record<string,unknown>={})=>process.stdout.write(`${JSON.stringify({time:new Date().toISOString(),level,event,...fields})}\n`);

export async function runKeeper(config=loadConfig()):Promise<void>{
  const controller=new AbortController();
  const status:Record<string,unknown>={startedAt:new Date().toISOString(),mode:config.broadcast?'broadcast':'dry-run'};
  const release=await acquireLock(config.lockFile); const client=new ChainClient(config);
  const server=createServer((req,res)=>{const healthy=!status.lastError&&Boolean(status.lastSuccessAt);res.statusCode=req.url==='/healthz'&&!healthy?503:200;res.setHeader('content-type','application/json');res.end(JSON.stringify({healthy,...status}));});
  server.listen(config.healthPort,'0.0.0.0');
  const stop=(signal:string)=>{log('info','shutdown_requested',{signal});controller.abort();};
  process.once('SIGINT',()=>stop('SIGINT')); process.once('SIGTERM',()=>stop('SIGTERM'));
  let backoff=config.pollMs;
  log('info','keeper_started',{rpc_url:config.rpcUrl,expected_chain_id:config.expectedChainId,mode:status.mode,max_steps:config.maxSteps,poll_ms:config.pollMs});
  try {
    while(!controller.signal.aborted){
      let delay=config.pollMs;
      try {
        const info=await client.getInfo(); client.validateInfo(info);
        const claims=await client.listClaimableProducers();
        Object.assign(status,{lastCheckAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString(),lastError:undefined,headBlockNum:info.headBlockNum,libBlockNum:info.libBlockNum,claimable:claims.map(c=>c.producer)});
        log('info','claimables_checked',{count:claims.length,producers:claims.map(c=>c.producer)});
        for(const claim of claims){
          if(!config.broadcast){log('info','claim_due_dry_run',{...claim});continue;}
          const result=await client.claimRewards(claim.producer);
          log('info','claim_broadcast',{producer:claim.producer,...result});
          const deadline=Date.now()+config.confirmationTimeoutMs;
          let irreversible=false;
          while(Date.now()<deadline&&!controller.signal.aborted){const next=await client.getInfo();client.validateInfo(next);if(next.libBlockNum>=result.blockNum){irreversible=true;break;}await sleep(config.confirmationPollMs,controller.signal);}
          if(!irreversible)throw new Error(`confirmation timed out for ${claim.producer} at block ${result.blockNum}`);
          log('info','claim_irreversible',{producer:claim.producer,...result});
          await sleep(config.perProducerDelayMs,controller.signal);
        }
        backoff=config.pollMs;
      }catch(error){const message=error instanceof Error?error.message:String(error);status.lastError=message;status.lastCheckAt=new Date().toISOString();log('error','keeper_cycle_failed',{error:message});delay=backoff;backoff=Math.min(backoff*2,config.errorBackoffMaxMs);}
      await sleep(delay,controller.signal);
    }
  }finally{await new Promise<void>(r=>server.close(()=>r()));await release();log('info','keeper_stopped');}
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)runKeeper().catch(e=>{log('error','keeper_fatal',{error:e instanceof Error?e.message:String(e)});process.exitCode=1;});
