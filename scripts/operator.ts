/**
 * Platform operator console (FR-001, FR-005, FR-049). These are operator
 * actions, not customer actions, so they live on the command line beside the
 * billing console and never in the tenant UI.
 *
 *   npm run operator -- list
 *   npm run operator -- create <slug> "<nameAr>" "<nameEn>" <adminEmail> "<adminName>"
 *   npm run operator -- suspend <slug> "<reason>"
 *   npm run operator -- resume <slug> "<reason>"
 *   npm run operator -- close <slug> <daysUntilDeletion> "<reason>"
 *   npm run operator -- export <slug> <outputDir>
 *   npm run operator -- purge <slug>          (only after close and once deleteAt has passed)
 */
import 'dotenv/config';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {db} from '../src/lib/db';
import {getState} from '../src/lib/state';
import {stateRows,exportTypes} from '../src/lib/export-rows';
import {csvCell} from '../src/lib/domain';
import type {Actor} from '../src/lib/access';
const [cmd,...args]=process.argv.slice(2);
const OPERATOR='operator';
async function tenant(slug:string){const t=await db.tenant.findUnique({where:{slug}});if(!t)throw new Error(`No tenant with slug ${slug}`);return t;}
async function audit(tenantId:string,action:string,detail:object){await db.audit.create({data:{tenantId,actorId:OPERATOR,action,entityId:tenantId,detail}});}
try{
 if(cmd==='list'){
  for(const t of await db.tenant.findMany({orderBy:{createdAt:'asc'},include:{_count:{select:{memberships:true}}}}))console.log(`${t.slug.padEnd(24)} ${t.status.padEnd(10)} members=${t._count.memberships} retention=${t.retentionMonths}m${t.deleteAt?` deleteAt=${t.deleteAt.toISOString()}`:''}  ${t.nameAr} | ${t.nameEn}`);
 }
 else if(cmd==='create'){
  const [slug,nameAr,nameEn,email,name='مدير المؤسسة']=args;if(!slug||!nameAr||!nameEn||!email)throw new Error('usage: create <slug> <nameAr> <nameEn> <adminEmail> [adminName]');
  if(!/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug))throw new Error('slug must be lowercase letters, digits and hyphens');
  const token=randomBytes(32).toString('hex');
  await db.$transaction(async tx=>{
   const t=await tx.tenant.create({data:{slug,nameAr,nameEn}});
   // The first admin joins through an invitation like everyone else, so the platform never sets a password on their behalf.
   await tx.invitation.create({data:{tenantId:t.id,email:email.toLowerCase(),role:'Admin',tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+7*86400000)}});
   await tx.outbox.create({data:{tenantId:t.id,recipient:email.toLowerCase(),subject:'دعوة لإدارة مساحة العمل · Workspace admin invitation',body:`${process.env.APP_URL??'http://127.0.0.1:3000'}/ar/register?invitation=${token}\n\nالرابط صالح لمدة 7 أيام.`}});
   await tx.audit.create({data:{tenantId:t.id,actorId:OPERATOR,action:'tenant.create',entityId:t.id,detail:{slug,admin:email}}});
   console.log(`Created ${slug} (${t.id}). Invitation queued to ${email}; run npm run mail:send to deliver it.`);
  });
 }
 else if(cmd==='suspend'||cmd==='resume'){
  const [slug,reason='']=args;const t=await tenant(slug);const status=cmd==='suspend'?'Suspended':'Active';
  await db.tenant.update({where:{id:t.id},data:{status,deleteAt:null}});await audit(t.id,`tenant.${cmd}`,{reason});console.log(`${slug} is now ${status}`);
 }
 else if(cmd==='close'){
  const [slug,days='30',reason='']=args;const t=await tenant(slug);const deleteAt=new Date(Date.now()+Number(days)*86400000);
  await db.tenant.update({where:{id:t.id},data:{status:'Closing',deleteAt}});await audit(t.id,'tenant.close',{reason,deleteAt});
  console.log(`${slug} is Closing. Data stays readable and exportable until ${deleteAt.toISOString()}; run export before purge.`);
 }
 else if(cmd==='export'){
  const [slug,dir='exports']=args;const t=await tenant(slug);const out=path.resolve(dir,`${slug}-${new Date().toISOString().slice(0,10)}`);mkdirSync(out,{recursive:true});
  const a:Actor={userId:OPERATOR,tenantId:t.id,role:'Admin',programIds:[],name:OPERATOR,tenantStatus:t.status,correlationId:randomBytes(8).toString('hex')};
  const state=await getState(a);
  for(const type of exportTypes){if(type==='subject')continue;const rows=stateRows(type,state,true);writeFileSync(path.join(out,`${type}.csv`),'﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'utf8');console.log(`${type}.csv  ${rows.length-1} rows`);}
  writeFileSync(path.join(out,'audit.json'),JSON.stringify(await db.audit.findMany({where:{tenantId:t.id},orderBy:{createdAt:'asc'}}),null,1),'utf8');
  await audit(t.id,'tenant.exportAll',{dir:out});console.log(`Written to ${out}`);
 }
 else if(cmd==='purge'){
  const [slug]=args;const t=await tenant(slug);
  if(t.status!=='Closing'||!t.deleteAt||t.deleteAt>new Date())throw new Error('purge is only allowed for a Closing tenant whose deleteAt has passed');
  await db.$transaction(async tx=>{
   const where={tenantId:t.id};
   await tx.measurement.deleteMany({where});await tx.attendance.deleteMany({where});await tx.enrollment.deleteMany({where});await tx.evaluation.deleteMany({where});await tx.applicationRevision.deleteMany({where});await tx.operationalNote.deleteMany({where});await tx.consentRecord.deleteMany({where});await tx.application.deleteMany({where});await tx.attachment.deleteMany({where});await tx.indicator.deleteMany({where});await tx.activity.deleteMany({where});await tx.program.deleteMany({where});await tx.initiative.deleteMany({where});await tx.beneficiary.deleteMany({where});await tx.notification.deleteMany({where});await tx.outbox.deleteMany({where});await tx.exportJob.deleteMany({where});await tx.privacyRequest.deleteMany({where});await tx.reportSnapshot.deleteMany({where});await tx.deletionCandidate.deleteMany({where});await tx.invitation.deleteMany({where});await tx.membership.deleteMany({where});
   await tx.tenant.update({where:{id:t.id},data:{status:'Closed',nameAr:'جهة محذوفة',nameEn:'Deleted organization'}});
   // The audit trail and tombstones stay: they are the proof the deletion happened.
   await tx.audit.create({data:{tenantId:t.id,actorId:OPERATOR,action:'tenant.purge',entityId:t.id,detail:{slug}}});
  });
  console.log(`${slug} purged. Audit records and deletion tombstones were kept.`);
 }
 else{console.log('commands: list | create | suspend | resume | close | export | purge');process.exitCode=1;}
}finally{await db.$disconnect();}
