import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';

/**
 * The signature scheme for everything ProgramOS sends and receives.
 *
 * A header carries `t=<unix seconds>,v1=<hex hmac of "t.body">`. Including the
 * timestamp inside the signed string is what makes a captured request useless
 * later: an attacker cannot move it in time without breaking the signature, and
 * anything outside the tolerance window is refused even when the signature is
 * valid. Replay inside the window is caught separately by the unique
 * (provider, externalId) row on InboundEvent.
 */
export const SIGNATURE_HEADER='x-programos-signature';
export const TOLERANCE_SECONDS=300;

export function newSecret(){return `whsec_${randomBytes(32).toString('hex')}`;}

export function sign(secret:string,body:string,timestamp=Math.floor(Date.now()/1000)){
 const mac=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
 return `t=${timestamp},v1=${mac}`;
}

export type VerifyResult={ok:true}|{ok:false;reason:'malformed'|'stale'|'mismatch'};

export function verify(secret:string,body:string,header:string|null,now=Date.now()):VerifyResult{
 if(!header)return {ok:false,reason:'malformed'};
 const parts=Object.fromEntries(header.split(',').map(p=>p.split('=').map(s=>s.trim()) as [string,string]).filter(p=>p.length===2));
 const timestamp=Number(parts.t),given=parts.v1;
 if(!Number.isFinite(timestamp)||!/^[0-9a-f]{64}$/.test(given??''))return {ok:false,reason:'malformed'};
 if(Math.abs(now/1000-timestamp)>TOLERANCE_SECONDS)return {ok:false,reason:'stale'};
 const expected=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest();
 const candidate=Buffer.from(given,'hex');
 if(expected.length!==candidate.length||!timingSafeEqual(expected,candidate))return {ok:false,reason:'mismatch'};
 return {ok:true};
}
