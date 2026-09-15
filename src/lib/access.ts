import {auth} from '@/auth';
import {cookies,headers} from 'next/headers';
import {randomUUID} from 'node:crypto';
import {db} from './db';
import {DomainError,type Role} from './domain';
export type Actor={userId:string;tenantId:string;role:Role;programIds:string[];name:string;tenantStatus:string;correlationId:string};
const IDLE_MS=30*60000;
export async function actor():Promise<Actor>{
 const session=await auth();if(!session?.user?.id)throw new DomainError('unauthorized',401);
 const user=await db.user.findUnique({where:{id:session.user.id}});if(!user?.active)throw new DomainError('unauthorized',401);
 const requested=(await cookies()).get('programos.tenant')?.value;
 const now=new Date();
 // Support grants and other time boxed memberships expire on their own clock, not when someone remembers to revoke them.
 await db.membership.updateMany({where:{userId:user.id,active:true,expiresAt:{lt:now}},data:{active:false}});
 let membership=await db.membership.findFirst({where:{userId:user.id,active:true,...(requested?{tenantId:requested}:{})},include:{tenant:true}});
 // The tenant cookie can outlive the membership it names. Fall back to any workspace they still belong to.
 if(!membership&&requested)membership=await db.membership.findFirst({where:{userId:user.id,active:true},include:{tenant:true}});
 if(!membership)throw new DomainError('forbidden',403);
 if(membership.role!=='Beneficiary'){
  if(!user.mfaEnabled)throw new DomainError('mfaRequired',403);
  // Staff sessions end after 30 idle minutes (NFR-16). The version bump invalidates the cookie on every device.
  if(user.lastSeenAt&&now.getTime()-user.lastSeenAt.getTime()>IDLE_MS){await db.user.update({where:{id:user.id},data:{sessionVersion:{increment:1},lastSeenAt:null}});throw new DomainError('unauthorized',401);}
  if(!user.lastSeenAt||now.getTime()-user.lastSeenAt.getTime()>60000)await db.user.update({where:{id:user.id},data:{lastSeenAt:now}});
 }
 let correlationId:string=randomUUID();try{const h=(await headers()).get('x-request-id');if(h&&/^[a-zA-Z0-9-]{8,64}$/.test(h))correlationId=h;}catch{}
 return {userId:user.id,tenantId:membership.tenantId,role:membership.role as Role,programIds:membership.programIds,name:user.name,tenantStatus:membership.tenant.status,correlationId};
}
export function requireRole(a:Actor,allowed:Role[]){if(!allowed.includes(a.role))throw new DomainError('forbidden',403);}
export function scope(a:Actor){return {tenantId:a.tenantId,...(['Admin','Beneficiary'].includes(a.role)?{}:{id:{in:a.programIds}})};}
export async function programAccess(a:Actor,id:string){const p=await db.program.findFirst({where:{...scope(a),id,...(!['Admin','Beneficiary'].includes(a.role)?{id:{in:a.programIds.filter(x=>x===id)}}:{})}});if(!p)throw new DomainError('notFound',404);return p;}
