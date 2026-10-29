// Sharing probes never merges BP accounting or exposes the private endpoint key.
export function createProbeCache({ttl=25000,now=Date.now}={}){
 const cache=new Map();
 return async(key,probe)=>{
  const time=now(),existing=cache.get(key);
  if(existing&&time-existing.at<ttl)return existing.promise;
  const promise=Promise.resolve().then(probe);cache.set(key,{at:time,promise});
  if(cache.size>512)for(const [id,entry] of cache)if(time-entry.at>=ttl)cache.delete(id);
  try{return await promise}catch(error){if(cache.get(key)?.promise===promise)cache.delete(key);throw error}
 };
}
export const sharedProbe=createProbeCache();
