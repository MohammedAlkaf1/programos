import {z} from 'zod';
import {createHash,randomBytes} from 'node:crypto';
import {db} from './db';
import {programAccess,requireRole,type Actor} from './access';
import {DomainError,FORMULA_VERSION,csvCell} from './domain';
import {getState} from './state';
import {eraseBeneficiary} from './erasure';
import {exportRoles,exportTypes,stateRows,subjectRows} from './export-rows';
import {integrationCommand} from './integration-commands';
import {emit} from './events';

const id=z.string().uuid(),reason=z.string().trim().min(3).max(2000);
const EXPORT_TTL_MS=15*60000;
export async function extendedCommand(a:Actor,action:string,data:Record<string,unknown>){
 const audit=(tx:any,entityId:string,detail:object={})=>tx.audit.create({data:{tenantId:a.tenantId,actorId:a.userId,action,entityId,detail,correlationId:a.correlationId}});
 const inbox=(tx:any,userId:string,titleAr:string,titleEn:string,href:string)=>tx.notification.create({data:{tenantId:a.tenantId,userId,titleAr,titleEn,href}});
 switch(action){
 case 'beneficiary.hold':{
  requireRole(a,['Admin']);const x=z.object({id,legalHold:z.boolean(),reason}).parse(data);
  return db.$transaction(async tx=>{const r=await tx.beneficiary.updateMany({where:{id:x.id,tenantId:a.tenantId},data:{legalHold:x.legalHold}});if(!r.count)throw new DomainError('notFound',404);await audit(tx,x.id,{legalHold:x.legalHold,reason:x.reason});return {ok:true};});
 }
 case 'privacy.fulfil':{
  requireRole(a,['Admin']);const x=z.object({id,reason,changes:z.object({name:z.string().trim().min(2).max(120).optional(),phone:z.string().trim().regex(/^\+[1-9]\d{6,14}$/).optional().or(z.literal(''))}).optional()}).parse(data);
  const request=await db.privacyRequest.findFirst({where:{id:x.id,tenantId:a.tenantId,status:'InProgress'}});if(!request)throw new DomainError('conflict',409);
  return db.$transaction(async tx=>{
   const b=await tx.beneficiary.findUnique({where:{tenantId_userId:{tenantId:a.tenantId,userId:request.userId}}});
   let detail:object={type:request.type,reason:x.reason};
   if(request.type==='Erasure'){if(b)detail={...detail,...await eraseBeneficiary(tx,a.tenantId,b.id,a.userId,x.reason)};}
   else if(request.type==='WithdrawConsent'){
    // Withdrawing consent stops further processing: open applications are withdrawn and the consent records are closed, but the profile itself stays until an erasure request or the retention clock removes it.
    if(b){await tx.consentRecord.updateMany({where:{tenantId:a.tenantId,beneficiaryId:b.id,withdrawnAt:null},data:{withdrawnAt:new Date()}});await tx.application.updateMany({where:{tenantId:a.tenantId,beneficiaryId:b.id,status:{in:['Draft','Submitted','NeedsInfo','UnderReview','Waitlisted']}},data:{status:'Withdrawn',version:{increment:1}}});await tx.beneficiary.update({where:{id:b.id},data:{status:'Archived'}});}
   }
   else if(request.type==='Correction'){
    if(!b||!x.changes||!Object.keys(x.changes).length)throw new DomainError('invalid');
    const before={name:b.name,phone:b.phone};await tx.beneficiary.update({where:{id:b.id},data:{...(x.changes.name?{name:x.changes.name}:{}),...(x.changes.phone!==undefined?{phone:x.changes.phone||null}:{})}});detail={...detail,before,after:x.changes};
   }
   else{
    // Access and Copy: a CSV package of everything held about the person, delivered through an export job the requester downloads after signing in.
    const rows=await subjectRows(a,request.userId,true);const body=Buffer.from('﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'utf8');
    const job=await tx.exportJob.create({data:{tenantId:a.tenantId,userId:request.userId,type:'subject',status:'Ready',filters:{requestId:request.id},rows:rows.length-1,bytes:body,expiresAt:new Date(Date.now()+7*86400000),completedAt:new Date()}});detail={...detail,jobId:job.id,rows:rows.length-1};
    await inbox(tx,request.userId,'نسخة بياناتك جاهزة للتنزيل','Your data copy is ready to download','/privacy');
   }
   await tx.privacyRequest.update({where:{id:request.id},data:{status:'Fulfilled',reason:x.reason,fulfilledAt:new Date()}});await audit(tx,request.id,detail);
   await emit(tx,a.tenantId,a.userId,'privacy.request_fulfilled',request.id,{requestId:request.id,requestType:request.type});
   if(request.type!=='Erasure')await inbox(tx,request.userId,'تم تنفيذ طلب الخصوصية','Your privacy request was fulfilled','/privacy');
   return {ok:true};
  });
 }
 case 'program.update':{
  requireRole(a,['Admin','Manager']);const x=z.object({programId:id,version:z.number().int(),capacity:z.coerce.number().int().min(1).max(100000),nameAr:reason,nameEn:reason,registrationEnd:z.coerce.date().optional(),endsAt:z.coerce.date().optional(),reason}).parse(data);const p=await programAccess(a,x.programId);if(['Completed','Archived','Cancelled'].includes(p.status))throw new DomainError('conflict',409);
  const registrationEnd=x.registrationEnd??p.registrationEnd,endsAt=x.endsAt??p.endsAt;if(registrationEnd<=p.registrationStart||registrationEnd>p.startsAt||endsAt<=p.startsAt)throw new DomainError('invalid');
  return db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Program" WHERE id=${p.id} FOR UPDATE`;const occupied=await tx.enrollment.count({where:{tenantId:a.tenantId,application:{programId:p.id},status:{notIn:['Withdrawn','Cancelled']}}});if(x.capacity<occupied)throw new DomainError('capacity',409);
   if(endsAt<p.endsAt&&await tx.activity.count({where:{programId:p.id,status:'Scheduled',endsAt:{gt:endsAt}}}))throw new DomainError('pending',409);
   const r=await tx.program.updateMany({where:{id:p.id,version:x.version},data:{capacity:x.capacity,nameAr:x.nameAr,nameEn:x.nameEn,registrationEnd,endsAt,version:{increment:1}}});if(!r.count)throw new DomainError('conflict',409);
   const before={capacity:p.capacity,nameAr:p.nameAr,nameEn:p.nameEn,registrationEnd:p.registrationEnd,endsAt:p.endsAt},after={capacity:x.capacity,nameAr:x.nameAr,nameEn:x.nameEn,registrationEnd,endsAt};await audit(tx,p.id,{before,after,reason:x.reason});
   await emit(tx,a.tenantId,a.userId,'program.updated',p.id,{programId:p.id,capacity:x.capacity,nameEn:x.nameEn,endsAt:endsAt.toISOString(),registrationEnd:registrationEnd.toISOString()});
   // Participants learn about schedule changes; a rename or capacity change is internal.
   if(endsAt.getTime()!==p.endsAt.getTime()){const rows=await tx.application.findMany({where:{tenantId:a.tenantId,programId:p.id,enrollment:{status:{in:['Enrolled','InProgress','Suspended']}}},include:{beneficiary:true}});for(const row of rows){await inbox(tx,row.beneficiary.userId,`تغيّر جدول برنامج ${x.nameAr}`,`The schedule of ${x.nameEn} changed`,'/programs');await tx.outbox.upsert({where:{dedupeKey:`schedule:${p.id}:${r.count}:${row.beneficiary.userId}:${endsAt.toISOString()}`},create:{tenantId:a.tenantId,recipient:row.beneficiary.email,subject:'ProgramOS',body:`تغيّر جدول البرنامج. راجع مساحة العمل.\nThe program schedule changed. Check your workspace.\n${process.env.APP_URL??'http://127.0.0.1:3000'}/ar/programs`,dedupeKey:`schedule:${p.id}:${r.count}:${row.beneficiary.userId}:${endsAt.toISOString()}`},update:{}});}}
   return {ok:true};});
 }
 case 'session.revoke':{
  await db.user.update({where:{id:a.userId},data:{sessionVersion:{increment:1}}});return {ok:true};
 }
 case 'preferences.save':{
  await db.user.update({where:{id:a.userId},data:{reminders:z.boolean().parse(data.reminders)}});return {ok:true};
 }
 case 'beneficiary.status':{
  requireRole(a,['Admin']);const x=z.object({id,status:z.enum(['Active','Archived']),reason}).parse(data);
  const b=await db.beneficiary.findFirst({where:{id:x.id,tenantId:a.tenantId}});if(!b||b.status==='Anonymized')throw new DomainError('notFound',404);
  // Archiving someone who is still enrolled would hide an active participant from the team (section 12).
  if(x.status==='Archived'&&await db.enrollment.count({where:{tenantId:a.tenantId,application:{beneficiaryId:b.id},status:{in:['Enrolled','InProgress','Suspended']}}}))throw new DomainError('pending',409);
  return db.$transaction(async tx=>{await tx.beneficiary.update({where:{id:b.id},data:{status:x.status}});await audit(tx,b.id,{from:b.status,to:x.status,reason:x.reason});return {ok:true};});
 }
 case 'beneficiary.note':{
  requireRole(a,['Admin','Manager','Coordinator']);const x=z.object({programId:id,beneficiaryId:id,body:reason}).parse(data);await programAccess(a,x.programId);
  if(!await db.application.findFirst({where:{tenantId:a.tenantId,programId:x.programId,beneficiaryId:x.beneficiaryId,status:{not:'Draft'}}}))throw new DomainError('notFound',404);
  return db.$transaction(async tx=>{const note=await tx.operationalNote.create({data:{...x,tenantId:a.tenantId,actorId:a.userId}});await audit(tx,note.id);return {id:note.id};});
 }
 case 'application.reopen':{
  requireRole(a,['Admin','Manager']);const x=z.object({id,reason}).parse(data);
  const app=await db.application.findFirst({where:{id:x.id,tenantId:a.tenantId}});if(!app)throw new DomainError('notFound',404);const p=await programAccess(a,app.programId);
  if(app.status!=='Withdrawn'||p.status!=='RegistrationOpen'||new Date()>p.registrationEnd)throw new DomainError('window');
  return db.$transaction(async tx=>{const r=await tx.application.updateMany({where:{id:app.id,status:'Withdrawn',version:app.version},data:{status:'Draft',version:{increment:1}}});if(!r.count)throw new DomainError('conflict',409);await audit(tx,app.id,{reason:x.reason});return {ok:true};});
 }
 case 'initiative.archive':{
  requireRole(a,['Admin']);const x=z.object({id,reason}).parse(data);
  return db.$transaction(async tx=>{const r=await tx.initiative.updateMany({where:{id:x.id,tenantId:a.tenantId},data:{status:'Archived'}});if(!r.count)throw new DomainError('notFound',404);await audit(tx,x.id,{reason:x.reason});return {ok:true};});
 }
 case 'activity.cancel':{
  requireRole(a,['Admin','Manager','Coordinator']);const x=z.object({id,reason}).parse(data);const act=await db.activity.findFirst({where:{id:x.id,tenantId:a.tenantId}});if(!act)throw new DomainError('notFound',404);const p=await programAccess(a,act.programId);if(!['Active','RegistrationClosed'].includes(p.status)||act.status!=='Scheduled')throw new DomainError('conflict',409);
  return db.$transaction(async tx=>{await tx.activity.update({where:{id:act.id},data:{status:'Cancelled'}});await audit(tx,act.id,{reason:x.reason});
   await emit(tx,a.tenantId,a.userId,'activity.cancelled',act.id,{activityId:act.id,programId:p.id,title:act.nameEn,startsAt:act.startsAt.toISOString()});const rows=await tx.application.findMany({where:{tenantId:a.tenantId,programId:p.id,enrollment:{status:{in:['Enrolled','InProgress','Suspended']}}},include:{beneficiary:true}});for(const row of rows){await inbox(tx,row.beneficiary.userId,'تم إلغاء نشاط في برنامجك','An activity in your program was cancelled','/programs');await tx.outbox.upsert({where:{dedupeKey:`cancel:${act.id}:${row.beneficiary.userId}`},create:{tenantId:a.tenantId,recipient:row.beneficiary.email,subject:'ProgramOS',body:`تم إلغاء نشاط. راجع مساحة العمل.\nAn activity was cancelled. Check your workspace.\n${process.env.APP_URL??'http://127.0.0.1:3000'}/ar/programs`,dedupeKey:`cancel:${act.id}:${row.beneficiary.userId}`},update:{}});}return {ok:true};});
 }
 case 'report.snapshot':{
  requireRole(a,['Admin','Manager','Impact','Viewer']);const x=z.object({title:reason,programId:id.optional(),cutoffAt:z.coerce.date().optional()}).parse(data);
  if(x.programId)await programAccess(a,x.programId);
  const state=await getState(a,{programId:x.programId,cutoffAt:x.cutoffAt});
  const contents={formulaVersion:FORMULA_VERSION,generatedAt:new Date().toISOString(),cutoffAt:(x.cutoffAt??new Date()).toISOString(),filters:{programId:x.programId??null},role:a.role,recordCount:state.applications.length,programIds:state.programs.map((p:any)=>p.id),totals:state.totals,kpis:state.kpis,indicators:state.indicators,missing:state.indicators.filter((i:any)=>i.pairs===0).length};
  return db.$transaction(async tx=>{const r=await tx.reportSnapshot.create({data:{tenantId:a.tenantId,userId:a.userId,title:x.title,data:contents}});await audit(tx,r.id,{programId:x.programId??null});return {id:r.id};});
 }
 case 'export.request':{
  const x=z.object({type:z.enum(exportTypes).exclude(['subject']),programId:id.optional(),locale:z.enum(['ar','en']).default('ar')}).parse(data);
  if(!exportRoles[x.type].includes(a.role))throw new DomainError('forbidden',403);
  if(x.programId)await programAccess(a,x.programId);
  // The file is produced inside the request because the volumes of an MVP tenant fit comfortably; the job record still gives the expiring link, the audit trail and the inbox notice the SRS asks for.
  const job=await db.exportJob.create({data:{tenantId:a.tenantId,userId:a.userId,type:x.type,filters:{programId:x.programId??null,locale:x.locale},expiresAt:new Date(Date.now()+EXPORT_TTL_MS)}});
  try{
   const state=await getState(a,{programId:x.programId});const rows=stateRows(x.type,state,x.locale==='ar',{programId:x.programId});
   const body=Buffer.from('﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'utf8');
   await db.$transaction(async tx=>{await tx.exportJob.update({where:{id:job.id},data:{status:'Ready',rows:rows.length-1,bytes:body,completedAt:new Date(),expiresAt:new Date(Date.now()+EXPORT_TTL_MS)}});await audit(tx,job.id,{type:x.type,rows:rows.length-1,programId:x.programId??null});await inbox(tx,a.userId,'ملف التصدير جاهز','Your export is ready','/reports');});
  }catch(e){await db.exportJob.update({where:{id:job.id},data:{status:'Failed',error:e instanceof Error?e.name:'unknown',completedAt:new Date()}});await db.notification.create({data:{tenantId:a.tenantId,userId:a.userId,titleAr:'تعذر إنشاء ملف التصدير',titleEn:'The export could not be produced',href:'/reports'}});throw e;}
  return {id:job.id,href:`/api/export?job=${job.id}`};
 }
 case 'outbox.retry':{
  requireRole(a,['Admin']);const x=z.object({id}).parse(data);
  return db.$transaction(async tx=>{const r=await tx.outbox.updateMany({where:{id:x.id,tenantId:a.tenantId,status:'Failed'},data:{status:'Queued',attempts:0,nextAttemptAt:new Date()}});if(!r.count)throw new DomainError('notFound',404);await audit(tx,x.id);return {ok:true};});
 }
 case 'profile.update':{
  requireRole(a,['Beneficiary']);const x=z.object({name:z.string().trim().min(2).max(120),phone:z.string().trim().regex(/^\+[1-9]\d{6,14}$/).or(z.literal('')),email:z.string().trim().toLowerCase().email().max(254).optional()}).parse(data);
  const user=await db.user.findUniqueOrThrow({where:{id:a.userId}});
  return db.$transaction(async tx=>{
   await tx.user.update({where:{id:a.userId},data:{name:x.name}});
   await tx.beneficiary.upsert({where:{tenantId_userId:{tenantId:a.tenantId,userId:a.userId}},create:{tenantId:a.tenantId,userId:a.userId,name:x.name,email:user.email,phone:x.phone||null},update:{name:x.name,phone:x.phone||null}});
   let emailChange=false;
   if(x.email&&x.email!==user.email){
    // The new address is only trusted once its owner clicks the link; until then the account keeps the verified one. The reply never reveals whether the address is already in use.
    emailChange=true;const taken=await tx.user.findUnique({where:{email:x.email}});
    if(!taken){const raw=randomBytes(32).toString('hex');await tx.authToken.create({data:{userId:a.userId,tokenHash:createHash('sha256').update(raw).digest('hex'),purpose:'email-change',payload:x.email,expiresAt:new Date(Date.now()+48*3600000)}});
     await tx.outbox.create({data:{tenantId:a.tenantId,recipient:x.email,subject:'تأكيد البريد الجديد · Confirm your new email',body:`لتأكيد البريد الجديد لحسابك في ProgramOS:\n${process.env.APP_URL??'http://127.0.0.1:3000'}/ar/verify?token=${raw}\n\nالرابط صالح لمدة 48 ساعة.`}});}
    await tx.outbox.create({data:{tenantId:a.tenantId,recipient:user.email,subject:'ProgramOS',body:'طُلب تغيير بريد حسابك. إن لم تطلب ذلك فتواصل مع الجهة.\nA change of your account email was requested. If this was not you, contact the organization.'}});
   }
   await audit(tx,a.userId,{name:x.name,phone:Boolean(x.phone),emailChange});return {ok:true,emailChange};
  });
 }
 case 'support.grant':{
  // Break glass: the tenant admin invites a named platform operator for a bounded window. The membership is a normal Admin membership that expires on its own, and every action it takes is audited like any other.
  requireRole(a,['Admin']);const x=z.object({email:z.string().trim().toLowerCase().email(),hours:z.coerce.number().int().min(1).max(72),reason}).parse(data);
  const user=await db.user.findUnique({where:{email:x.email}});if(!user||!user.active||!user.verified)throw new DomainError('notFound',404);
  if(user.id===a.userId)throw new DomainError('invalid');
  const expiresAt=new Date(Date.now()+x.hours*3600000);
  return db.$transaction(async tx=>{const m=await tx.membership.upsert({where:{tenantId_userId:{tenantId:a.tenantId,userId:user.id}},create:{tenantId:a.tenantId,userId:user.id,role:'Admin',active:true,expiresAt,supportGrant:true},update:{role:'Admin',active:true,expiresAt,supportGrant:true}});await audit(tx,m.id,{email:x.email,hours:x.hours,expiresAt,reason:x.reason});
   await tx.outbox.create({data:{tenantId:a.tenantId,recipient:user.email,subject:'ProgramOS',body:`مُنحت وصولًا مؤقتًا إلى مساحة عمل حتى ${expiresAt.toISOString()}.\nYou were granted temporary access to a workspace until ${expiresAt.toISOString()}.\n${process.env.APP_URL??'http://127.0.0.1:3000'}/ar`}});return {id:m.id,expiresAt};});
 }
 case 'support.revoke':{
  requireRole(a,['Admin']);const x=z.object({id,reason}).parse(data);
  return db.$transaction(async tx=>{const r=await tx.membership.updateMany({where:{id:x.id,tenantId:a.tenantId,supportGrant:true},data:{active:false,expiresAt:new Date()}});if(!r.count)throw new DomainError('notFound',404);await audit(tx,x.id,{reason:x.reason});return {ok:true};});
 }
 case 'deletion.decide':{
  requireRole(a,['Admin']);const x=z.object({id,approve:z.boolean(),reason}).parse(data);
  const c=await db.deletionCandidate.findFirst({where:{id:x.id,tenantId:a.tenantId,status:'Pending'}});if(!c)throw new DomainError('conflict',409);
  return db.$transaction(async tx=>{
   if(x.approve){await eraseBeneficiary(tx,a.tenantId,c.beneficiaryId,a.userId,x.reason);}
   else await tx.deletionCandidate.update({where:{id:c.id},data:{status:'Dismissed',decidedBy:a.userId,decidedAt:new Date()}});
   await audit(tx,c.id,{approve:x.approve,reason:x.reason,beneficiaryId:c.beneficiaryId});return {ok:true};});
 }
 default:return integrationCommand(a,action,data);
 }
}
