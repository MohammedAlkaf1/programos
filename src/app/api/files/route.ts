import {NextRequest,NextResponse} from 'next/server';
import {actor,programAccess,requireRole} from '@/lib/access';
import {db} from '@/lib/db';
import {fileType,scan} from '@/lib/file-scanner';
import {DomainError} from '@/lib/domain';
export async function POST(req:NextRequest){try{
 if(req.headers.get('origin')!==req.nextUrl.origin&&req.headers.get('origin')!==process.env.APP_URL)throw new DomainError('forbidden',403);
 const a=await actor();requireRole(a,['Beneficiary']);if(a.tenantStatus!=='Active')throw new DomainError('suspended',403);
 if(Number(req.headers.get('content-length')??0)>11*1024*1024)throw new DomainError('invalid',413);
 const form=await req.formData(),file=form.get('file');if(!(file instanceof File)||file.size>10*1024*1024||!file.size)throw new DomainError('invalid',422);
 const p=await programAccess(a,String(form.get('programId')));if(p.status!=='RegistrationOpen'||new Date()<p.registrationStart||new Date()>p.registrationEnd)throw new DomainError('window');
 const bytes=Buffer.from(await file.arrayBuffer()),mime=fileType(bytes,file.name);if(!mime||mime!==file.type)throw new DomainError('invalid',422);const status=await scan(bytes);
 const r=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id=${a.userId} FOR UPDATE`;if(await tx.attachment.count({where:{tenantId:a.tenantId,programId:p.id,userId:a.userId}})>=5)throw new DomainError('capacity',409);const r=await tx.attachment.create({data:{tenantId:a.tenantId,programId:p.id,userId:a.userId,name:file.name.slice(0,120),mime,bytes,size:bytes.length,status}});await tx.audit.create({data:{tenantId:a.tenantId,actorId:a.userId,action:'attachment.upload',entityId:r.id,detail:{status}}});return {id:r.id,name:r.name,status};});return NextResponse.json(r);
 }catch(e){return NextResponse.json({error:e instanceof DomainError?e.code:'server'},{status:e instanceof DomainError?e.status:500});}}
export async function GET(req:NextRequest){try{const a=await actor();const f=await db.attachment.findFirst({where:{id:req.nextUrl.searchParams.get('id')??'',tenantId:a.tenantId}});if(!f)throw new DomainError('notFound',404);await programAccess(a,f.programId);
 if(a.role==='Beneficiary'){if(f.userId!==a.userId)throw new DomainError('notFound',404);}else{requireRole(a,['Admin','Manager','Coordinator','Reviewer']);const app=await db.application.findFirst({where:{tenantId:a.tenantId,programId:f.programId,beneficiary:{userId:f.userId},status:{not:'Draft'},...(a.role==='Reviewer'?{reviewerIds:{has:a.userId}}:{})}});if(!app||!Object.values(app.answers as Record<string,unknown>).some(v=>Array.isArray(v)&&v.includes(f.id)))throw new DomainError('notFound',404);}
 if(f.status!=='Clean')return NextResponse.json({status:f.status},{status:423});return new NextResponse(Buffer.from(f.bytes),{headers:{'content-type':f.mime,'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,'cache-control':'no-store','x-content-type-options':'nosniff'}});
 }catch(e){return NextResponse.json({error:e instanceof DomainError?e.code:'server'},{status:e instanceof DomainError?e.status:500});}}
