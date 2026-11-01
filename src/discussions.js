import {accountExplorerUrl} from './explorer.js';

function apiBase(value){return String(value||'').trim().replace(/\/$/,'')}

const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const attributionPattern=/((?:Submitted|Replied) through FullOn DAO by )(?:FLON account )?`?([a-z1-5.]{1,12})`?(\.)/g;

export function renderDiscussionBody(bodyText,network='testnet'){
  const text=String(bodyText||'');let cursor=0,html='',match;
  while((match=attributionPattern.exec(text))){
    html+=escapeHtml(text.slice(cursor,match.index))+escapeHtml(match[1]);
    const url=accountExplorerUrl(network,match[2]);
    html+=url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[2])}</a>`:escapeHtml(match[2]);
    html+=escapeHtml(match[3]);cursor=match.index+match[0].length;
  }
  return `${html}${escapeHtml(text.slice(cursor))}`.replace(/\n/g,'<br>');
}

async function request(base,path,{fetchImpl=fetch,method='GET',body}={}){
  if(!apiBase(base))throw new Error('DISCUSSIONS_API_NOT_CONFIGURED');
  const response=await fetchImpl(`${apiBase(base)}${path}`,{
    method,credentials:'include',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!response.ok){const payload=await response.json().catch(()=>null);throw new Error(payload?.error||`DISCUSSIONS_API_${response.status}`)}
  return response.json();
}

export function createDiscussionsClient({baseUrl,fetchImpl=fetch,network='testnet'}={}){
  const base=apiBase(baseUrl);
  return {
    configured:Boolean(base),
    async session(){return request(base,'/v1/session',{fetchImpl})},
    async list(actor=''){const result=await request(base,`/v1/discussions?network=${encodeURIComponent(network)}&actor=${encodeURIComponent(actor)}`,{fetchImpl});return Array.isArray(result)?result:(result.items||[])},
    async detail(number,actor=''){return request(base,`/v1/discussions/${Number(number)}?network=${encodeURIComponent(network)}&actor=${encodeURIComponent(actor)}`,{fetchImpl})},
    async vote(number,{actor,vote,commentId=''}){const target=commentId?`/comments/${encodeURIComponent(commentId)}`:'';return request(base,`/v1/discussions/${Number(number)}${target}/vote`,{fetchImpl,method:'PUT',body:{network,actor,vote}})},
    async react(number,{actor,emoji,active=true,commentId=''}){const target=commentId?`/comments/${encodeURIComponent(commentId)}`:'';return request(base,`/v1/discussions/${Number(number)}${target}/reactions/${encodeURIComponent(emoji)}`,{fetchImpl,method:'PUT',body:{network,actor,active}})},
    async reply(number,{body,actor}){return request(base,`/v1/discussions/${Number(number)}/comments`,{fetchImpl,method:'POST',body:{network,body,actor}})},
    async create({title,body,actor,proposalId=null}){return request(base,'/v1/discussions',{fetchImpl,method:'POST',body:{network,title,body,actor,proposal_id:proposalId}})}
  };
}
