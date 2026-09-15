import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {db} from './db';
import {DomainError,type Role} from './domain';
import type {Actor} from './access';

/**
 * Credentials for the public API.
 *
 * A key is `pos_<prefix>_<secret>`. The prefix identifies the row so lookup is
 * a single indexed read, and only the SHA-256 of the whole token is stored, so
 * a database copy cannot be replayed against the API. Revoking sets a timestamp
 * rather than deleting: the audit trail must still be able to name the key that
 * made a call last month.
 */

export const scopes=['programs:read','applications:read','applications:write','beneficiaries:read','attendance:write','impact:read','impact:write','reports:read','events:read'] as const;
export type Scope=typeof scopes[number];

/** What a key may do is capped by a role, so the API can never exceed the UI. */
const SCOPE_ROLE:Record<Scope,Role>={
 'programs:read':'Viewer','applications:read':'Coordinator','applications:write':'Manager','beneficiaries:read':'Coordinator',
 'attendance:write':'Coordinator','impact:read':'Impact','impact:write':'Impact','reports:read':'Viewer','events:read':'Viewer',
};

export function issue(){
 const prefix=randomBytes(6).toString('hex');
 const secret=randomBytes(32).toString('hex');
 const token=`pos_${prefix}_${secret}`;
 return {prefix,token,tokenHash:createHash('sha256').update(token).digest('hex')};
}

const digest=(token:string)=>createHash('sha256').update(token).digest('hex');

/**
 * Resolves a bearer token to an actor. Returns null for anything unusable so
 * the caller answers 401 without revealing which part was wrong.
 */
export async function actorForKey(token:string):Promise<{actor:Actor;keyId:string;scopes:string[]}|null>{
 const match=/^pos_([0-9a-f]{12})_([0-9a-f]{64})$/.exec(token.trim());
 if(!match)return null;
 const key=await db.apiKey.findUnique({where:{prefix:match[1]}});
 if(!key||key.revokedAt||(key.expiresAt&&key.expiresAt<new Date()))return null;
 const expected=Buffer.from(key.tokenHash,'hex'),given=Buffer.from(digest(token),'hex');
 if(expected.length!==given.length||!timingSafeEqual(expected,given))return null;
 const tenant=await db.tenant.findUnique({where:{id:key.tenantId}});
 if(!tenant||!['Active','Closing'].includes(tenant.status))return null;
 // The key acts as the least privileged role that covers all of its scopes.
 const roles=key.scopes.map(s=>SCOPE_ROLE[s as Scope]).filter(Boolean);
 const role:Role=roles.includes('Manager')?'Manager':roles.includes('Coordinator')?'Coordinator':roles.includes('Impact')?'Impact':'Viewer';
 const programIds=(await db.program.findMany({where:{tenantId:key.tenantId},select:{id:true}})).map(p=>p.id);
 await db.apiKey.update({where:{id:key.id},data:{lastUsedAt:new Date()}});
 return {keyId:key.id,scopes:key.scopes,actor:{userId:`apikey:${key.id}`,tenantId:key.tenantId,role,programIds,name:key.name,tenantStatus:tenant.status,correlationId:randomBytes(8).toString('hex')}};
}

export function requireScope(held:string[],needed:Scope){
 if(!held.includes(needed))throw new DomainError('forbidden',403);
}
