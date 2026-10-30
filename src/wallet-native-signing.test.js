import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./wallet.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('function transactHuFuNativeChannel('),source.indexOf('function normalizeAccount'));
function setup(callHandler){
  let expire,cleared=false;
  const window={flutter_inappwebview:{callHandler},setTimeout(fn){expire=fn;return 1},clearTimeout(){cleared=true}};
  return {window,sign:new Function('window','hufuTransactionTimeoutMilliseconds',`${helper};return transactHuFuNativeChannel`)(window,60000),expire:()=>expire(),cleared:()=>cleared};
}
test('native bridge receives complete transaction and restores callbacks after success',async()=>{
  let message;
  const ctx=setup((name,value)=>{assert.equal(name,'FlutterChannel');message=JSON.parse(value)});
  const previous=()=>{};ctx.window.onSignEOSSuccessful=previous;
  const transaction={expiration:'2030-01-01T00:00:00',ref_block_num:12,ref_block_prefix:34,actions:[]};
  const result=ctx.sign([],transaction);
  assert.deepEqual(JSON.parse(message.data).transaction,transaction);
  ctx.window.onSignEOSSuccessful(message.id,'{"transaction_id":"abc"}');
  assert.deepEqual(await result,{transaction_id:'abc'});
  assert.equal(ctx.window.onSignEOSSuccessful,previous);assert.ok(ctx.cleared());
});
test('silent native bridge times out and removes callbacks',async()=>{
  const ctx=setup(()=>{}),result=ctx.sign([]);
  ctx.expire();await assert.rejects(result,/HUFU_TRANSACTION_TIMEOUT/);
  assert.equal(ctx.window.onSignEOSError,undefined);assert.ok(ctx.cleared());
});
test('synchronous bridge failure removes callbacks',async()=>{
  const ctx=setup(()=>{throw Error('bridge unavailable')});
  await assert.rejects(ctx.sign([]),/bridge unavailable/);
  assert.equal(ctx.window.onSignEOSSuccessful,undefined);assert.ok(ctx.cleared());
});
const transactBody=source.slice(source.indexOf('export async function transact(session,actions,options={})'),source.indexOf('\n}',source.indexOf('export async function transact(session,actions,options={})'))+2).replace('export async function','async function');
function desktop(signerAccount='alice'){
  const calls=[];
  const session={auth:{actor:{toString:()=>signerAccount},permission:{toString:()=> 'active'}},chainId:'chain',transact:async args=>{calls.push(['sign',args]);return {transaction_id:'signed'}}};
  const window={};window.parent=window;
  const run=new Function('window','assertChain','isHuFuApp','rpcInfo','assertFreshChainTime','getAnchorLink','appId','save','transactionOptions',`${transactBody};return transact`)(window,id=>assert.equal(id,'chain'),()=>false,async()=>({}),()=>{},async()=>({login:async()=>{calls.push(['login']);return {session}}}),()=> 'test',()=>{},{});
  return {calls,run};
}
test('desktop renews identity before sending transaction to a live session',async()=>{
  const {calls,run}=desktop();
  assert.deepEqual(await run({account:'alice',permission:'active',chainId:'chain',provider:'anchor'},[{account:'flon',name:'votealloc',data:{}}]),{transaction_id:'signed'});
  assert.deepEqual(calls.map(call=>call[0]),['login','sign']);
  assert.deepEqual(calls[1][1].actions[0].authorization,[{actor:'alice',permission:'active'}]);
});
test('desktop rejects a different scanned account before requesting a signature',async()=>{
  const {calls,run}=desktop('bob');
  await assert.rejects(run({account:'alice',permission:'active',chainId:'chain'},[]),/ACCOUNT_CHANGED/);
  assert.deepEqual(calls.map(call=>call[0]),['login']);
});
