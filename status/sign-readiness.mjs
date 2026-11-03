// Operator-side utility: never upload the private-key file to the status service.
import {readFile} from 'node:fs/promises';
import {publicKeyForSecret,secretFromFileText,signReadiness} from './bls-readiness.mjs';
import {challengeMessage} from './finalizer-service.mjs';
const args=process.argv.slice(2),challengeFile=args[args.indexOf('--challenge')+1],keyFile=args[args.indexOf('--key-file')+1];
if(!args.includes('--challenge')||!args.includes('--key-file')||!challengeFile||!keyFile)throw Error('Usage: node sign-readiness.mjs --challenge challenge.json --key-file /private/key-file');
const challenge=JSON.parse(await readFile(challengeFile,'utf8'));
if(!challenge.payload||!Number.isFinite(Date.parse(challenge.payload.expires_at))||!Number.isFinite(Date.parse(challenge.payload.issued_at))||!['mainnet','testnet'].includes(challenge.payload.network)||!/^[a-f0-9]{64}$/.test(challenge.payload.chain_id||'')||!/^[a-z1-5.]{1,12}$/.test(challenge.payload.account||'')||!Number.isSafeInteger(challenge.payload.block_num)||challenge.payload.block_num<1||!/^[a-f0-9]{64}$/.test(challenge.payload.block_id||'')||challenge.message!==challengeMessage(challenge.payload)||challenge.payload.domain!=='fullon.finalizer.readiness.v1'||Date.now()>=Date.parse(challenge.payload.expires_at)||Date.parse(challenge.payload.expires_at)-Date.parse(challenge.payload.issued_at)>600000)throw Error('Invalid or expired readiness challenge');
const secret=secretFromFileText(await readFile(keyFile,'utf8'));
try{
 if(publicKeyForSecret(secret)!==challenge.payload.public_key)throw Error('Private key does not match challenge public key');
 process.stderr.write(`Readiness proof only: ${challenge.payload.network} / ${challenge.payload.account}, block ${challenge.payload.block_num}, expires ${challenge.payload.expires_at}\n`);
 process.stdout.write(JSON.stringify({challenge_id:challenge.id,signature:signReadiness(secret,challenge.message)})+'\n');
}finally{secret.fill(0)}
