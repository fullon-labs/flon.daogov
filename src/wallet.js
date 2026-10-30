import {loadProducerEpochs} from './producer-status.js';
import {Client} from '@fullon/flonjs';
import {latestCompleteEpoch,summarizeBPProduction} from './production.js';
import {summarizeNetworkEconomics} from './network-summary.js';
import {readTablePages} from './table-pages.js';

const wait=milliseconds=>new Promise(resolve=>window.setTimeout(resolve,milliseconds));
const timeout=(promise,milliseconds,message)=>Promise.race([promise,new Promise((_,reject)=>window.setTimeout(()=>reject(new Error(message)),milliseconds))]);
const config=()=>({anchorService:'https://fwd.hufu.io',...(window.__DAO_GOV_CONFIG__||{})});
const rpcUrl=()=>new URL(config().rpcUrl,window.location.origin).href.replace(/\/$/,'');
const appId=()=>`flon-daogov-${config().network||'mainnet'}`;
const storageKey=()=>`flon.daogov.wallet.${config().network||'mainnet'}`;
const rewardEpochMilliseconds=21600000;
const blockTimestampEpochMilliseconds=Date.UTC(2000,0,1);
const transactionOptions={blocksBehind:3,expireSeconds:300};
const hufuTransactionTimeoutMilliseconds=60000;
const hufuExpirationSeconds=300;
let anchorLink;
let hufuChainInfo=null;
let automaticConnection=null;
let hufuFullOnRequested=false;
let hufuParentClient=null;

