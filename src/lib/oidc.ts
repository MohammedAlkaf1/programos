import {createHash,createPublicKey,randomBytes,verify as verifySignature} from 'node:crypto';
import {DomainError} from './domain';

/**
 * The OpenID Connect half of single sign on (FR-051).
 *
 * Written against the protocol directly rather than through a library because
 * the checks that matter are few and must be visible: the token is signed by a
 * key the issuer publishes, it was issued for us, it answers the nonce we sent,
 * it has not expired, and the email it carries is marked verified by the
 * identity provider. That last check is the one that prevents account takeover
 * through an address someone merely typed.
 */

type Discovery={issuer:string;authorization_endpoint:string;token_endpoint:string;jwks_uri:string};
const cache=new Map<string,{value:Discovery;at:number}>();
const TTL=10*60000;

export async function discover(issuer:string):Promise<Discovery>{
 const cached=cache.get(issuer);
 if(cached&&Date.now()-cached.at<TTL)return cached.value;
 const base=issuer.replace(/\/$/,'');
 const response=await fetch(`${base}/.well-known/openid-configuration`,{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new DomainError('ssoDiscovery',502);
 const value=await response.json() as Discovery;
 if(value.issuer.replace(/\/$/,'')!==base||!value.authorization_endpoint||!value.token_endpoint||!value.jwks_uri)throw new DomainError('ssoDiscovery',502);
 cache.set(issuer,{value,at:Date.now()});
 return value;
}

const b64url=(b:Buffer)=>b.toString('base64url');
export function pkce(){
 const verifier=b64url(randomBytes(32));
 return {verifier,challenge:b64url(createHash('sha256').update(verifier).digest())};
}

export type IdClaims={sub:string;email:string;email_verified:boolean;name?:string;nonce?:string;aud:string|string[];iss:string;exp:number};

/** Verifies the signature against the issuer keys and then every claim we rely on. */
export async function verifyIdToken(token:string,discovery:Discovery,clientId:string,nonce:string):Promise<IdClaims>{
 const parts=token.split('.');
 if(parts.length!==3)throw new DomainError('ssoToken',401);
 const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')) as {alg:string;kid?:string};
 if(!['RS256','RS384','RS512'].includes(header.alg))throw new DomainError('ssoToken',401);
 const jwks=await (await fetch(discovery.jwks_uri,{signal:AbortSignal.timeout(10000)})).json() as {keys:Record<string,unknown>[]};
 const jwk=jwks.keys.find(k=>!header.kid||k.kid===header.kid);
 if(!jwk)throw new DomainError('ssoToken',401);
 const key=createPublicKey({key:jwk as never,format:'jwk'});
 const algorithm=`RSA-SHA${header.alg.slice(2)}`;
 if(!verifySignature(algorithm,Buffer.from(`${parts[0]}.${parts[1]}`),key,Buffer.from(parts[2],'base64url')))throw new DomainError('ssoToken',401);
 const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')) as IdClaims;
 const audience=Array.isArray(claims.aud)?claims.aud:[claims.aud];
 if(claims.iss.replace(/\/$/,'')!==discovery.issuer.replace(/\/$/,''))throw new DomainError('ssoToken',401);
 if(!audience.includes(clientId))throw new DomainError('ssoToken',401);
 if(claims.nonce!==nonce)throw new DomainError('ssoToken',401);
 if(!claims.exp||claims.exp*1000<Date.now())throw new DomainError('ssoToken',401);
 if(!claims.sub)throw new DomainError('ssoToken',401);
 // No verified email means no match. An unverified claim never binds to an account.
 if(!claims.email||claims.email_verified!==true)throw new DomainError('ssoUnverifiedEmail',403);
 return {...claims,email:claims.email.toLowerCase()};
}

export async function exchangeCode(discovery:Discovery,clientId:string,clientSecret:string,code:string,redirectUri:string,verifier:string){
 const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri,client_id:clientId,client_secret:clientSecret,code_verifier:verifier});
 const response=await fetch(discovery.token_endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new DomainError('ssoExchange',502);
 const payload=await response.json() as {id_token?:string};
 if(!payload.id_token)throw new DomainError('ssoExchange',502);
 return payload.id_token;
}

export const domainOf=(email:string)=>email.split('@')[1]?.toLowerCase()??'';
