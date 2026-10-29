import {DatabaseSync} from 'node:sqlite';
import {mkdir,chmod,readFile} from 'node:fs/promises';
import path from 'node:path';
import {targetKey,retentionKey,TEMPORARY_MS} from './admission.mjs';
import {foundationEligible,validateNodeTopology} from './node-policy.mjs';
export async function openStore(directory){
 await mkdir(directory,{recursive:true,mode:0o700});
 const filename=path.join(directory,'status.sqlite');
 const db=new DatabaseSync(filename);await chmod(filename,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS foundation_accounts(network TEXT NOT NULL,chain_id TEXT NOT NULL,producer TEXT NOT NULL,PRIMARY KEY(network,chain_id,producer));
 CREATE TABLE IF NOT EXISTS trials(endpoint_key TEXT PRIMARY KEY, first_seen INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS targets(target_key TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, deadline INTEGER, verified INTEGER NOT NULL DEFAULT 0, reason TEXT NOT NULL DEFAULT 'unverified');
 CREATE TABLE IF NOT EXISTS bp_configs(id TEXT PRIMARY KEY, config TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS samples(bp_id TEXT NOT NULL, at INTEGER NOT NULL, service_id TEXT NOT NULL, status TEXT NOT NULL, latency_ms REAL, PRIMARY KEY(bp_id,at,service_id));
 CREATE INDEX IF NOT EXISTS samples_bp_time ON samples(bp_id,at);
 CREATE TABLE IF NOT EXISTS migrations(id TEXT PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS incidents(bp_id TEXT NOT NULL, kind TEXT NOT NULL, position INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(bp_id,kind,position));`);
 const insert=db.prepare('INSERT OR IGNORE INTO samples VALUES (?,?,?,?,?)');
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{fn();db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}
 function persist(bp){
  const key=targetKey(bp);
  const oldest=db.prepare('SELECT MIN(at) AS at FROM samples WHERE bp_id=?').get(bp.id).at;
  let first=Math.min(Date.now(),oldest??Date.now());
  db.prepare('INSERT OR IGNORE INTO trials VALUES (?,?)').run(retentionKey(bp),first);
  first=db.prepare('SELECT first_seen FROM trials WHERE endpoint_key=?').get(retentionKey(bp)).first_seen;
  db.prepare('INSERT OR IGNORE INTO targets(target_key,first_seen,deadline) VALUES (?,?,?)').run(key,first,first+TEMPORARY_MS);
  const old=db.prepare('SELECT config FROM bp_configs WHERE id=?').get(bp.id);
  // Preserve existing history only when the target identity is unchanged.
  const identity=c=>JSON.stringify([c.network,c.chainId,c.producer,c.rpc,c.referenceRpc,c.services]);
  if(old&&identity(JSON.parse(old.config))!==identity(bp))db.prepare('DELETE FROM samples WHERE bp_id=?').run(bp.id);
  db.prepare('INSERT OR REPLACE INTO bp_configs VALUES (?,?)').run(bp.id,JSON.stringify(bp));
  db.prepare('DELETE FROM incidents WHERE bp_id=?').run(bp.id);
  const event=db.prepare('INSERT INTO incidents VALUES (?,?,?,?)');
  for(const kind of ['incidents','maintenance'])for(const [i,value] of (bp[kind]||[]).entries())event.run(bp.id,kind,i,JSON.stringify(value));
 }
 const configs=()=>db.prepare('SELECT config FROM bp_configs ORDER BY rowid').all().map(r=>JSON.parse(r.config));
 const foundationAccounts=()=>db.prepare('SELECT network,chain_id AS chainId,producer FROM foundation_accounts ORDER BY producer').all();
 function saveMany(bps){transaction(()=>{const all=configs();const ids=new Set();for(const bp of bps){if(ids.has(bp.id))throw Error('重复记录 ID');ids.add(bp.id);validateNodeTopology(bp,[...all.filter(c=>c.id!==bp.id),...bps.filter(c=>c.id!==bp.id)],foundationAccounts())}for(const bp of bps)persist(bp)})}
 const save=bp=>saveMany([bp]);
 return {
  save,saveMany,foundationAccounts,
  foundationEligible(bp){return foundationEligible(bp,foundationAccounts())},
  validateTopology(bp){return validateNodeTopology(bp,configs(),foundationAccounts())},
  setFoundationAccounts(accounts){
   if(!Array.isArray(accounts)||accounts.some(a=>!['mainnet','testnet'].includes(a.network)||!/^[a-f0-9]{64}$/.test(a.chainId)||!/^[a-z1-5.]{1,12}$/.test(a.producer)))throw Error('Invalid foundation whitelist');
   transaction(()=>{db.exec('DELETE FROM foundation_accounts');const insert=db.prepare('INSERT OR IGNORE INTO foundation_accounts VALUES (?,?,?)');for(const a of accounts)insert.run(a.network,a.chainId,a.producer)});
  },
  admission(bp,now=Date.now()){
   const r=db.prepare('SELECT * FROM targets WHERE target_key=?').get(targetKey(bp));
   return r?{mode:r.verified?'long_term':'temporary',reason:r.reason,expires_at:r.deadline===null?null:new Date(r.deadline).toISOString(),expired:r.deadline!==null&&r.deadline<=now}: {mode:'temporary',expired:true};
  },
  verify(bp,result,now=Date.now()){
   const key=targetKey(bp),r=db.prepare('SELECT * FROM targets WHERE target_key=?').get(key);
   if(!r)return;
   // Expired trials cannot renew; independently verified BP bindings may be admitted.
   if(r.deadline!==null&&r.deadline<=now&&!result.verified)return;
   const deadline=result.verified?null:r.verified?now+TEMPORARY_MS:r.deadline;
   db.prepare('UPDATE targets SET deadline=?,verified=?,reason=? WHERE target_key=?').run(deadline,result.verified?1:0,result.reason,key);
  },
  purge(bp){transaction(()=>{db.prepare('DELETE FROM samples WHERE bp_id=?').run(bp.id);db.prepare('DELETE FROM incidents WHERE bp_id=?').run(bp.id);db.prepare('DELETE FROM bp_configs WHERE id=?').run(bp.id)})},
  seed(bps){for(const bp of bps)if(!db.prepare('SELECT id FROM bp_configs WHERE id=?').get(bp.id))save(bp)},
  registerExisting(){transaction(()=>{for(const bp of configs())persist(bp)})},
  configs(){return db.prepare('SELECT config FROM bp_configs ORDER BY rowid').all().map(r=>JSON.parse(r.config))},
  async migrate(bp){const key='json:'+bp; if(db.prepare('SELECT id FROM migrations WHERE id=?').get(key))return;
   const rows=await readFile(path.join(directory,bp,'samples.json'),'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return [];throw e});
   transaction(()=>{for(const r of rows)insert.run(bp,r.at,r.id,r.status,r.latency_ms??null);db.prepare('INSERT INTO migrations VALUES (?)').run(key)})},
  append(bp,rows){const cfg=db.prepare('SELECT config FROM bp_configs WHERE id=?').get(bp);if(!cfg||this.admission(JSON.parse(cfg.config)).expired)return;transaction(()=>{for(const r of rows)insert.run(bp,r.at,r.id,r.status,r.latency_ms??null);db.prepare('DELETE FROM samples WHERE bp_id=? AND at<?').run(bp,Date.now()-90*86400000)})},
  history(bp){return db.prepare('SELECT at,service_id AS id,status,latency_ms FROM samples WHERE bp_id=? AND at>? ORDER BY at').all(bp,Date.now()-90*86400000)},
  close(){db.close()}
 };
}