function transactHuFuNativeChannel(actions,transaction={actions}){
  const channel=window.flutter_inappwebview;
  if(typeof channel?.callHandler!=='function')return null;
  const id=`daogov-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return new Promise((resolve,reject)=>{
    const previousSuccess=window.onSignEOSSuccessful,previousError=window.onSignEOSError;
    let settled=false;
    const timer=window.setTimeout(()=>failure(id,'HUFU_TRANSACTION_TIMEOUT'),hufuTransactionTimeoutMilliseconds);
    const restore=()=>{
      window.clearTimeout(timer);
      if(window.onSignEOSSuccessful===success)window.onSignEOSSuccessful=previousSuccess;
      if(window.onSignEOSError===failure)window.onSignEOSError=previousError;
    };
    const success=(responseId,value)=>{
      if(responseId!==id){previousSuccess?.(responseId,value);return}
      if(settled)return;settled=true;restore();
      try{resolve(typeof value==='string'?JSON.parse(value):value)}catch{resolve(value)}
    };
    const failure=(responseId,error,code)=>{
      if(responseId!==id){previousError?.(responseId,error,code);return}
      if(settled)return;settled=true;restore();
      const failureError=new Error(typeof error==='string'?error:JSON.stringify(error));failureError.code=code||402;reject(failureError);
    };
    window.onSignEOSSuccessful=success;
    window.onSignEOSError=failure;
    const message=JSON.stringify({type:'pushTransaction',id,data:JSON.stringify({transaction})});
    try{Promise.resolve(channel.callHandler('FlutterChannel',message)).catch(error=>failure(id,error?.message||String(error)))}catch(error){failure(id,error?.message||String(error))}
  });
}

function normalizeAccount(value){
  if(typeof value==='string'){try{return normalizeAccount(JSON.parse(value))}catch{return /^[a-z1-5.]{1,12}$/.test(value)?{account:value,permission:'active',chainId:''}:null}}
  if(Array.isArray(value)){for(const item of value){const found=normalizeAccount(item);if(found)return found}return null}
  if(!value||typeof value!=='object')return null;
  const account=value.account||value.accountName||value.name||value.actor;
  if(account)return {
    account:String(account),
    permission:String(value.permission||'active'),
    chainId:String(value.chainId||value.chain_id||''),
    ...(value.publicKey||value.public_key?{publicKey:String(value.publicKey||value.public_key)}:{}),
    ...(value.network!==undefined?{network:value.network}:{}),
  };
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
  const payload=await response.json().catch(()=>null);
  if(!response.ok){
    const details=payload?.error?.details||[];
    if(path==='/v1/chain/get_account'&&details.some(item=>/unknown key.*name/i.test(String(item?.message||''))))throw new Error('ACCOUNT_NOT_FOUND_ON_NETWORK');
    throw new Error(`RPC_HTTP_${response.status}`);
  }
  return payload;
}
async function rpcInfo(){
  const info=await rpcPost('/v1/chain/get_info',{});
  if(String(info.chain_id)!==config().chainId)throw new Error('RPC_CHAIN_ID_MISMATCH');
  return info;
}
function optionalTableRows(body){
  return rpcPost('/v1/chain/get_table_rows',body).catch(()=>({rows:[]}));
}
async function assertAccountOnChain(account){
  await rpcPost('/v1/chain/get_account',{account_name:account});
}
function utcMilliseconds(value){
  const text=String(value||'');
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(text)?text:`${text}Z`);
}
function blockPrefixFromId(blockId){
  const normalized=String(blockId||'').trim().toLowerCase();
  if(!/^[0-9a-f]{64}$/.test(normalized))throw new Error('INVALID_IRREVERSIBLE_BLOCK_ID');
  const bytes=Uint8Array.from(normalized.match(/../g).map(byte=>Number.parseInt(byte,16)));
  return new DataView(bytes.buffer).getUint32(8,true);
}
function expirationFromChainTime(chainTime){
  const timestamp=utcMilliseconds(chainTime);
  if(!Number.isFinite(timestamp))throw new Error('INVALID_HEAD_BLOCK_TIME');
  return new Date(timestamp+hufuExpirationSeconds*1000).toISOString().slice(0,19);
}
async function prepareHuFuTransaction(actions){
  const info=await rpcInfo();assertFreshChainTime(info);
  if(!Number.isSafeInteger(info.last_irreversible_block_num)||!info.last_irreversible_block_id)throw new Error('INCOMPLETE_RPC_INFO');
  return {
    expiration:expirationFromChainTime(info.head_block_time),
    ref_block_num:info.last_irreversible_block_num&0xffff,
    ref_block_prefix:blockPrefixFromId(info.last_irreversible_block_id),
    max_net_usage_words:0,
    max_cpu_usage_ms:0,
    delay_sec:0,
    context_free_actions:[],
    actions,
    transaction_extensions:[],
  };
}
function normalizeRewardPlans(value){
  const rows=Array.isArray(value)?value:(value?[value]:[]);
  return rows.map(row=>({
    firstEpoch:Number(row?.first_epoch_id),
    startSlot:Number(row?.start_slot),
    epochSlots:Number(row?.epoch_slots),
  })).filter(row=>Number.isSafeInteger(row.firstEpoch)&&Number.isSafeInteger(row.startSlot)&&Number.isSafeInteger(row.epochSlots)&&row.epochSlots>0)
    .sort((left,right)=>left.firstEpoch-right.firstEpoch);
}
async function loadRewardPlans(){
  const canonical=await rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'rewardplans',limit:100}).catch(()=>({rows:[]}));
  if(canonical.rows?.length)return canonical.rows;
  const legacy=await rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'rewardcfgv2',limit:1}).catch(()=>({rows:[]}));
  return legacy.rows||[];
}
function epochTiming(chainInfo,globalRow,rewardPlans=[],nextEpochToClose=null,activationEpoch=null){
  const chainHeadMs=utcMilliseconds(chainInfo?.head_block_time);
  const rewardStartMs=utcMilliseconds(globalRow?.reward_started_time);
  if(!Number.isFinite(chainHeadMs)||!Number.isFinite(rewardStartMs)||chainHeadMs<rewardStartMs)return null;
  const headSlot=Math.floor((chainHeadMs-blockTimestampEpochMilliseconds)/500);
  const plans=normalizeRewardPlans(rewardPlans);
  const slotPlan=plans.filter(plan=>plan.startSlot<=headSlot).at(-1);
  const currentEpoch=slotPlan
    ? slotPlan.firstEpoch+Math.floor((headSlot-slotPlan.startSlot)/slotPlan.epochSlots)
    : Math.floor((chainHeadMs-rewardStartMs)/rewardEpochMilliseconds);
  const hasActivationEpoch=activationEpoch!==null&&activationEpoch!==undefined&&Number.isSafeInteger(Number(activationEpoch));
  const targetEpoch=hasActivationEpoch?Number(activationEpoch):currentEpoch+1;
  const epochPlan=plans.filter(plan=>plan.firstEpoch<=targetEpoch).at(-1);
  const boundaryMs=epochPlan
    ? blockTimestampEpochMilliseconds+(epochPlan.startSlot+(targetEpoch-epochPlan.firstEpoch)*epochPlan.epochSlots)*500
    : rewardStartMs+targetEpoch*rewardEpochMilliseconds;
  return {chainHeadMs,rewardStartMs,currentEpoch,targetEpoch,boundaryMs,nextEpochToClose:Number(nextEpochToClose)};
}
export async function loadEpochTiming(activationEpoch=null){
  const [chainInfo,globalRows,configRows,epochRows]=await Promise.all([
    rpcInfo(),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'global',limit:1}),
    loadRewardPlans(),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'rewardepoch',limit:1}).catch(()=>({rows:[]})),
  ]);
  return epochTiming(chainInfo,globalRows.rows?.[0],configRows,epochRows.rows?.[0]?.next_epoch_to_close,activationEpoch);
}
function assertFreshChainTime(info,now=Date.now()){
  const value=String(info?.head_block_time||'');
  const chainTime=Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value)?value:`${value}Z`);
  if(!Number.isFinite(chainTime)||now-chainTime>90000||chainTime-now>30000)throw new Error('CHAIN_TIME_STALE');
}
function assertChain(chainId){if(chainId&&String(chainId)!==config().chainId)throw new Error('WALLET_CHAIN_ID_MISMATCH')}
export function isHuFuApp(){
  return navigator.userAgent.toLowerCase().includes('hufu')||
    Boolean(window.HuFu||window.HuFuJSProvider);
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
    if(bridge.HuFuGetChain)Promise.resolve(bridge.HuFuGetChain()).then(finish).catch(()=>finish());
    await ready;
  }finally{window.clearTimeout(timer);window.onChainReady=previousReady;window.onChainInfo=previousInfo}
}
async function prepareHuFu(){
  if(!isHuFuApp())return window.HuFu||null;
  for(let count=0;count<30&&!window.HuFuJSProvider;count++)await wait(100);
  const bridge=window.HuFuJSProvider;
  if(bridge?.HuFuSwitchChain&&!hufuFullOnRequested){
    hufuFullOnRequested=true;
    await Promise.resolve(bridge.HuFuSwitchChain('FLON'));
  }
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
function confirmTransactionSnapshot(provider,account=null,restoredChainId=''){
  // A transaction click must open exactly one native HuFu surface: approval.
  // Some HuFu releases route provider network reads and native switch calls
  // through the account chooser, so never invoke them for an established,
  // domain-scoped session. Validate synchronously exposed metadata when it is
  // available and otherwise rely on the verified session and DApp RPC.
  const chainId=chainIdFrom(account)||chainIdFrom(provider);
  if(chainId){assertChain(chainId);return chainId}
  assertChain(restoredChainId);
  return restoredChainId||config().chainId;
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
    if((stored.provider==='hufu'||stored.provider==='iframe')&&isHuFuApp()){
      const current=accountSnapshot(window.HuFu);
      if(current&&current.account!==stored.account)throw new Error('ACCOUNT_CHANGED');
      // HuFu's only public account getter is interactive in several releases.
      // A domain/network-scoped session is therefore restored without calling
      // the interactive account picker. When the provider exposes a passive snapshot we
      // still reject account changes; otherwise the transaction actor and the
      // wallet signature enforce ownership of the cached account.
      const chainId=chainIdFrom(current)||chainIdFrom(window.HuFu)||chainIdFrom(hufuChainInfo);if(chainId)assertChain(chainId);
      await assertAccountOnChain(stored.account);
      return save({...stored,provider:'hufu'});
    }
    if(stored.provider==='anchor'){
      // An Anchor session cached by a normal browser must never be reused by
      // HuFu's embedded browser. It bypasses the native bridge and leaves the
      // user waiting for a signing surface that cannot open in this context.
      if(isHuFuApp()){forget();return null}
      await rpcInfo();
      const session=await (await getAnchorLink()).restoreSession(appId());
      if(!session||session.auth.actor.toString()!==stored.account)throw new Error('SESSION_EXPIRED');
      assertChain(String(session.chainId));
    }
    return stored;
  }catch{forget();return null}
}
export async function connectWallet(){
  const restored=await restoreWallet();if(restored)return restored;
  const provider=isHuFuApp()?await prepareHuFu():window.HuFu;
  if(provider?.requestAccountsHuFu){
    const response=await timeout(Promise.resolve(provider.requestAccountsHuFu()),30000,'HUFU_ACCOUNT_TIMEOUT');
    const account=normalizeAccount(response);
    if(!account)throw new Error('HUFU_ACCOUNT_UNAVAILABLE');
    await wait(650);
    const chainId=await confirmInjectedChain(provider,account);
    await assertAccountOnChain(account.account);
    return save({...account,chainId,provider:'hufu'});
  }
  if(isHuFuApp())throw new Error('HUFU_PROVIDER_UNAVAILABLE');
  await rpcInfo();
  const link=await getAnchorLink(),identity=await link.login(appId()),session=identity.session;
  assertChain(String(session.chainId));
  await assertAccountOnChain(session.auth.actor.toString());
  return save({account:session.auth.actor.toString(),permission:session.auth.permission.toString(),chainId:config().chainId,provider:'anchor'});
}
export function autoConnectHuFuWallet(){
  if(!isHuFuApp())return Promise.resolve(null);
  if(!automaticConnection)automaticConnection=(async()=>{
    const restored=await restoreWallet();if(restored)return restored;
    const provider=await prepareHuFu();if(!provider)return null;
    const account=accountSnapshot(provider);
    // Page load must never open HuFu's interactive account picker. A passive
    // injected snapshot can connect silently; otherwise the user may choose
    // Connect wallet explicitly once and the resulting session is cached.
    if(!account)return null;
    const chainId=await confirmInjectedChain(provider,account);
    await assertAccountOnChain(account.account);
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
  const selfStakeRefundSupported=selfStakeSupported&&actions.some(item=>item.name==='unstakebp')&&
    actions.some(item=>item.name==='claimbpstake')&&tables.some(item=>item.name==='bpstkrefund');
  const cancelBPRefundSupported=selfStakeRefundSupported&&actions.some(item=>item.name==='cancelbpref');
  const requests=[
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'producers',lower_bound:account,upper_bound:account,limit:1}),
  ];
  if(selfStakeSupported){
    requests.push(optionalTableRows({json:true,code:'flon',scope:'flon',table:'bpstakecfg',limit:1}));
    requests.push(optionalTableRows({json:true,code:'flon',scope:'flon',table:'bpstakes',lower_bound:account,upper_bound:account,limit:1}));
    if(selfStakeRefundSupported)requests.push(optionalTableRows({json:true,code:'flon',scope:'flon',table:'bpstkrefund',lower_bound:account,upper_bound:account,limit:1}));
  }
  if(recoverySupported){
    requests.push(optionalTableRows({json:true,code:'flon',scope:'flon',table:'bpstatus',lower_bound:account,upper_bound:account,limit:1}));
    requests.push(optionalTableRows({json:true,code:'flon',scope:'flon',table:'rewardepoch',limit:1}));
    requests.push(optionalTableRows({json:true,code:'flon',scope:'flon',table:'global',limit:1}));
  }
  const results=await Promise.all(requests);
  const producerRows=results[0];
  let cursor=1,selfStakeConfig=null,selfStake=null,selfStakeRefund=null;
  if(selfStakeSupported){
    selfStakeConfig=results[cursor++]?.rows?.[0]||null;
    selfStake=results[cursor++]?.rows?.find(row=>row.owner===account)||null;
    if(selfStakeRefundSupported)selfStakeRefund=results[cursor++]?.rows?.find(row=>row.owner===account)||null;
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
    const statsRows=await optionalTableRows({json:true,code:'flon',scope:String(calculatedEpoch),table:'bpstats',lower_bound:account,upper_bound:account,limit:1});
    currentStats=statsRows.rows?.find(row=>row.producer===account)||null;
  }
  return {account:accountInfo.account_name,producer,performance,currentStats,currentEpoch:calculatedEpoch,recoverySupported,selfStakeSupported,selfStakeRefundSupported,cancelBPRefundSupported,selfStakeConfig,selfStake,selfStakeRefund,headTime,supported:true};
}
export async function loadProducerRewards(producer){
  if(!/^[a-z1-5.]{1,12}$/.test(String(producer||'')))throw new Error('INVALID_BP_ACCOUNT');
  const [abi,producerRows,baseRows,gasRows]=await Promise.all([
    rpcPost('/v1/chain/get_abi',{account_name:'flon'}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'producers',lower_bound:producer,upper_bound:producer,limit:1}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:producer,table:'prodclaims',limit:1000}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:producer,table:'gasclaims',limit:1000}).catch(()=>({rows:[]})),
  ]);
  const supported=(abi.abi?.actions||[]).some(item=>item.name==='claimrewards');
  const row=producerRows.rows?.find(item=>item.owner===producer)||null;
  if(!row)throw new Error('BP_NOT_FOUND');
  const sum=rows=>rows.reduce((total,item)=>total+BigInt(String(item.quantity||'0').split(' ')[0].replace('.','').padEnd(9,'0').slice(0,16)||0),0n);
  const baseClaims=baseRows.rows||[],gasClaims=gasRows.rows||[];
  return {
    producer,row,supported,
    baseUnclaimed:row.unclaimed_rewards||'0.00000000 FLON',
    baseRows:baseClaims.length,
    gasRows:gasClaims.length,
    gasUnclaimed:formatAssetUnits(sum(gasClaims),'FLON'),
    hasClaimable:Number.parseFloat(row.unclaimed_rewards||'0')>0||baseClaims.length>0||gasClaims.length>0,
  };
}
export async function loadVotingAccount(account){
  const governance=config().governance||'dao.gov';
  const [powerRows,flonBalances,voterRows,pendingRows,allocationRows,pendingAllocationRows,rewardRows,epochRows,refundRows,abi,chainInfo,globalRows,rewardConfigRows]=await Promise.all([
    rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:governance,table:'powers',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_currency_balance',{code:'flon.token',account,symbol:'FLON'}).catch(()=>[]),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'voters',lower_bound:account,upper_bound:account,limit:1}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'pendingvote',lower_bound:account,upper_bound:account,limit:1}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'voteallocs',lower_bound:account,upper_bound:account,limit:1}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'pendallocs',lower_bound:account,upper_bound:account,limit:1}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'voter.reward',scope:'voter.reward',table:'voters',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'rewardepoch',limit:1}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:account,table:'voterefund',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_abi',{account_name:'flon'}).catch(()=>({abi:{actions:[]}})),
    rpcInfo(),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'global',limit:1}).catch(()=>({rows:[]})),
    loadRewardPlans(),
  ]);
  // Never turn an incomplete vote snapshot into an empty allocation.
  if([voterRows,pendingRows,allocationRows,pendingAllocationRows,epochRows].some(result=>!Array.isArray(result?.rows)))throw new Error('INVALID_VOTE_STATE_RESPONSE');
  const voter=voterRows.rows?.find(row=>row.owner===account)||null;
  const pending=pendingRows.rows?.find(row=>row.voter===account)||null;
  const effectiveAllocation=allocationRows.rows?.find(row=>row.voter===account)||null;
  const pendingAllocation=pendingAllocationRows.rows?.find(row=>row.voter===account)||null;
  const rewards=rewardRows.rows?.find(row=>row.owner===account)||null;
  const refund=refundRows.rows?.find(row=>row.owner===account)||null;
  const governancePower=powerRows.rows?.find(row=>row.voter===account)?.power||'0.00000000 POWER';
  const flon=Array.isArray(flonBalances)&&flonBalances.length?flonBalances[0]:'0.00000000 FLON';
  const actions=new Set((abi.abi?.actions||[]).map(item=>item.name));
  const nodeVoteUnits=pending?.votes??voter?.votes??0;
  const pendingActivationEpoch=Number(pendingAllocation?.activation_epoch??pending?.activation_epoch);
  const nextEpoch=Number(epochRows.rows?.[0]?.next_epoch_to_close||0);
  // Pending rows are materialized lazily by the voter actions. Once the epoch
  // cursor has reached activation_epoch, their vote deltas are already
  // effective even if the per-voter pending row still exists.
  const hasUnsettledVote=Boolean(pendingAllocation||pending)&&
    Number.isInteger(pendingActivationEpoch)&&pendingActivationEpoch>nextEpoch;
  return {
    account,governancePower,flon,nodeVoteStake:formatAssetUnits(nodeVoteUnits,'FLON'),voter,pending,effectiveAllocation,pendingAllocation,rewards,refund,
    stakeSupported:actions.has('addvote')&&actions.has('subvote')&&actions.has('voterefund'),
    voteAllocationSupported:actions.has('votealloc'),
    nextEpoch,
    effectiveVotes:Number(voter?.votes||0),
    effectiveProducers:Array.isArray(voter?.producers)?voter.producers:[],
    pendingProducers:Array.isArray(pending?.producers)?pending.producers:null,
    effectiveAllocations:Array.isArray(effectiveAllocation?.allocations)?effectiveAllocation.allocations:null,
    pendingAllocations:Array.isArray(pendingAllocation?.allocations)?pendingAllocation.allocations:null,
    unclaimedRewards:rewards?.unclaimed_rewards||'0.00000000 FLON',
    epochTiming:epochTiming(chainInfo,globalRows.rows?.[0],rewardConfigRows,nextEpoch,hasUnsettledVote?pendingActivationEpoch:null),
    hasPendingVote:hasUnsettledVote,
  };
}
export async function loadProducerStake(owner){
  const result=await rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'bpstakes',lower_bound:owner,upper_bound:owner,limit:1});
  if(!Array.isArray(result.rows))throw new Error('INVALID_BP_STAKE_RESPONSE');
  return result.rows.find(row=>row.owner===owner)?.staked||'0.00000000 FLON';
}
export async function loadElection(){
  const governance=config().governance||'dao.gov';
  const [producerRows,schedule,statusRows,configRows,stakeRows,governanceRows]=await Promise.all([
    readTablePages(rpcPost,{json:true,code:'flon',scope:'flon',table:'producers',limit:200}),
    rpcPost('/v1/chain/get_producer_schedule',{}),
    readTablePages(rpcPost,{json:true,code:'flon',scope:'flon',table:'bpstatus',limit:200}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:'electconfig',limit:1}).catch(()=>({rows:[]})),
    readTablePages(rpcPost,{json:true,code:'flon',scope:'flon',table:'bpstakes',limit:200}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:governance,table:'global',limit:1}).catch(()=>({rows:[]})),
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
  return {producers,activeTarget,activeCount:active.size,...summarizeNetworkEconomics(producers,stakeRows.rows||[],governanceRows.rows?.[0])};
}
export async function loadNetworkProduction(){
  const epochRows=await rpcPost('/v1/chain/get_table_rows',{
    json:true,code:'flon',scope:'flon',table:'epochstats',reverse:true,limit:24,
  });
  const epoch=latestCompleteEpoch(epochRows.rows||[]);
  if(!epoch)return {available:false,reason:'awaiting'};
  const statsRows=await rpcPost('/v1/chain/get_table_rows',{
    json:true,code:'flon',scope:String(epoch.epoch_id),table:'bpstats',limit:200,
  });
  const summary=summarizeBPProduction(statsRows.rows||[]);
  if(summary.rate===null)return {available:false,reason:'empty',epochId:Number(epoch.epoch_id)};
  return {available:true,epochId:Number(epoch.epoch_id),...summary};
}
export async function loadGovernance(account=''){
  const governance=config().governance||'dao.gov';
  const [abi,globalRows,configRows,allowRows,riskRows,policyRows,snapshotRows,proposalRows,chainInfo]=await Promise.all([
    rpcPost('/v1/chain/get_abi',{account_name:governance}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:governance,table:'global',limit:1}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:governance,table:'config',limit:1}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:governance,table:'allowlist',limit:100}),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:governance,table:'riskconfigs',limit:4}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:governance,table:'actpolicies',limit:200}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:governance,table:'policysnaps',limit:200,reverse:true}).catch(()=>({rows:[]})),
    rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:governance,table:'proposals',limit:200,reverse:true}),
    rpcInfo(),
  ]);
  const actions=new Set((abi.abi?.actions||[]).map(item=>item.name));
  const tables=new Set((abi.abi?.tables||[]).map(item=>item.name));
  const requiredActions=['propose','endorse','activate','castvote','finalize','queue','execute','expire','cancel'];
  const supported=requiredActions.every(action=>actions.has(action))&&tables.has('proposals')&&tables.has('powers');
  const global=globalRows.rows?.[0]||null,governanceConfig=configRows.rows?.[0]||null;
  let power=null,ballots=new Map(),endorsements=new Set();
  const proposals=proposalRows.rows||[];
  if(account&&/^[a-z1-5.]{1,12}$/.test(account)){
    const powerRows=await rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:governance,table:'powers',lower_bound:account,upper_bound:account,limit:1});
    power=powerRows.rows?.find(row=>row.voter===account)||null;
    await Promise.all(proposals.map(async proposal=>{
      const [ballotRows,endorsementRows]=await Promise.all([
        rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:String(proposal.proposal_id),table:'ballots',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
        rpcPost('/v1/chain/get_table_rows',{json:true,code:governance,scope:String(proposal.proposal_id),table:'endorsements',lower_bound:account,upper_bound:account,limit:1}).catch(()=>({rows:[]})),
      ]);
      const ballot=ballotRows.rows?.find(row=>row.voter===account);if(ballot)ballots.set(Number(proposal.proposal_id),ballot);
      if(endorsementRows.rows?.some(row=>row.endorser===account))endorsements.add(Number(proposal.proposal_id));
    }));
  }
  return {governance,supported,global,config:governanceConfig,allowlist:allowRows.rows||[],riskConfigs:riskRows.rows||[],actionPolicies:policyRows.rows||[],policySnapshots:snapshotRows.rows||[],riskSupported:actions.has('setriskcfg')&&actions.has('setactrisk')&&tables.has('riskconfigs')&&tables.has('actpolicies')&&tables.has('policysnaps'),proposals,power,ballots,endorsements,chainInfo};
}
export async function serializeGovernanceAction(contract,action,args){
  if(!/^[a-z1-5.]{1,12}$/.test(String(contract||''))||!/^[a-z1-5.]{1,12}$/.test(String(action||'')))throw new Error('INVALID_GOVERNANCE_ACTION');
  const result=await rpcPost('/v1/chain/abi_json_to_bin',{code:contract,action,args});
  const data=String(result?.binargs||'');
  if(!/^(?:[0-9a-f]{2})*$/i.test(data))throw new Error('INVALID_SERIALIZED_ACTION');
  return data.toLowerCase();
}
export async function loadContractAbi(contract){
  if(!/^[a-z1-5.]{1,12}$/.test(String(contract||'')))throw new Error('INVALID_CONTRACT');
  const result=await rpcPost('/v1/chain/get_abi',{account_name:contract});
  if(!result?.abi)throw new Error('CONTRACT_ABI_UNAVAILABLE');
  return result.abi;
}

export async function loadGovernanceActionDefaults(contract,action){
  const key=`${contract}::${action}`,tables={
    'flon::setbpquorum':'electconfig',
    'flon::setbpstake':'bpstakecfg',
    'flon::setgasrwcfg':'gasrewcfg'
  },table=tables[key];
  if(!table)return null;
  const result=await rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table,limit:1}),row=result.rows?.[0];
  if(!row)throw new Error('CURRENT_ACTION_VALUES_UNAVAILABLE');
  if(key==='flon::setbpquorum')return{active_bp_quorum:row.active_bp_quorum};
  if(key==='flon::setbpstake')return{enforce_schedule:Boolean(Number(row.enforce_schedule)),min_self_stake:row.min_self_stake,unstake_delay_sec:row.unstake_delay_sec};
  return{enabled:Boolean(Number(row.enabled)),epoch_slots:row.epoch_slots,active_min_bp:row.active_min_bp,pool_bp:row.pool_bp,active_share_bp:row.active_share_bp};
}
export async function loadChainGovernanceParameters(){
  const table=async name=>(await rpcPost('/v1/chain/get_table_rows',{json:true,code:'flon',scope:'flon',table:name,limit:1}).catch(()=>({rows:[]}))).rows?.[0]||null;
  const [rewardPlans,electionConfig,bpStakeConfig,gasRewardConfig]=await Promise.all([loadRewardPlans(),table('electconfig'),table('bpstakecfg'),table('gasrewcfg')]);
  const rewardPlan=normalizeRewardPlans(rewardPlans).at(-1);
  return{rewardEpochSlots:rewardPlan?.epochSlots||null,activeBpTarget:Number(electionConfig?.active_bp_quorum)||null,bpStakeConfig,gasRewardConfig};
}
export async function prepareHuFuSigningTransaction(session,actions){
  assertChain(session.chainId);
  const authorized=actions.map(action=>({...action,authorization:action.authorization||[{actor:session.account,permission:session.permission}]}));
  return prepareHuFuTransaction(authorized);
}

export async function authorizeHuFuSigning(session){
  assertChain(session.chainId);
  const provider=window.HuFu||null;
  const current=accountSnapshot(provider);
  if(current&&current.account!==session.account)throw new Error('ACCOUNT_CHANGED');
  confirmTransactionSnapshot(provider,current,session.chainId);
  await assertAccountOnChain(session.account);
  return session;
}

export async function transact(session,actions,options={}){
  assertChain(session.chainId);
  const authorized=actions.map(action=>({...action,authorization:action.authorization||[{actor:session.account,permission:session.permission}]}));
  // FlutterChannel is registered at WebView creation. The injected HuFu
  // object does not prove its asynchronously registered handler is ready.
  // This native route requires a complete transaction and binary action data.
  if(typeof window.flutter_inappwebview?.callHandler==='function'){
    const transaction=options.preparedTransaction||await prepareHuFuTransaction(authorized);
    const serialized=await Promise.all(transaction.actions.map(async action=>({...action,data:typeof action.data==='string'?action.data:await serializeGovernanceAction(action.account,action.name,action.data)})));
    return transactHuFuNativeChannel(serialized,{...transaction,actions:serialized});
  }
  // HuFu hosts some DApps inside its own parent container. FullSwap uses this
  // parent transaction bridge first; it is the route that opens HuFu's native
  // transaction sheet. This does not create an iframe and is deliberately not
  // used for account selection or RPC reads.
  if(window.parent!==window){
    hufuParentClient||=new Client();
    return hufuParentClient.transact(authorized);
  }
  // Opening HuFu's native signer must remain in the original click task.
  // Awaiting bridge discovery or RPC/TAPOS preparation first loses the user
  // gesture in affected HuFu WebViews, so use only the injected bridge already
  // exposed at click time.
  const provider=window.HuFu||null;
  if(session.provider==='hufu'&&provider?.transact){
    const current=accountSnapshot(provider);if(current&&current.account!==session.account)throw new Error('ACCOUNT_CHANGED');
    confirmTransactionSnapshot(provider,current,session.chainId);
    // Keep the testnet invocation byte-for-byte equivalent to FullSwap's
    // proven HuFu path. In particular, call the injected bridge directly in
    // the click stack; Promise/timeout wrappers around this call can postpone
    // the WebView bridge dispatch on affected HuFu releases.
    if(config().network!=='mainnet')return provider.transact({transaction:{actions:authorized}});
    const transaction=options.preparedTransaction||await prepareHuFuTransaction(authorized);
    return timeout(Promise.resolve(provider.transact({transaction})),hufuTransactionTimeoutMilliseconds,'HUFU_TRANSACTION_TIMEOUT');
  }
  if(isHuFuApp())throw new Error('HUFU_TRANSACTION_UNAVAILABLE');
  const info=await rpcInfo();assertFreshChainTime(info);
  const link=await getAnchorLink();
  // HuFu keeps its ESR listener only while the scanned session is active.
  // Browser storage alone cannot prove that the phone is still listening.
  // A fresh identity handshake brings the wallet to the foreground and binds
  // this transaction to a live channel, without replaying an earlier request.
  const {session:anchorSession}=await link.login(appId());
  assertChain(String(anchorSession.chainId));
  if(anchorSession.auth.actor.toString()!==session.account||anchorSession.auth.permission.toString()!==session.permission)throw new Error('ACCOUNT_CHANGED');
  save({...session,provider:'anchor'});
  return anchorSession.transact({actions:authorized},{broadcast:true,...transactionOptions});
}

const producerPerformanceCache=new Map();
export async function loadProducerPerformance(account){
  const key=`${config().chainId}:${rpcUrl()}:${account}`,now=Date.now();
  const cached=producerPerformanceCache.get(key);
  if(cached&&now-cached.at<30000)return cached.promise;
  const promise=(async()=>{await rpcInfo();return loadProducerEpochs(rpcPost,account)})();
  producerPerformanceCache.set(key,{at:now,promise});
  try{return await promise}catch(error){producerPerformanceCache.delete(key);throw error}
}
