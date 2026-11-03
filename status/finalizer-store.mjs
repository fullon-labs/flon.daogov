import {DatabaseSync} from 'node:sqlite';
import {chmod} from 'node:fs/promises';
export async function openFinalizerStore(file){
 const db=new DatabaseSync(file);await chmod(file,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS readiness_challenges(id TEXT PRIMARY KEY,network TEXT NOT NULL,account TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,payload TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS readiness_expiry ON readiness_challenges(expires);
 CREATE TABLE IF NOT EXISTS readiness_proofs(network TEXT NOT NULL,account TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(network,account));
 CREATE TABLE IF NOT EXISTS verified_votes(network TEXT NOT NULL,account TEXT NOT NULL,block_num INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(network,account));`);
 return {
  getChallenge(id){const row=db.prepare('SELECT payload,used FROM readiness_challenges WHERE id=?').get(id);return row?{...JSON.parse(row.payload),used:Boolean(row.used)}:null},
  existing(network,account,now){const row=db.prepare('SELECT payload FROM readiness_challenges WHERE network=? AND account=? AND used=0 AND expires>? ORDER BY expires DESC LIMIT 1').get(network,account,now);return row?JSON.parse(row.payload):null},
  issue(c,now){db.prepare('DELETE FROM readiness_challenges WHERE expires<=?').run(now);const count=db.prepare('SELECT COUNT(*) AS n FROM readiness_challenges').get().n;if(count>=200)throw Error('CHALLENGE_CAPACITY');db.prepare('INSERT INTO readiness_challenges(id,network,account,expires,payload) VALUES (?,?,?,?,?)').run(c.id,c.payload.network,c.payload.account,Date.parse(c.payload.expires_at),JSON.stringify(c))},
  publish(c,proof){db.exec('BEGIN IMMEDIATE');try{if(!db.prepare('UPDATE readiness_challenges SET used=1 WHERE id=? AND used=0').run(c.id).changes)throw Error('CHALLENGE_ALREADY_USED');db.prepare('INSERT OR REPLACE INTO readiness_proofs VALUES (?,?,?)').run(c.payload.network,c.payload.account,JSON.stringify(proof));db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}},
  proof(network,account){const row=db.prepare('SELECT payload FROM readiness_proofs WHERE network=? AND account=?').get(network,account);return row?JSON.parse(row.payload):null},
  vote(network,account,value){if(value)db.prepare('INSERT INTO verified_votes VALUES (?,?,?,?) ON CONFLICT(network,account) DO UPDATE SET block_num=excluded.block_num,payload=excluded.payload WHERE excluded.block_num>=verified_votes.block_num').run(network,account,value.voted_for_block_num,JSON.stringify(value));const row=db.prepare('SELECT payload FROM verified_votes WHERE network=? AND account=?').get(network,account);return row?JSON.parse(row.payload):null},
  close(){db.close()}
 };
}
