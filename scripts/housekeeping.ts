/**
 * Daily housekeeping. Every step is idempotent, so running it twice in one
 * day changes nothing. Schedule once a day next to `reminders`.
 *
 *   npm run housekeeping
 *
 * 1. Closes registration when the window has passed (FR-009).
 * 2. Expires unsubmitted drafts 90 days after registration closed (section 17).
 * 3. Deactivates time boxed memberships such as support grants (FR-047).
 * 4. Drops the bytes of expired export files and stale idempotency keys.
 * 5. Lists beneficiaries whose data passed the tenant retention period and
 *    asks an admin to approve or dismiss each deletion (FR-045).
 */
import 'dotenv/config';
import {db} from '../src/lib/db';
const now=new Date(),day=86400000;
const SYSTEM='system';
const summary:Record<string,number>={};
const count=(k:string,n:number)=>{summary[k]=(summary[k]??0)+n;};
try{
 const closing=await db.program.findMany({where:{status:'RegistrationOpen',registrationEnd:{lt:now}}});
 for(const p of closing){await db.$transaction(async tx=>{const r=await tx.program.updateMany({where:{id:p.id,version:p.version},data:{status:'RegistrationClosed',version:{increment:1}}});if(r.count){await tx.audit.create({data:{tenantId:p.tenantId,actorId:SYSTEM,action:'program.transition',entityId:p.id,detail:{from:'RegistrationOpen',to:'RegistrationClosed',reason:'registration window ended'}}});count('registrationClosed',1);}});}

 const stale=await db.application.findMany({where:{status:'Draft',program:{registrationEnd:{lt:new Date(now.getTime()-90*day)}}},select:{id:true,tenantId:true}});
 for(const d of stale){await db.$transaction(async tx=>{await tx.application.update({where:{id:d.id},data:{status:'Expired',version:{increment:1}}});await tx.audit.create({data:{tenantId:d.tenantId,actorId:SYSTEM,action:'application.expire',entityId:d.id,detail:{reason:'draft older than 90 days after registration end'}}});});count('draftsExpired',1);}

 const expired=await db.membership.updateMany({where:{active:true,expiresAt:{lt:now}},data:{active:false}});count('membershipsExpired',expired.count);

 const exports=await db.exportJob.updateMany({where:{expiresAt:{lt:now},bytes:{not:null}},data:{bytes:null,status:'Expired'}});count('exportsExpired',exports.count);
 count('idempotencyKeysDropped',(await db.idempotencyKey.deleteMany({where:{createdAt:{lt:new Date(now.getTime()-day)}}})).count);
 count('authBucketsDropped',(await db.authAttempt.deleteMany({where:{resetAt:{lt:now}}})).count);

 // Retention: the last touch is the newest of profile creation, application update and enrollment completion. Legal holds and live enrollments are never listed.
 for(const tenant of await db.tenant.findMany({where:{status:{in:['Active','Suspended','Closing']}}})){
  const threshold=new Date(now.getTime()-tenant.retentionMonths*30*day);
  const people=await db.beneficiary.findMany({where:{tenantId:tenant.id,status:{notIn:['Anonymized']},legalHold:false,createdAt:{lt:threshold}},include:{applications:{include:{enrollment:true}}}});
  const admins=await db.membership.findMany({where:{tenantId:tenant.id,role:'Admin',active:true},select:{userId:true}});
  for(const b of people){
   if(b.applications.some(a=>a.enrollment&&['Enrolled','InProgress','Suspended'].includes(a.enrollment.status)))continue;
   const last=Math.max(b.createdAt.getTime(),...b.applications.map(a=>a.updatedAt.getTime()),...b.applications.map(a=>a.enrollment?.completedAt?.getTime()??0));
   if(last>=threshold.getTime())continue;
   const existing=await db.deletionCandidate.findUnique({where:{tenantId_beneficiaryId:{tenantId:tenant.id,beneficiaryId:b.id}}});
   if(existing)continue;
   await db.$transaction(async tx=>{await tx.deletionCandidate.create({data:{tenantId:tenant.id,beneficiaryId:b.id,reason:`retention ${tenant.retentionMonths} months`,dueAt:new Date(now.getTime()+7*day)}});for(const m of admins)await tx.notification.create({data:{tenantId:tenant.id,userId:m.userId,titleAr:'قائمة إتلاف جديدة تنتظر اعتمادك',titleEn:'A retention deletion list awaits your approval',href:'/privacy'}});});
   count('deletionCandidates',1);
  }
 }
 console.log('Housekeeping completed',JSON.stringify(summary));
}finally{await db.$disconnect();}
