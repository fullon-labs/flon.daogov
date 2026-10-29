const form=document.getElementById('form'),output=document.getElementById('result');
let foundation=[];
async function list(){
 const r=await fetch('/api/configs');if(!r.ok)throw Error('无法读取配置');const data=await r.json();foundation=data.foundation_accounts||[];
 document.getElementById('foundation-count').textContent='已固定 '+foundation.length+' 个基金会账号，不随排班自动增加';
 document.getElementById('foundation-accounts').replaceChildren(...foundation.map(a=>{const option=document.createElement('option');option.value=a.producer;option.label=a.network;return option}));
 const ul=document.createElement('ul');
 for(const bp of data.bps){
  const li=document.createElement('li');li.textContent=`${bp.label} · ${bp.network} · ${bp.producer||'尚未配置'} · ${bp.id} · ${bp.foundationGroup?'基金会共享组 '+bp.foundationGroup:bp.rpcScope==='bp'?'第三方独立 IP':'公共 RPC 观察'} · ${bp.admission?.mode==='long_term'?'已验证 BP · 长期观察':'临时观察 · 到期 '+(bp.admission?.expires_at||'未知')}`;
  const info=document.createElement('small'),peer=bp.services?.find(s=>s.id==='p2p');info.textContent=' RPC '+bp.rpc+' · P2P '+(peer?.host||'—')+':'+(peer?.port||'—');li.append(document.createElement('br'),info);ul.append(li);
 }
 document.getElementById('list').replaceChildren(ul);
}
form.onsubmit=async e=>{
 e.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;output.textContent='正在保存和探测…';
 try{const r=await fetch('/api/bps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const d=await r.json();if(!r.ok)throw Error(d.error);output.textContent='已保存 '+(d.ids?.length||1)+' 个 BP · '+(d.admission?.mode==='long_term'?'长期观察':'临时观察，到期 '+d.admission?.expires_at);await list()}catch(e){output.textContent=e.message}finally{button.disabled=false}
};
document.getElementById('use-foundation-list').onclick=()=>{
 const accounts=foundation.filter(a=>a.network===form.elements.network.value);if(!accounts.length){output.textContent='此网络没有基金会白名单';return}
 form.elements.producer.value=accounts[0].producer;form.elements.chainId.value=accounts[0].chainId;form.elements.foundationAccounts.value=accounts.slice(1).map(a=>a.producer).join('\n');form.elements.foundationGroup.value||='foundation-node-1';form.elements.rpcScope.value='bp';output.textContent='已填入 '+accounts.length+' 个账号，请填写它们实际共用的 RPC / P2P 地址。';
};
await list();
