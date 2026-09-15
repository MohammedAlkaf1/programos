import {NextRequest,NextResponse} from 'next/server';
import {actor} from '@/lib/access';
import {db} from '@/lib/db';
import {DomainError} from '@/lib/domain';
/**
 * Downloads a finished export job. The link is only a job id: permission,
 * tenant, ownership and expiry are all re-checked here, so a link shared by
 * mistake or kept after access was removed returns nothing.
 */
export async function GET(req:NextRequest){try{
 const a=await actor();const jobId=req.nextUrl.searchParams.get('job')??'';
 if(!/^[0-9a-f-]{36}$/.test(jobId))throw new DomainError('invalid');
 const job=await db.exportJob.findFirst({where:{id:jobId,tenantId:a.tenantId}});
 if(!job||(job.userId!==a.userId&&!(a.role==='Admin'&&job.type!=='subject')))throw new DomainError('notFound',404);
 if(job.status!=='Ready'||!job.bytes)return NextResponse.json({status:job.status},{status:job.status==='Failed'?410:202});
 if(job.expiresAt<new Date())throw new DomainError('window',410);
 await db.audit.create({data:{tenantId:a.tenantId,actorId:a.userId,action:'export.download',entityId:job.id,detail:{type:job.type,rows:job.rows},correlationId:a.correlationId}});
 return new NextResponse(Buffer.from(job.bytes),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${job.type}-${job.createdAt.toISOString().slice(0,10)}.csv"`,'cache-control':'no-store','x-content-type-options':'nosniff'}});
 }catch(e){return NextResponse.json({error:e instanceof DomainError?e.code:'server'},{status:e instanceof DomainError?e.status:500});}}
