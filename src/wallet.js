import { Client } from '@fullon/flonjs';

const wait=milliseconds=>new Promise(resolve=>window.setTimeout(resolve,milliseconds));
const timeout=(promise,milliseconds,message)=>Promise.race([promise,new Promise((_,reject)=>window.setTimeout(()=>reject(new Error(message)),milliseconds))]);
const config=()=>({anchorService:'https://fwd.hufu.io',...(window.__DAO_GOV_CONFIG__||{})});
const rpcUrl=()=>new URL(config().rpcUrl,window.location.origin).href.replace(/\/$/,'');
const appId=()=>`flon-daogov-${config().network||'mainnet'}`;
const storageKey=()=>`flon.daogov.wallet.${config().network||'mainnet'}`;
let anchorLink;
let hufuChainInfo=null;
let automaticConnection=null;
let accountPromptReadyAt=0;

function normalizeAccount(value){
  if(typeof value==='string'){try{return normalizeAccount(JSON.parse(value))}catch{return /^[a-z1-5.]{1,12}$/.test(value)?{account:value,permission:'active',chainId:''}:null}}
  if(Array.isArray(value)){for(const item of value){const found=normalizeAccount(item);if(found)return found}return null}
  if(!value||typeof value!=='object')return null;
  const account=value.account||value.accountName||value.name||value.actor;
  if(account)return {account:String(account),permission:String(value.permission||'active'),chainId:String(value.chainId||value.chain_id||'')};
  for(const key of ['selectedAccount','currentAccount','accounts','data','result']){const found=normalizeAccount(value[key]);if(found)return found}
  return null;
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
async function rpcPost(path,body){
  const response=await timeout(fetch(`${rpcUrl()}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),12000,'RPC_TIMEOUT');
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
async function captureHuFuChainInfo(bridge){
  if(!bridge)return;
  const previousReady=window.onChainReady,previousInfo=window.onChainInfo;
  let resolveReady;const ready=new Promise(resolve=>resolveReady=resolve);let settled=false;
  const finish=value=>{if(value!==undefined)hufuChainInfo=value;if(!settled){settled=true;resolveReady()}};
  window.onChainReady=value=>{previousReady?.(value);if(value&&bridge.HuFuGetChain)Promise.resolve(bridge.HuFuGetChain()).then(finish).catch(()=>finish())};
  window.onChainInfo=value=>{previousInfo?.(value);finish(value)};
  const timer=window.setTimeout(()=>finish(),5000);
  try{
    if(bridge.HuFuSwitchChain)Promise.resolve(bridge.HuFuSwitchChain('FLON')).then(value=>{if(value!==undefined)hufuChainInfo=value}).catch(()=>{});
    if(bridge.HuFuGetChain)Promise.resolve(bridge.HuFuGetChain()).then(finish).catch(()=>finish());
    await ready;
  }finally{window.clearTimeout(timer);window.onChainReady=previousReady;window.onChainInfo=previousInfo}
}
async function prepareHuFu(){
  if(!isHuFuApp())return window.HuFu||null;
  for(let count=0;count<30&&!window.HuFuJSProvider;count++)await wait(100);
  const bridge=window.HuFuJSProvider;
  await captureHuFuChainInfo(bridge);
  for(let count=0;count<50&&!window.HuFu;count++)await wait(100);
  return window.HuFu||null;
}
function chainIdFrom(value,depth=0){
  if(!value||depth>4)return '';
  if(typeof value==='string'){
    const normalized=value.trim().toLowerCase().replace(/^0x/,'');if(/^[0-9a-f]{64}$/.test(normalized))return normalized;
    try{return chainIdFrom(JSON.parse(value),depth+1)}catch{return ''}
  }
  if(typeof value!=='object')return '';
  for(const key of ['chainId','chain_id','id']){const found=chainIdFrom(value[key],depth+1);if(found)return found}
  for(const key of ['network','chain','info','data','result','payload']){const found=chainIdFrom(value[key],depth+1);if(found)return found}
  return '';
}
function isFullOnChain(value){const record=value&&typeof value==='object'?value:null;return ['FLON','FULLON'].includes(String(record?.name||record?.chain||value||'').toUpperCase())}
function accountSnapshot(provider){for(const value of [provider?.selectedAccount,provider?.currentAccount,provider?.account,provider?.accounts]){const found=normalizeAccount(value);if(found)return found}return null}
async function confirmInjectedChain(provider,account=null,restoredChainId=''){
  const embedded=chainIdFrom(account)||chainIdFrom(provider);if(embedded){assertChain(embedded);return embedded}
  const reads=[];
  for(const getter of [provider?.getChainId,provider?.getChainID,provider?.getInfo])if(typeof getter==='function')reads.push(timeout(Promise.resolve().then(()=>getter.call(provider)),1500,'HUFU_NETWORK_TIMEOUT'));
  if(typeof provider?.request==='function')for(const request of [{method:'get_info'},{method:'rpc',params:{request:{method:'get_info',params:[]}}}])reads.push(timeout(Promise.resolve().then(()=>provider.request(request)),1500,'HUFU_NETWORK_TIMEOUT'));
  for(const result of await Promise.allSettled(reads)){if(result.status==='fulfilled'){const found=chainIdFrom(result.value);if(found){assertChain(found);return found}}}
  const refreshed=await prepareHuFu();const refreshedId=chainIdFrom(account)||chainIdFrom(refreshed)||chainIdFrom(hufuChainInfo);
  if(refreshedId){assertChain(refreshedId);return refreshedId}
  if(isFullOnChain(hufuChainInfo)){assertChain(restoredChainId||config().chainId);return restoredChainId||config().chainId}
  throw new Error('WALLET_CHAIN_UNCONFIRMED');
}
async function getAnchorLink(){
  if(anchorLink)return anchorLink;
  const [{default:AnchorLink},{default:AnchorLinkBrowserTransport}]=await Promise.all([import('@fullon/anchor-link'),import('@fullon/anchor-link-browser-transport')]);
  anchorLink=new AnchorLink({transport:new AnchorLinkBrowserTransport(),service:config().anchorService,chains:[{chainId:config().chainId,nodeUrl:rpcUrl()}]});
  return anchorLink;
}
export async function restoreWallet(){
  const stored=load();if(!stored)return null;
  try{
    assertChain(stored.chainId);
    if(stored.provider==='hufu'&&isHuFuApp()){
      const current=accountSnapshot(window.HuFu);
      if(current&&current.account!==stored.account)throw new Error('ACCOUNT_CHANGED');
      const chainId=chainIdFrom(current)||chainIdFrom(window.HuFu)||chainIdFrom(hufuChainInfo);if(chainId)assertChain(chainId);
      return stored;
    }
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
    }
    return stored;
  }catch{forget();return null}
}
export async function connectWallet(){
  const restored=await restoreWallet();if(restored)return restored;
  const client=window.__DAO_HUFU_CLIENT__||new Client();window.__DAO_HUFU_CLIENT__=client;
  if(client.isInIframe()){
    const info=await timeout(client.rpc.get_info(),10000,'HUFU_NETWORK_TIMEOUT');assertChain(info?.chain_id);
    const account=normalizeAccount(await timeout(client.getAccount(),10000,'HUFU_ACCOUNT_TIMEOUT'));
    if(!account)throw new Error('HUFU_ACCOUNT_UNAVAILABLE');
    return save({...account,chainId:config().chainId,provider:'iframe'});
  }
  const provider=isHuFuApp()?await prepareHuFu():window.HuFu;
  if(provider?.requestAccountsHuFu){
    const response=await timeout(Promise.resolve(provider.requestAccountsHuFu()),30000,'HUFU_ACCOUNT_TIMEOUT');
    accountPromptReadyAt=Date.now()+650;
    const account=normalizeAccount(response);
    if(!account)throw new Error('HUFU_ACCOUNT_UNAVAILABLE');
    await wait(650);
    const chainId=await confirmInjectedChain(provider,account);
    return save({...account,chainId,provider:'hufu'});
  }
  if(isHuFuApp())throw new Error('HUFU_PROVIDER_UNAVAILABLE');
  await rpcInfo();
  const link=await getAnchorLink(),identity=await link.login(appId()),session=identity.session;
  assertChain(String(session.chainId));
  return save({account:session.auth.actor.toString(),permission:session.auth.permission.toString(),chainId:config().chainId,provider:'anchor'});
}
export function autoConnectHuFuWallet(){
  if(!isHuFuApp())return Promise.resolve(null);
  if(!automaticConnection)automaticConnection=(async()=>{
    const restored=await restoreWallet();if(restored)return restored;
    const client=window.__DAO_HUFU_CLIENT__||new Client();window.__DAO_HUFU_CLIENT__=client;
    if(client.isInIframe()){
      const info=await timeout(client.rpc.get_info(),10000,'HUFU_NETWORK_TIMEOUT');assertChain(info?.chain_id);
      const account=normalizeAccount(await timeout(client.getAccount(),10000,'HUFU_ACCOUNT_TIMEOUT'));
      return account?save({...account,chainId:config().chainId,provider:'iframe'}):null;
    }
    const provider=await prepareHuFu();if(!provider)return null;
    const account=accountSnapshot(provider);if(!account)return null;
    const chainId=await confirmInjectedChain(provider,account);
    return save({...account,chainId,provider:'hufu'});
  })();
  return automaticConnection;
}
export async function disconnectWallet(){
  const stored=load();
  if(stored?.provider==='anchor'){try{(await getAnchorLink()).clearSessions(appId())}catch{}}
  automaticConnection=null;forget();
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
  const [balances,flonBalances,voterRows,pendingRows,allocationRows,pendingAllocationRows,rewardRows,epochRows,refundRows,abi]=await Promise.all([
    rpcPost('/v1/chain/get_currency_balance',{code:'flon.token',account,symbol:'GLON'}).catch(()=>[]),
    rpcPost('/v1/chain/get_currency_balance',{code:'flon.token',account,symbol:'FLON'}).catch(()=>[]),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'voters',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'pendingvote',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'voteallocs',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'pendallocs',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'voter.reward',scope:'voter.reward',table:'voters',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'rewardepoch',limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:account,table:'voterefund',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_abi',{account_name:'flon'}).catch(()=>({abi:{actions:[]}})),
  ]);
  const voter=voterRows.rows?.find(row=>row.owner===account)||null;
  const pending=pendingRows.rows?.find(row=>row.voter===account)||null;
  const effectiveAllocation=allocationRows.rows?.find(row=>row.voter===account)||null;
  const pendingAllocation=pendingAllocationRows.rows?.find(row=>row.voter===account)||null;
  const rewards=rewardRows.rows?.find(row=>row.owner===account)||null;
  const refund=refundRows.rows?.find(row=>row.owner===account)||null;
  const glon=Array.isArray(balances)&&balances.length?balances[0]:'0.00000000 GLON';
  const flon=Array.isArray(flonBalances)&&flonBalances.length?flonBalances[0]:'0.00000000 FLON';
  const actions=new Set((abi.abi?.actions||[]).map(item=>item.name));
  const nodeVoteUnits=pending?.votes??voter?.votes??0;
  return {
    account,glon,flon,nodeVoteStake:formatAssetUnits(nodeVoteUnits,'FLON'),voter,pending,effectiveAllocation,pendingAllocation,rewards,refund,
    stakeSupported:actions.has('addvote')&&actions.has('subvote')&&actions.has('voterefund'),
    voteAllocationSupported:actions.has('votealloc'),
    nextEpoch:Number(epochRows.rows?.[0]?.next_epoch_to_close||0),
    effectiveVotes:Number(voter?.votes||0),
    effectiveProducers:Array.isArray(voter?.producers)?voter.producers:[],
    pendingProducers:Array.isArray(pending?.producers)?pending.producers:null,
    effectiveAllocations:Array.isArray(effectiveAllocation?.allocations)?effectiveAllocation.allocations:null,
    pendingAllocations:Array.isArray(pendingAllocation?.allocations)?pendingAllocation.allocations:null,
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
    const current=accountSnapshot(provider);if(current&&current.account!==session.account)throw new Error('ACCOUNT_CHANGED');
    await confirmInjectedChain(provider,current,session.chainId);
    const remaining=accountPromptReadyAt-Date.now();if(remaining>0)await wait(remaining);
    return provider.transact({transaction:{actions:authorized}});
  }
  const anchorSession=await (await getAnchorLink()).restoreSession(appId());if(!anchorSession)throw new Error('SESSION_EXPIRED');
  return anchorSession.transact({actions:authorized},{broadcast:true,blocksBehind:3,expireSeconds:120});
}
