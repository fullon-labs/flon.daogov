export function normalizeConfig(raw){
 const entries=raw.bps??[{...raw,id:raw.id||'default',label:raw.label||raw.producer||'Block producer'}];
 if(!Array.isArray(entries)||(!entries.length&&!raw.discovery?.length))throw Error('Configure at least one BP or discovery network');
 const seen=new Set();
 const bps=entries.map(bp=>{
  if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(bp.id)||seen.has(bp.id))throw Error('BP IDs must be unique safe slugs');
  seen.add(bp.id);
  return {...bp,title:raw.title||'FULLON Status',label:bp.label||bp.producer||bp.id,intervalSeconds:bp.intervalSeconds??raw.intervalSeconds??30};
 });
 const defaultBp=raw.defaultBp||bps[0]?.id;
 if(defaultBp&&!seen.has(defaultBp))throw Error('defaultBp must identify a configured BP');
 return {title:raw.title||'FULLON Status',publicOrigin:raw.publicOrigin||'https://status.flon.network',defaultBp,bps};
}
