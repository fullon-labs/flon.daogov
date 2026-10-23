import { Client } from '@fullon/flonjs';

const wait=milliseconds=>new Promise(resolve=>window.setTimeout(resolve,milliseconds));
const timeout=(promise,milliseconds,message)=>Promise.race([promise,new Promise((_,reject)=>window.setTimeout(()=>reject(new Error(message)),milliseconds))]);
const config=()=>({anchorService:'https://fwd.hufu.io',...(window.__DAO_GOV_CONFIG__||{})});
const appId=()=>`flon-daogov-${config().network||'mainnet'}`;
const storageKey=()=>`flon.daogov.wallet.${config().network||'mainnet'}`;
let anchorLink;
let walletRpc=null;

function normalizeAccount(value){
  if(!value||typeof value!=='object')return null;
  const account=value.account||value.name||value.actor;
  if(!account)return null;
  return {account:String(account),permission:String(value.permission||'active'),chainId:String(value.chainId||value.chain_id||'')};
}
function save(session){localStorage.setItem(storageKey(),JSON.stringify(session));return session}
function forget(){localStorage.removeItem(storageKey())}
function load(){try{return JSON.parse(localStorage.getItem(storageKey())||'null')}catch{return null}}
function formatAssetUnits(value,symbol,precision=8){
  const negative=String(value||0).startsWith('-');
  const digits=String(value||0).replace(/^-/, '').replace(/^0+(?=\d)/,'')||'0';
  const padded=digits.padStart(precision+1,'0');
  return `${negative?'-':''}${padded.slice(0,-precision)}.${padded.slice(-precision)} ${symbol}`;
}
function rpcRequest(path,body={}){
  const method=path.split('/').filter(Boolean).pop();
  if(method==='get_info'||method==='get_producer_schedule')return {method,params:[]};
  if(method==='get_account'||method==='get_abi')return {method,params:[body.account_name]};
  if(method==='get_currency_balance')return {method,params:[body.code,body.account,body.symbol]};
  return {method,params:[body]};
}
async function rpcPost(path,body){
  if(walletRpc){
    const {method,params}=rpcRequest(path,body);
    return timeout(walletRpc(method,params),12000,'WALLET_RPC_TIMEOUT');
  }
  const response=await timeout(fetch(`${config().rpcUrl.replace(/\/$/,'')}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),12000,'RPC_TIMEOUT');
  if(!response.ok)throw new Error(`RPC_HTTP_${response.status}`);
  return response.json();
}
async function rpcInfo(){
  const info=await rpcPost('/v1/chain/get_info',{});
  if(String(info.chain_id)!==config().chainId)throw new Error('RPC_CHAIN_ID_MISMATCH');
  return info;
}
function assertFreshChainTime(info,now=Date.now()){
  const value=String(info?.head_block_time||'');
  const chainTime=Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value)?value:`${value}Z`);
  if(!Number.isFinite(chainTime)||now-chainTime>90000||chainTime-now>30000)throw new Error('CHAIN_TIME_STALE');
}
function assertChain(chainId){if(chainId&&String(chainId)!==config().chainId)throw new Error('WALLET_CHAIN_ID_MISMATCH')}
export function isHuFuApp(){
  return navigator.userAgent.toLowerCase().includes('hufu')||
    Boolean(window.HuFu||window.HuFuJSProvider)||
    window.self!==window.top;
}
async function prepareHuFu(){
  if(window.HuFu?.requestAccountsHuFu)return window.HuFu;
  if(!isHuFuApp())return window.HuFu||null;
  for(let count=0;count<30&&!window.HuFuJSProvider;count++)await wait(100);
  const bridge=window.HuFuJSProvider;
  if(bridge?.HuFuSwitchChain){try{await timeout(Promise.resolve(bridge.HuFuSwitchChain('FLON')),5000,'HUFU_CHAIN_TIMEOUT')}catch{}}
  for(let count=0;count<50&&!window.HuFu;count++)await wait(100);
  return window.HuFu||null;
}
function unwrapRpc(value){
  let current=value;
  for(let depth=0;depth<4&&current&&typeof current==='object';depth++){
    if(current.chain_id||current.rows||Array.isArray(current))return current;
    if(current.result!==undefined){current=current.result;continue}
    if(current.payload!==undefined){current=current.payload;continue}
    break;
  }
  return current;
}
function firstSuccessful(promises){
  return new Promise((resolve,reject)=>{
    const errors=[];
    let pending=promises.length;
    for(const promise of promises){
      Promise.resolve(promise).then(resolve,error=>{
        errors.push(error);
        if(--pending===0)reject(errors);
      });
    }
  });
}
async function prepareInjectedRpc(provider){
  const candidates=[];
  if(provider?.rpc?.get_info)candidates.push((method,params)=>provider.rpc[method](...params));
  if(provider?.request){
    candidates.push((method,params)=>Promise.resolve(provider.request({method:'rpc',params:{request:{method,params}}})).then(unwrapRpc));
    candidates.push((method,params)=>Promise.resolve(provider.request({method,params})).then(unwrapRpc));
  }
  if(!candidates.length)throw new Error('HUFU_RPC_UNAVAILABLE');
  try{
    return await firstSuccessful(candidates.map(async call=>{
      const info=unwrapRpc(await timeout(call('get_info',[]),8000,'HUFU_NETWORK_TIMEOUT'));
      const chainId=info?.chain_id||info?.chainId;
      if(!chainId)throw new Error('HUFU_RPC_INVALID_RESPONSE');
      assertChain(chainId);
      return {call,info};
    }));
  }catch(errors){
    if(errors?.some(item=>String(item?.message||item)==='WALLET_CHAIN_ID_MISMATCH'))throw new Error('WALLET_CHAIN_ID_MISMATCH');
    throw new Error('HUFU_NETWORK_TIMEOUT');
  }
}
async function getAnchorLink(){
  if(anchorLink)return anchorLink;
  const [{default:AnchorLink},{default:AnchorLinkBrowserTransport}]=await Promise.all([import('@fullon/anchor-link'),import('@fullon/anchor-link-browser-transport')]);
  anchorLink=new AnchorLink({transport:new AnchorLinkBrowserTransport(),service:config().anchorService,chains:[{chainId:config().chainId,nodeUrl:config().rpcUrl}]});
  return anchorLink;
}
export async function restoreWallet(){
  const stored=load();if(!stored)return null;
  try{
    assertChain(stored.chainId);
    if(stored.provider==='anchor'){
      await rpcInfo();
      const session=await (await getAnchorLink()).restoreSession(appId());
      if(!session||session.auth.actor.toString()!==stored.account)throw new Error('SESSION_EXPIRED');
      assertChain(String(session.chainId));
    }
    if(stored.provider==='iframe'){
      const client=window.__DAO_HUFU_CLIENT__||new Client();window.__DAO_HUFU_CLIENT__=client;
      if(!client.isInIframe())throw new Error('IFRAME_SESSION_EXPIRED');
      const info=await timeout(client.rpc.get_info(),12000,'HUFU_NETWORK_TIMEOUT');assertChain(info?.chain_id);
      const account=normalizeAccount(await timeout(client.getAccount(),10000,'HUFU_ACCOUNT_TIMEOUT'));
      if(!account||account.account!==stored.account)throw new Error('ACCOUNT_CHANGED');
      walletRpc=(method,params)=>client.rpc[method](...params);
    }
    if(stored.provider==='hufu'){
      const provider=window.HuFu||(await prepareHuFu());
      const prepared=await prepareInjectedRpc(provider);
      walletRpc=prepared.call;
    }
    return stored;
  }catch{walletRpc=null;forget();return null}
}
export async function connectWallet(){
  const restored=await restoreWallet();if(restored)return restored;
  const client=window.__DAO_HUFU_CLIENT__||new Client();window.__DAO_HUFU_CLIENT__=client;
  const provider=window.HuFu||(isHuFuApp()?await prepareHuFu():null);
  if(provider?.requestAccountsHuFu){
    const response=await timeout(Promise.resolve(provider.requestAccountsHuFu()),30000,'HUFU_ACCOUNT_TIMEOUT');
    const account=normalizeAccount(Array.isArray(response)?response[0]:response);
    if(!account)throw new Error('HUFU_ACCOUNT_UNAVAILABLE');
    const prepared=await prepareInjectedRpc(provider);
    walletRpc=prepared.call;
    return save({...account,chainId:config().chainId,provider:'hufu'});
  }
  if(client.isInIframe()){
    const info=await timeout(client.rpc.get_info(),12000,'HUFU_NETWORK_TIMEOUT');assertChain(info?.chain_id);
    const account=normalizeAccount(await timeout(client.getAccount(),30000,'HUFU_ACCOUNT_TIMEOUT'));
    if(!account)throw new Error('HUFU_ACCOUNT_UNAVAILABLE');
    walletRpc=(method,params)=>client.rpc[method](...params);
    return save({...account,chainId:config().chainId,provider:'iframe'});
  }
  if(isHuFuApp())throw new Error('HUFU_PROVIDER_UNAVAILABLE');
  await rpcInfo();
  const link=await getAnchorLink(),identity=await link.login(appId()),session=identity.session;
  assertChain(String(session.chainId));
  return save({account:session.auth.actor.toString(),permission:session.auth.permission.toString(),chainId:config().chainId,provider:'anchor'});
}
export async function disconnectWallet(){
  const stored=load();
  if(stored?.provider==='anchor'){try{(await getAnchorLink()).clearSessions(appId())}catch{}}
  walletRpc=null;forget();
}
export async function loadBPAccount(account){
  const [accountInfo,abi,chainInfo]=await Promise.all([
    rpcPost('/v1/chain/get_account',{account_name:account}),
    rpcPost('/v1/chain/get_abi',{account_name:'flon'}),
    rpcInfo(),
  ]);
  const actions=abi.abi?.actions||[],tables=abi.abi?.tables||[];
  const supported=actions.some(item=>item.name==='regproducer')&&tables.some(item=>item.name==='producers');
  if(!supported)return {account:accountInfo.account_name,producer:null,supported:false};
  const recoverySupported=actions.some(item=>item.name==='resumeprod')&&tables.some(item=>item.name==='bpstatus');
  const selfStakeSupported=actions.some(item=>item.name==='stakebp')&&
    tables.some(item=>item.name==='bpstakecfg')&&tables.some(item=>item.name==='bpstakes');
  const requests=[
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'producers',lower_bound:account,upper_bound:account,limit:1}),
  ];
  if(selfStakeSupported){
    requests.push(rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'bpstakecfg',limit:1}));
    requests.push(rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'bpstakes',lower_bound:account,upper_bound:account,limit:1}));
  }
  if(recoverySupported){
    requests.push(rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'bpstatus',lower_bound:account,upper_bound:account,limit:1}));
    requests.push(rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'rewardepoch',limit:1}));
    requests.push(rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'global',limit:1}));
  }
  const results=await Promise.all(requests);
  const producerRows=results[0];
  let cursor=1,selfStakeConfig=null,selfStake=null;
  if(selfStakeSupported){
    selfStakeConfig=results[cursor++]?.rows?.[0]||null;
    selfStake=results[cursor++]?.rows?.find(row=>row.owner===account)||null;
  }
  const statusRows=recoverySupported?results[cursor++]:null;
  const epochRows=recoverySupported?results[cursor++]:null;
  const globalRows=recoverySupported?results[cursor++]:null;
  const producer=producerRows.rows?.find(row=>row.owner===account)||null;
  const performance=statusRows?.rows?.find(row=>row.producer===account)||null;
  const fallbackEpoch=Number(epochRows?.rows?.[0]?.next_epoch_to_close||0);
  const rewardStart=globalRows?.rows?.[0]?.reward_started_time;
  const startMs=rewardStart?Date.parse(String(rewardStart).endsWith('Z')?String(rewardStart):`${rewardStart}Z`):NaN;
  const headTime=chainInfo.head_block_time;
  const headMs=headTime?Date.parse(String(headTime).endsWith('Z')?String(headTime):`${headTime}Z`):NaN;
  const calculatedEpoch=Number.isFinite(startMs)&&Number.isFinite(headMs)&&headMs>=startMs?Math.floor((headMs-startMs)/21600000):fallbackEpoch;
  let currentStats=null;
  if(recoverySupported&&tables.some(item=>item.name==='bpstats')){
    const statsRows=await rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:String(calculatedEpoch),table:'bpstats',lower_bound:account,upper_bound:account,limit:1});
    currentStats=statsRows.rows?.find(row=>row.producer===account)||null;
  }
  return {account:accountInfo.account_name,producer,performance,currentStats,currentEpoch:calculatedEpoch,recoverySupported,selfStakeSupported,selfStakeConfig,selfStake,supported:true};
}
export async function loadVotingAccount(account){
  const [balances,voterRows,pendingRows,rewardRows,epochRows]=await Promise.all([
    rpcPost('/v1/chain/get_currency_balance',{code:'flon.token',account,symbol:'GLON'}).catch(()=>[]),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'voters',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'pendingvote',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'voter.reward',scope:'voter.reward',table:'voters',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'rewardepoch',limit:1}).catch(()=>({rows:[]})),
  ]);
  const voter=voterRows.rows?.find(row=>row.owner===account)||null;
  const pending=pendingRows.rows?.find(row=>row.voter===account)||null;
  const rewards=rewardRows.rows?.find(row=>row.owner===account)||null;
  const glon=Array.isArray(balances)&&balances.length?balances[0]:'0.00000000 GLON';
  const nodeVoteUnits=pending?.votes??voter?.votes??0;
  return {
    account,glon,nodeVoteStake:formatAssetUnits(nodeVoteUnits,'FLON'),voter,pending,rewards,
    nextEpoch:Number(epochRows.rows?.[0]?.next_epoch_to_close||0),
    effectiveVotes:Number(voter?.votes||0),
    effectiveProducers:Array.isArray(voter?.producers)?voter.producers:[],
    pendingProducers:Array.isArray(pending?.producers)?pending.producers:null,
    unclaimedRewards:rewards?.unclaimed_rewards||'0.00000000 FLON',
  };
}
export async function loadElection(){
  const [producerRows,schedule,statusRows,configRows]=await Promise.all([
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'producers',limit:200}),
    rpcPost('/v1/chain/get_producer_schedule',{}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'bpstatus',limit:200}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'electconfig',limit:1}).catch(()=>({rows:[]})),
  ]);
  const active=new Set((schedule.active?.producers||[]).map(row=>row.producer_name));
  const performance=new Map((statusRows.rows||[]).map(row=>[row.producer,row]));
  const activeTarget=Number(configRows.rows?.[0]?.active_bp_quorum||21);
  const producers=(producerRows.rows||[])
    .filter(row=>row.is_active!==0&&row.is_active!==false)
    .map(row=>({...row,performance:performance.get(row.owner)||null,status:active.has(row.owner)?'active':'candidate'}))
    .sort((left,right)=>Number(right.total_votes||0)-Number(left.total_votes||0)||left.owner.localeCompare(right.owner));
  let standbyRank=0;
  for(const producer of producers){
    if(producer.status==='active')continue;
    if(Number(producer.performance?.status)===4)producer.status='suspended';
    else if(standbyRank++<30)producer.status='standby';
  }
  return {producers,activeTarget,activeCount:active.size};
}
export async function transact(session,actions){
  assertChain(session.chainId);const info=await rpcInfo();assertFreshChainTime(info);
  const authorized=actions.map(action=>({...action,authorization:action.authorization||[{actor:session.account,permission:session.permission}]}));
  if(session.provider==='iframe')return window.__DAO_HUFU_CLIENT__.transact(authorized);
  if(session.provider==='hufu'){
    const provider=window.HuFu||(await prepareHuFu());if(!provider?.transact)throw new Error('HUFU_TRANSACTION_UNAVAILABLE');
    return provider.transact({transaction:{actions:authorized}});
  }
  const anchorSession=await (await getAnchorLink()).restoreSession(appId());if(!anchorSession)throw new Error('SESSION_EXPIRED');
  return anchorSession.transact({actions:authorized},{broadcast:true,blocksBehind:3,expireSeconds:120});
}
