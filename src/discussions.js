function apiBase(value){return String(value||'').trim().replace(/\/$/,'')}

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
    async list(){const result=await request(base,`/v1/discussions?network=${encodeURIComponent(network)}`,{fetchImpl});return Array.isArray(result)?result:(result.items||[])},
    async create({title,body,actor,proposalId=null}){return request(base,'/v1/discussions',{fetchImpl,method:'POST',body:{network,title,body,actor,proposal_id:proposalId}})}
  };
}
