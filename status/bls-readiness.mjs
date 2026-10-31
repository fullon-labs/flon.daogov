import {createHash,timingSafeEqual} from 'node:crypto';
import {bls12_381 as curve} from '@noble/curves/bls12-381.js';
export const BLS_DST='BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_';
export function decodeBLS(text,prefix,length){
 if(typeof text!=='string'||!text.startsWith(prefix))throw Error('INVALID_BLS_ENCODING');
 const encoded=text.slice(prefix.length);if(!/^[A-Za-z0-9_-]+={0,2}$/.test(encoded))throw Error('INVALID_BLS_ENCODING');
 const bytes=Buffer.from(encoded,'base64url');if(bytes.length!==length+4||bytes.toString('base64url')!==encoded.replace(/=+$/,''))throw Error('INVALID_BLS_LENGTH');
 const data=bytes.subarray(0,length),check=createHash('ripemd160').update(data).digest().subarray(0,4);
 if(!timingSafeEqual(check,bytes.subarray(length)))throw Error('INVALID_BLS_CHECKSUM');return data;
}
export function encodeBLS(data,prefix){return prefix+Buffer.concat([data,createHash('ripemd160').update(data).digest().subarray(0,4)]).toString('base64url')}
const integer=bytes=>BigInt('0x'+Buffer.from(bytes).reverse().toString('hex'));
const field=bytes=>{const n=integer(bytes);if(n>=curve.fields.Fp.ORDER)throw Error('INVALID_BLS_FIELD');return n};
const le=(n,size=48)=>Buffer.from(n.toString(16).padStart(size*2,'0'),'hex').reverse();
function publicPoint(text){const b=decodeBLS(text,'PUB_BLS_',96),p=curve.G1.Point.fromAffine({x:field(b.subarray(0,48)),y:field(b.subarray(48))});p.assertValidity();if(p.is0())throw Error('IDENTITY_KEY');return p}
function signaturePoint(text){const b=decodeBLS(text,'SIG_BLS_',192),p=curve.G2.Point.fromAffine({x:{c0:field(b.subarray(0,48)),c1:field(b.subarray(48,96))},y:{c0:field(b.subarray(96,144)),c1:field(b.subarray(144))}});p.assertValidity();if(p.is0())throw Error('IDENTITY_SIGNATURE');return p}
export function verifyBLS(publicKey,message,signature){
 try{return curve.longSignatures.verify(signaturePoint(signature),curve.longSignatures.hash(Buffer.from(message,'utf8'),BLS_DST),publicPoint(publicKey))}catch{return false}
}
// Used only by the operator-side CLI and test fixtures. Never exposed by HTTP.
export function publicKeyForSecret(secret){const p=curve.longSignatures.getPublicKey(secret).toAffine();return encodeBLS(Buffer.concat([le(p.x),le(p.y)]),'PUB_BLS_')}
export function signReadiness(secret,message){
 if(!message.startsWith('FULLON_FINALIZER_READINESS_V1\n'))throw Error('WRONG_SIGNING_DOMAIN');
 const p=curve.longSignatures.sign(curve.longSignatures.hash(Buffer.from(message,'utf8'),BLS_DST),secret).toAffine();
 return encodeBLS(Buffer.concat([le(p.x.c0),le(p.x.c1),le(p.y.c0),le(p.y.c1)]),'SIG_BLS_');
}
export function secretFromFileText(text){return Uint8Array.from(decodeBLS(text.trim(),'PVT_BLS_',32)).reverse()}
