import net from 'node:net';
export function canonicalIP(value){
 const raw=String(value||'').replace(/^\[|\]$/g,'');
 if(!net.isIP(raw))return null;
 if(net.isIP(raw)===4)return raw;
 const normalized=new URL(`http://[${raw}]/`).hostname.slice(1,-1);
 const mapped=normalized.match(/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/);
 if(mapped){const n=Number.parseInt(mapped[1],16)*65536+Number.parseInt(mapped[2],16);return [n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.')}
 return normalized;
}
export function nodeBinding(bp){
 if(bp.rpcScope!=='bp')return null;
 const rpc=new URL(bp.rpc),rpcIP=canonicalIP(rpc.hostname),p2p=bp.services?.find(s=>s.id==='p2p'&&s.type==='tcp'),p2pIP=canonicalIP(p2p?.host);
 if(!rpcIP||!p2pIP||rpcIP!==p2pIP)throw Error('专属节点需要同一 IP 的 RPC 与 P2P 地址，不能使用域名或不同 IP');
 if(!Number.isInteger(p2p.port)||p2p.port<1||p2p.port>65535)throw Error('专属节点必须配置有效 P2P 端口');
 return {ip:rpcIP,endpoint:JSON.stringify([rpc.href,p2pIP,p2p.port])};
}
export function foundationEligible(bp,accounts){
 return accounts.some(a=>a.network===bp.network&&a.chainId===bp.chainId&&a.producer===bp.producer);
}
export function validateNodeTopology(bp,configs,accounts){
 const legacy=Boolean(bp.foundationGroup);
 if(legacy&&!/^[a-z0-9][a-z0-9-]{0,63}$/.test(bp.foundationGroup))throw Error('共享节点组 ID 格式无效');
 if(legacy&&!foundationEligible(bp,accounts))throw Error('该账号不在早期基金会白名单内，不能使用共享节点豁免');
 if(legacy&&bp.rpcScope!=='bp')throw Error('基金会共享组必须配置实际节点的 RPC 与 P2P');
 const binding=nodeBinding(bp);if(!binding)return;
 for(const other of configs){
  if(other.id===bp.id)continue;
  let existing;try{existing=nodeBinding(other)}catch{try{existing={ip:canonicalIP(new URL(other.rpc).hostname)}}catch{continue}}
  if(!existing)continue;
  const sameChain=other.network===bp.network&&other.chainId===bp.chainId;
  if(sameChain&&other.producer===bp.producer)throw Error('该 BP 已有专属节点记录，请勿重复绑定');
  const otherLegacy=Boolean(other.foundationGroup)&&foundationEligible(other,accounts);
  if(sameChain&&legacy&&otherLegacy&&other.foundationGroup===bp.foundationGroup&&existing.endpoint!==binding.endpoint)throw Error('同一共享节点组必须使用相同 RPC 与 P2P 地址');
  if(existing.ip===binding.ip&&!(legacy&&otherLegacy))throw Error('第三方节点必须独占 IP；同一 IP 换端口仍属于重复节点');
 }
}
