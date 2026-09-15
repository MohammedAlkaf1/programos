import {z} from 'zod';
import {extendedCommand} from './extended-commands';
import {randomBytes,createHash} from 'node:crypto';
import {db} from './db';
import {programAccess,requireRole,type Actor} from './access';
import {DomainError,canTransition,weightedScore,completion,roles,publishBlockers} from './domain';
import {assertWithinPlan,nextInvoiceNumber,paymentProvider,moyasar,settleExternalPayment,DUE_DAYS} from './billing';
import {invoiceAmounts} from './plan-math';
import {validateAnswers} from './answers';
import {emit} from './events';
import {queueMessage} from './messaging';
const text=z.string().trim().min(1).max(2000),id=z.string().uuid();
const managers=['Admin','Manager'] as const;
const operators=['Admin','Manager','Coordinator'] as const;
const validForm=z.array(z.object({id:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/),labelAr:text,labelEn:text,type:z.enum(['text','textarea','number','date','select','multiselect','attachment']),required:z.boolean(),options:z.array(text).max(20).optional()}).refine(f=>!['select','multiselect'].includes(f.type)||!!f.options?.length)).min(1).max(30);
const validRubric=z.array(z.object({nameAr:text,nameEn:text,weight:z.number().int().positive().max(100)})).min(1).max(10);
const reason=z.string().trim().min(3).max(1000);
const answersSchema=z.record(z.string(),z.union([z.string().max(4000),z.number(),z.array(z.string().max(2000)).max(20)]));
const newReference=()=>`${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
export async function command(a:Actor,action:string,input:unknown){
 if(a.tenantStatus!=='Active'&&!['notification.read','privacy.create','session.revoke','preferences.save','report.snapshot','export.request','profile.update'].includes(action))throw new DomainError('suspended',403);
 const data=z.record(z.string(),z.unknown()).parse(input);
 const log=async(tx:any,entityId:string,detail:object={})=>tx.audit.create({data:{tenantId:a.tenantId,actorId:a.userId,action,entityId,detail,correlationId:a.correlationId}});
 const p=async()=>programAccess(a,id.parse(data.programId));
 const application=async()=>{const x=await db.application.findFirst({where:{id:id.parse(data.id),tenantId:a.tenantId},include:{beneficiary:true,program:true,evaluations:true,enrollment:true}});if(!x)throw new DomainError('notFound',404);await programAccess(a,x.programId);if(a.role==='Beneficiary'&&x.beneficiary.userId!==a.userId)throw new DomainError('notFound',404);return x;};
 // One inbox entry and one email per recipient per event. The dedupe key makes a retried command a no-op for mail, and the link carries no data beyond the page to open.
 const notify=async(tx:any,userId:string,ar:string,en:string,href='/applications',dedupeKey?:string,mail=true)=>{await tx.notification.create({data:{tenantId:a.tenantId,userId,titleAr:ar,titleEn:en,href}});if(!mail)return;const u=await tx.user.findUnique({where:{id:userId}});if(!u)return;const data={tenantId:a.tenantId,recipient:u.email,subject:'ProgramOS',body:`${ar}\n${en}\n${process.env.APP_URL??'http://127.0.0.1:3000'}/ar${href}`,dedupeKey};if(dedupeKey)await tx.outbox.upsert({where:{dedupeKey},create:data,update:{}});else await tx.outbox.create({data});};
 const coordinators=async(tx:any,programId:string)=>tx.membership.findMany({where:{tenantId:a.tenantId,active:true,role:{in:['Coordinator','Manager']},OR:[{programIds:{has:programId}},{role:'Manager',programIds:{isEmpty:true}}]},select:{userId:true}});
 switch(action){
 case 'initiative.create':{
  requireRole(a,['Admin']);const x=z.object({nameAr:text,nameEn:text,objective:text}).parse(data);
  return db.$transaction(async tx=>{const r=await tx.initiative.create({data:{...x,tenantId:a.tenantId,ownerId:a.userId}});await log(tx,r.id);return r;});
 }
 case 'program.create':{
  requireRole(a,[...managers]);await assertWithinPlan(a.tenantId,'programs');
  const x=z.object({nameAr:text,nameEn:text,descriptionAr:text,descriptionEn:text,capacity:z.coerce.number().int().min(1).max(100000),startsAt:z.coerce.date(),endsAt:z.coerce.date(),registrationStart:z.coerce.date(),registrationEnd:z.coerce.date(),completionThreshold:z.coerce.number().int().min(1).max(100).default(80),requireEndline:z.boolean().default(false),privacyAr:text,privacyEn:text,initiativeId:id.optional(),form:validForm,rubric:validRubric}).parse(data);
  if(x.startsAt>=x.endsAt||x.registrationStart>=x.registrationEnd||x.registrationEnd>x.startsAt||x.rubric.reduce((s,r)=>s+r.weight,0)!==100||new Set(x.form.map(f=>f.id)).size!==x.form.length)throw new DomainError('invalid');
  if(x.initiativeId&&!await db.initiative.findFirst({where:{id:x.initiativeId,tenantId:a.tenantId}}))throw new DomainError('notFound',404);
  return db.$transaction(async tx=>{const r=await tx.program.create({data:{...x,tenantId:a.tenantId,ownerId:a.userId}});if(a.role==='Manager')await tx.membership.updateMany({where:{tenantId:a.tenantId,userId:a.userId},data:{programIds:{push:r.id}}});await log(tx,r.id);return r;});
 }
 case 'program.transition':{
  requireRole(a,[...managers]);const prog=await p();const to=text.parse(data.to),version=z.number().int().parse(data.version);
  if(!canTransition(prog.status,to)||prog.version!==version)throw new DomainError('conflict',409);
  if(to==='RegistrationOpen'&&(new Date()<prog.registrationStart||new Date()>prog.registrationEnd))throw new DomainError('window');
  // FR-008: a program is published only with a form, a complete rubric, a privacy notice in both languages and an active owner
  if(to==='Published'){const ownerActive=!!prog.ownerId&&!!await db.membership.findFirst({where:{tenantId:a.tenantId,userId:prog.ownerId,active:true},select:{id:true}});if(publishBlockers({form:prog.form as unknown[],rubric:prog.rubric as {weight:number}[],privacyAr:prog.privacyAr,privacyEn:prog.privacyEn,ownerId:prog.ownerId},ownerActive).length)throw new DomainError('publishIncomplete',422);}
  if(to==='Cancelled')reason.parse(data.reason);
  return db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Program" WHERE id=${prog.id} FOR UPDATE`;
   if(to==='Active'&&await tx.application.count({where:{programId:prog.id,status:{in:['Submitted','UnderReview','NeedsInfo','Waitlisted']}}}))throw new DomainError('pending');
   if(to==='Completed'&&await tx.enrollment.count({where:{application:{programId:prog.id},status:{in:['Enrolled','InProgress','Suspended']}}}))throw new DomainError('pending');
   const r=await tx.program.updateMany({where:{id:prog.id,tenantId:a.tenantId,version},data:{status:to,version:{increment:1}}});if(!r.count)throw new DomainError('conflict',409);
   if(to==='Active'){await tx.enrollment.updateMany({where:{application:{programId:prog.id},status:'Enrolled'},data:{status:'InProgress'}});await tx.application.updateMany({where:{programId:prog.id,status:'Draft'},data:{status:'Expired'}});}
   if(to==='Cancelled'){await tx.enrollment.updateMany({where:{application:{programId:prog.id},status:{in:['Enrolled','InProgress','Suspended']}},data:{status:'Cancelled',reason:String(data.reason)}});await tx.application.updateMany({where:{programId:prog.id,status:{in:['Draft','Submitted','UnderReview','NeedsInfo','Waitlisted']}},data:{status:'Cancelled'}});await tx.activity.updateMany({where:{programId:prog.id,status:'Scheduled'},data:{status:'Cancelled'}});}
   const announced:Record<string,string>={Published:'program.published',RegistrationOpen:'program.registration_opened',RegistrationClosed:'program.registration_closed',Active:'program.activated',Completed:'program.completed',Cancelled:'program.cancelled'};
   if(announced[to])await emit(tx,a.tenantId,a.userId,announced[to] as never,prog.id,{programId:prog.id,status:to,nameAr:prog.nameAr,nameEn:prog.nameEn,capacity:prog.capacity});
   await log(tx,prog.id,{from:prog.status,to,reason:data.reason??''});return r;
  });
 }
 case 'application.save':{
  requireRole(a,['Beneficiary']);const prog=await p();if(!['RegistrationOpen'].includes(prog.status)||new Date()<prog.registrationStart||new Date()>prog.registrationEnd)throw new DomainError('window');
  const answers=answersSchema.parse(data.answers);
  const form=validForm.parse(prog.form);
  const submit=data.submit===true;
  const files=validateAnswers(form,answers,submit);
  if(files.length&&await db.attachment.count({where:{id:{in:files},tenantId:a.tenantId,programId:prog.id,userId:a.userId,...(submit?{status:'Clean'}:{status:{not:'Rejected'}})}})!==files.length)throw new DomainError('filePending',409);
  if(submit&&data.consent!==true)throw new DomainError('privacy');
  return db.$transaction(async tx=>{
   const user=await tx.user.findUniqueOrThrow({where:{id:a.userId}});
   const b=await tx.beneficiary.upsert({where:{tenantId_userId:{tenantId:a.tenantId,userId:a.userId}},create:{tenantId:a.tenantId,userId:a.userId,name:user.name,email:user.email},update:{}});if(b.status!=='Active')throw new DomainError('forbidden',403);
   await tx.$queryRaw`SELECT id FROM "Beneficiary" WHERE id=${b.id} FOR UPDATE`;
   const existing=await tx.application.findUnique({where:{programId_beneficiaryId:{programId:prog.id,beneficiaryId:b.id}}});
   if(existing&&existing.status!=='Draft')throw new DomainError('duplicate',409);
   if(existing&&existing.version!==data.version)throw new DomainError('conflict',409);
   const values={answers,formSnapshot:prog.form!,privacySnapshot:prog.privacyAr+'\n'+prog.privacyEn,status:submit?'Submitted':'Draft',submittedAt:submit?new Date():null,...(submit&&!existing?.reference?{reference:newReference()}:{})};
   const r=existing?await tx.application.update({where:{id:existing.id},data:{...values,version:{increment:1}}}):await tx.application.create({data:{tenantId:a.tenantId,programId:prog.id,beneficiaryId:b.id,...values}});
   await log(tx,r.id,{submitted:submit,noticeVersion:prog.version});
   if(submit){
    // The acknowledgement is recorded against the exact notice text the person saw, and can be withdrawn later without touching the application.
    await tx.consentRecord.create({data:{tenantId:a.tenantId,beneficiaryId:b.id,applicationId:r.id,noticeVersion:prog.version,noticeText:values.privacySnapshot,purpose:prog.nameAr}});
    await emit(tx,a.tenantId,a.userId,'application.submitted',r.id,{applicationId:r.id,reference:r.reference,programId:prog.id,status:'Submitted'});
    await notify(tx,a.userId,`تم استلام طلبك برقم ${r.reference}`,`Your application ${r.reference} has been received`,'/applications',`submitted:${r.id}:${r.version}`);
    await queueMessage(tx,a.tenantId,a.userId,'SMS','application_received',{reference:r.reference??'',program:prog.nameAr},`sms:submitted:${r.id}`);
    for(const m of await coordinators(tx,prog.id))await notify(tx,m.userId,`طلب جديد على برنامج ${prog.nameAr}`,`New application for ${prog.nameEn}`,'/applications',undefined,false);
   }
   return r;
  });
 }
 case 'application.resubmit':{
  requireRole(a,['Beneficiary']);const x=await application();if(x.status!=='NeedsInfo'||!x.infoDue||new Date()>x.infoDue)throw new DomainError('window');
  const answer=z.string().trim().max(2000).default('').parse(data.response);
  // Only the fields the coordinator asked for may change; everything else stays as originally submitted and the previous answers are kept as a revision.
  const patch=answersSchema.optional().parse(data.answers)??{};
  if(Object.keys(patch).some(k=>!x.infoFields.includes(k)))throw new DomainError('invalid');
  const form=validForm.parse(x.formSnapshot);const merged={...(x.answers as Record<string,unknown>),...patch} as Record<string,string|number|string[]>;
  if(x.infoFields.length&&Object.keys(patch).length){const files=validateAnswers(form.filter(f=>x.infoFields.includes(f.id)),Object.fromEntries(x.infoFields.map(k=>[k,merged[k]])) as Record<string,string|number|string[]>,true);
   if(files.length&&await db.attachment.count({where:{id:{in:files},tenantId:a.tenantId,programId:x.programId,userId:a.userId,status:'Clean'}})!==files.length)throw new DomainError('filePending',409);}
  else if(!answer)throw new DomainError('required');
  if(answer)merged.additionalResponse=answer;
  return db.$transaction(async tx=>{
   const revision=await tx.applicationRevision.count({where:{applicationId:x.id}})+1;
   await tx.applicationRevision.create({data:{tenantId:a.tenantId,applicationId:x.id,revision,answers:x.answers as object,actorId:a.userId,reason:x.needsInfo??''}});
   const r=await tx.application.updateMany({where:{id:x.id,tenantId:a.tenantId,version:z.number().parse(data.version)},data:{answers:merged,status:'Submitted',infoFields:[],version:{increment:1}}});if(!r.count)throw new DomainError('conflict',409);await log(tx,x.id,{revision,fields:Object.keys(patch)});
   for(const m of await coordinators(tx,x.programId))await notify(tx,m.userId,`استكمل المستفيد طلبه ${x.reference}`,`Application ${x.reference} was completed`,'/applications',undefined,false);
   return r;});
 }
 case 'application.review':{
  requireRole(a,[...operators]);const x=await application();if(x.status!=='Submitted')throw new DomainError('conflict',409);
  return db.$transaction(async tx=>{await tx.application.update({where:{id:x.id},data:{status:'UnderReview',version:{increment:1}}});await log(tx,x.id);});
 }
 case 'application.info':{
  requireRole(a,[...operators]);const x=await application();if(x.status!=='UnderReview')throw new DomainError('conflict',409);const due=z.coerce.date().parse(data.dueAt);if(due<=new Date()||due>x.program.startsAt)throw new DomainError('invalid');
  const fields=z.array(z.string()).max(30).default([]).parse(data.fields);const form=validForm.parse(x.formSnapshot);if(fields.some(f=>!form.some(x=>x.id===f)))throw new DomainError('invalid');
  return db.$transaction(async tx=>{const r=await tx.application.update({where:{id:x.id},data:{status:'NeedsInfo',needsInfo:reason.parse(data.reason),infoFields:fields,infoDue:due,version:{increment:1}}});await log(tx,x.id,{fields});await emit(tx,a.tenantId,a.userId,'application.needs_info',x.id,{applicationId:x.id,reference:x.reference,programId:x.programId,dueAt:due.toISOString()});await notify(tx,x.beneficiary.userId,`يرجى استكمال بيانات الطلب ${x.reference}`,`Please complete application ${x.reference}`,'/applications',`info:${x.id}:${r.version}`);await queueMessage(tx,a.tenantId,x.beneficiary.userId,'SMS','application_needs_info',{reference:x.reference??''},`sms:info:${x.id}:${r.version}`);});
 }
 case 'application.assign':{
  requireRole(a,[...managers]);const x=await application();if(x.status!=='UnderReview')throw new DomainError('conflict',409);const reviewerId=id.parse(data.reviewerId);
  const m=await db.membership.findFirst({where:{tenantId:a.tenantId,userId:reviewerId,active:true,role:{in:['Reviewer','Admin','Manager']}}});if(!m||(m.role!=='Admin'&&!m.programIds.includes(x.programId)))throw new DomainError('forbidden',403);
  return db.$transaction(async tx=>{await tx.application.update({where:{id:x.id},data:{reviewerIds:[...new Set([...x.reviewerIds,reviewerId])]}});await log(tx,x.id,{reviewerId});});
 }
 case 'application.evaluate':{
  requireRole(a,['Admin','Manager','Reviewer']);const x=await application();if(x.status!=='UnderReview'||(a.role!=='Admin'&&!x.reviewerIds.includes(a.userId)))throw new DomainError('forbidden',403);
  const scores=z.array(z.number()).parse(data.scores);const conflict=z.boolean().parse(data.conflict);const comment=reason.parse(data.comment);const score=conflict?0:weightedScore(validRubric.parse(x.program.rubric),scores);
  return db.$transaction(async tx=>{const r=await tx.evaluation.upsert({where:{applicationId_reviewerId:{applicationId:x.id,reviewerId:a.userId}},create:{tenantId:a.tenantId,applicationId:x.id,reviewerId:a.userId,score,scores,comment,conflict},update:{score,scores,comment,conflict}});await log(tx,x.id,{conflict});return r;});
 }
 case 'application.decide':{
  requireRole(a,[...managers]);const x=await application();const to=z.enum(['Accepted','Rejected','Waitlisted']).parse(data.to),why=reason.parse(data.reason);
  if(x.status===to)return {id:x.id};
  if(!['UnderReview','Waitlisted'].includes(x.status)||!['RegistrationOpen','RegistrationClosed'].includes(x.program.status))throw new DomainError('conflict',409);
  const reviews=x.evaluations.filter(e=>!e.conflict);if((!reviews.length||x.reviewerIds.some(uid=>!reviews.some(e=>e.reviewerId===uid)))&&!z.string().min(10).safeParse(data.override).success)throw new DomainError('evaluation');
  return db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Program" WHERE id=${x.programId} FOR UPDATE`;
   const current=await tx.application.findUniqueOrThrow({where:{id:x.id}});if(current.status===to)return {id:x.id};if(!['UnderReview','Waitlisted'].includes(current.status))throw new DomainError('conflict',409);
   if(to==='Accepted'){
    await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${a.tenantId} FOR UPDATE`;
    const sub=await tx.subscription.findUnique({where:{tenantId:a.tenantId},include:{plan:true}});
    if(sub){if(!['Trialing','Active','PastDue'].includes(sub.status))throw new DomainError('subscriptionInactive',402);const used=await tx.enrollment.count({where:{tenantId:a.tenantId,status:{notIn:['Withdrawn','Cancelled']}}});if(sub.plan.maxEnrollments>=0&&used>=sub.plan.maxEnrollments)throw new DomainError('planLimit',402);}
    const occupied=await tx.enrollment.count({where:{tenantId:a.tenantId,application:{programId:x.programId},status:{notIn:['Withdrawn','Cancelled']}}});if(occupied>=x.program.capacity)throw new DomainError('capacity',409);const enrollment=await tx.enrollment.create({data:{tenantId:a.tenantId,applicationId:x.id}});
    await emit(tx,a.tenantId,a.userId,'enrollment.created',enrollment.id,{enrollmentId:enrollment.id,applicationId:x.id,programId:x.programId,status:'Enrolled'});
   }
   const r=await tx.application.update({where:{id:x.id},data:{status:to,decisionReason:why,firstDecidedAt:current.firstDecidedAt??new Date(),version:{increment:1}}});await log(tx,x.id,{to,reason:why,override:data.override??''});await emit(tx,a.tenantId,a.userId,'application.decided',x.id,{applicationId:x.id,reference:x.reference,programId:x.programId,decision:to});await notify(tx,x.beneficiary.userId,`تم تحديث حالة طلبك ${x.reference}`,`Your application ${x.reference} status has been updated`,'/applications',`decision:${x.id}:${r.version}`);await queueMessage(tx,a.tenantId,x.beneficiary.userId,'SMS','application_decided',{reference:x.reference??'',decision:to},`sms:decision:${x.id}:${r.version}`);return r;
  });
 }
 case 'application.withdraw':{
  requireRole(a,['Beneficiary']);const x=await application();if(!['Submitted','UnderReview','NeedsInfo','Waitlisted'].includes(x.status))throw new DomainError('conflict',409);
  return db.$transaction(async tx=>{await tx.application.update({where:{id:x.id},data:{status:'Withdrawn',version:{increment:1}}});await emit(tx,a.tenantId,a.userId,'application.withdrawn',x.id,{applicationId:x.id,reference:x.reference,programId:x.programId});await log(tx,x.id);});
 }
 case 'activity.create':{
  requireRole(a,[...operators]);const prog=await p();if(!['Active','RegistrationClosed'].includes(prog.status))throw new DomainError('conflict',409);
  const x=z.object({nameAr:text,nameEn:text,startsAt:z.coerce.date(),endsAt:z.coerce.date(),location:text,required:z.boolean().default(true)}).parse(data);if(x.startsAt>=x.endsAt||x.startsAt<prog.startsAt||x.endsAt>prog.endsAt)throw new DomainError('invalid');
  return db.$transaction(async tx=>{const r=await tx.activity.create({data:{...x,tenantId:a.tenantId,programId:prog.id}});await emit(tx,a.tenantId,a.userId,'activity.created',r.id,{activityId:r.id,programId:prog.id,title:x.nameEn,startsAt:x.startsAt.toISOString(),endsAt:x.endsAt.toISOString(),location:x.location});await log(tx,r.id);return r;});
 }
 case 'attendance.save':{
  requireRole(a,[...operators]);const x=z.object({activityId:id,enrollmentId:id,status:z.enum(['Present','Absent','Excused','NotRecorded']),reason:reason}).parse(data);
  const act=await db.activity.findFirst({where:{id:x.activityId,tenantId:a.tenantId}});if(!act)throw new DomainError('notFound',404);const prog=await programAccess(a,act.programId);
  const enr=await db.enrollment.findFirst({where:{id:x.enrollmentId,tenantId:a.tenantId,application:{programId:act.programId}}});if(!enr||!['Enrolled','InProgress'].includes(enr.status)||act.status==='Cancelled'||prog.status!=='Active')throw new DomainError('invalid');
  return db.$transaction(async tx=>{const previous=await tx.attendance.findUnique({where:{activityId_enrollmentId:{activityId:x.activityId,enrollmentId:x.enrollmentId}}});const r=await tx.attendance.upsert({where:{activityId_enrollmentId:{activityId:x.activityId,enrollmentId:x.enrollmentId}},create:{...x,tenantId:a.tenantId},update:{status:x.status,reason:x.reason}});await emit(tx,a.tenantId,a.userId,'attendance.recorded',r.id,{activityId:x.activityId,enrollmentId:x.enrollmentId,programId:act.programId,status:x.status});await log(tx,r.id,{previous:previous?.status??'NotRecorded',status:x.status,reason:x.reason});return r;});
 }
 case 'enrollment.transition':{
  requireRole(a,[...managers,'Beneficiary']);const x=await application();if(!x.enrollment)throw new DomainError('notFound',404);const to=z.enum(['Completed','Suspended','InProgress','Withdrawn','Cancelled']).parse(data.to),why=reason.parse(data.reason);
  if(a.role==='Beneficiary'&&to!=='Withdrawn')throw new DomainError('forbidden',403);
  if(!['Enrolled','InProgress','Suspended'].includes(x.enrollment.status)||!['Active','RegistrationClosed'].includes(x.program.status))throw new DomainError('conflict',409);
  if(to==='InProgress'&&x.enrollment.status!=='Suspended')throw new DomainError('conflict',409);
  if(to==='Completed'){
   if(x.enrollment.status!=='InProgress')throw new DomainError('conflict',409);
   const activities=await db.activity.findMany({where:{programId:x.programId,required:true,status:{not:'Cancelled'}},include:{attendance:{where:{enrollmentId:x.enrollment.id}}}});
   if(activities.some(t=>t.endsAt>new Date())||!completion(activities.map(t=>t.attendance[0]?.status??'NotRecorded'),x.program.completionThreshold))throw new DomainError('attendance');
   if(x.program.requireEndline){const indicators=await db.indicator.findMany({where:{programId:x.programId}});const final=await db.measurement.count({where:{enrollmentId:x.enrollment.id,period:'Endline',status:'Verified'}});if(!indicators.length||final<indicators.length)throw new DomainError('measurement');}
  }
  return db.$transaction(async tx=>{const r=await tx.enrollment.update({where:{id:x.enrollment!.id},data:{status:to==='InProgress'?(x.enrollment!.previousStatus??'InProgress'):to,previousStatus:to==='Suspended'?x.enrollment!.status:null,reason:why,completedAt:to==='Completed'?new Date():null}});
   const announced:Record<string,string>={Completed:'enrollment.completed',Withdrawn:'enrollment.withdrawn',Suspended:'enrollment.suspended'};
   if(announced[to])await emit(tx,a.tenantId,a.userId,announced[to] as never,r.id,{enrollmentId:r.id,applicationId:x.id,programId:x.programId,status:r.status});
   await log(tx,r.id,{to,reason:why});return r;});
 }
 case 'indicator.create':{
  requireRole(a,['Admin','Manager','Impact']);const prog=await p();if(['Archived','Completed','Cancelled'].includes(prog.status))throw new DomainError('conflict',409);
  const x=z.object({nameAr:text,nameEn:text,unit:text,target:z.coerce.number().finite(),direction:z.enum(['Higher','Lower']),aggregation:z.enum(['average','sum','count','percentage']).default('average'),source:z.string().trim().max(500).default(''),period:z.string().trim().max(120).default(''),ownerId:id.optional()}).parse(data);
  if(x.ownerId&&!await db.membership.findFirst({where:{tenantId:a.tenantId,userId:x.ownerId,active:true}}))throw new DomainError('invalid');
  return db.$transaction(async tx=>{const r=await tx.indicator.create({data:{...x,tenantId:a.tenantId,programId:prog.id}});await emit(tx,a.tenantId,a.userId,'indicator.created',r.id,{indicatorId:r.id,programId:prog.id,nameEn:x.nameEn,unit:x.unit,target:x.target});await log(tx,r.id);return r;});
 }
 case 'measurement.save':{
  requireRole(a,['Admin','Manager','Coordinator','Impact']);const x=z.object({indicatorId:id,enrollmentId:id,period:z.enum(['Baseline','Endline']),value:z.coerce.number().finite(),source:reason,measuredAt:z.coerce.date().default(()=>new Date()),evidenceId:id.optional(),reason:z.string().trim().max(1000).optional()}).parse(data);
  if(x.measuredAt>new Date())throw new DomainError('invalid');
  const indicator=await db.indicator.findFirst({where:{id:x.indicatorId,tenantId:a.tenantId}});if(!indicator)throw new DomainError('notFound',404);const prog=await programAccess(a,indicator.programId);if(['Archived','Completed','Cancelled'].includes(prog.status))throw new DomainError('conflict',409);
  if(!await db.enrollment.findFirst({where:{id:x.enrollmentId,tenantId:a.tenantId,application:{programId:indicator.programId}}}))throw new DomainError('notFound',404);
  if(x.evidenceId&&!await db.attachment.findFirst({where:{id:x.evidenceId,tenantId:a.tenantId,status:'Clean'}}))throw new DomainError('filePending',409);
  return db.$transaction(async tx=>{const old=await tx.measurement.findUnique({where:{indicatorId_enrollmentId_period:{indicatorId:x.indicatorId,enrollmentId:x.enrollmentId,period:x.period}}});
   // Correcting a recorded value needs a stated reason; the prior value and revision number stay in the audit trail.
   if(old&&(old.value!==x.value||old.source!==x.source)&&!(x.reason&&x.reason.length>=3))throw new DomainError('required');
   const r=await tx.measurement.upsert({where:{indicatorId_enrollmentId_period:{indicatorId:x.indicatorId,enrollmentId:x.enrollmentId,period:x.period}},create:{indicatorId:x.indicatorId,enrollmentId:x.enrollmentId,period:x.period,value:x.value,source:x.source,measuredAt:x.measuredAt,evidenceId:x.evidenceId,tenantId:a.tenantId},update:{value:x.value,source:x.source,measuredAt:x.measuredAt,evidenceId:x.evidenceId,reason:x.reason,status:'Draft',revision:{increment:1}}});await log(tx,r.id,{previous:old?{value:old.value,status:old.status,revision:old.revision}:null,value:x.value,source:x.source,reason:x.reason??''});return r;});
 }
 case 'measurement.verify':{
  requireRole(a,['Admin','Impact']);const x=await db.measurement.findFirst({where:{id:id.parse(data.id),tenantId:a.tenantId},include:{indicator:true}});if(!x)throw new DomainError('notFound',404);await programAccess(a,x.indicator.programId);const status=z.enum(['Verified','Returned']).parse(data.to);
  return db.$transaction(async tx=>{await tx.measurement.update({where:{id:x.id},data:{status}});if(status==='Verified')await emit(tx,a.tenantId,a.userId,'measurement.verified',x.id,{measurementId:x.id,indicatorId:x.indicatorId,programId:x.indicator.programId,period:x.period,value:x.value});await log(tx,x.id,{status});});
 }
 case 'notification.read':return db.notification.updateMany({where:{tenantId:a.tenantId,userId:a.userId,...(data.id?{id:id.parse(data.id)}:{})},data:{read:true}});
 case 'privacy.create':{
  const type=z.enum(['Access','Copy','Correction','Erasure','WithdrawConsent']).parse(data.type);const note=z.string().trim().max(1000).optional().parse(data.note);
  // An admin may file on behalf of a person who wrote in by other means; the request still belongs to that person.
  let userId=a.userId;if(data.userId&&data.userId!==a.userId){requireRole(a,['Admin']);userId=id.parse(data.userId);if(!await db.membership.findFirst({where:{tenantId:a.tenantId,userId}}))throw new DomainError('notFound',404);}
  if(await db.privacyRequest.count({where:{tenantId:a.tenantId,userId,type,status:{in:['New','IdentityVerified','InProgress']}}}))throw new DomainError('duplicate',409);
  return db.$transaction(async tx=>{const r=await tx.privacyRequest.create({data:{tenantId:a.tenantId,userId,type,reason:note,dueAt:new Date(Date.now()+30*86400000)}});await emit(tx,a.tenantId,a.userId,'privacy.request_created',r.id,{requestId:r.id,requestType:type,dueAt:r.dueAt.toISOString()});await log(tx,r.id,{type,onBehalf:userId!==a.userId});
   for(const m of await tx.membership.findMany({where:{tenantId:a.tenantId,role:'Admin',active:true},select:{userId:true}}))await notify(tx,m.userId,'طلب خصوصية جديد','New privacy request','/privacy',undefined,false);return r;});
 }
 case 'privacy.update':{
  requireRole(a,['Admin']);const x=await db.privacyRequest.findFirst({where:{id:id.parse(data.id),tenantId:a.tenantId}});if(!x)throw new DomainError('notFound',404);
  const to=z.enum(['IdentityVerified','InProgress','Rejected']).parse(data.to);const graph:Record<string,string[]>={New:['IdentityVerified','Rejected'],IdentityVerified:['InProgress','Rejected'],InProgress:['Rejected']};if(!graph[x.status]?.includes(to))throw new DomainError('conflict',409);
  return db.$transaction(async tx=>{await tx.privacyRequest.update({where:{id:x.id},data:{status:to,reason:reason.parse(data.reason),...(to==='Rejected'?{fulfilledAt:new Date()}:{})}});await log(tx,x.id,{to});await notify(tx,x.userId,'تم تحديث حالة طلب الخصوصية','Your privacy request status was updated','/privacy',`privacy:${x.id}:${to}`);});
 }
 case 'member.update':{
  requireRole(a,['Admin']);const x=z.object({id,role:z.enum(roles),active:z.boolean(),programIds:z.array(id)}).parse(data);
  const m=await db.membership.findFirst({where:{id:x.id,tenantId:a.tenantId}});if(!m||m.userId===a.userId)throw new DomainError('forbidden',403);
  if(await db.program.count({where:{id:{in:x.programIds},tenantId:a.tenantId}})!==x.programIds.length)throw new DomainError('invalid');
  return db.$transaction(async tx=>{const r=await tx.membership.update({where:{id:m.id},data:{role:x.role,active:x.active,programIds:x.programIds}});await log(tx,m.id,{role:x.role,active:x.active});return r;});
 }
 case 'member.invite':{
  requireRole(a,['Admin']);const x=z.object({email:z.email(),role:z.enum(roles),programIds:z.array(id)}).parse(data);
  if(x.role!=='Beneficiary')await assertWithinPlan(a.tenantId,'members');if(await db.program.count({where:{id:{in:x.programIds},tenantId:a.tenantId}})!==x.programIds.length)throw new DomainError('invalid');
  const token=randomBytes(32).toString('hex');
  return db.$transaction(async tx=>{const r=await tx.invitation.create({data:{...x,email:x.email.toLowerCase(),tenantId:a.tenantId,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+48*3600000)}});await tx.outbox.create({data:{tenantId:a.tenantId,recipient:x.email,subject:'دعوة إلى ProgramOS',body:`${process.env.APP_URL}/ar/register?invitation=${token}`}});await log(tx,r.id);return {id:r.id};});
 }
 case 'billing.changePlan':{
  requireRole(a,['Admin']);
  const x=z.object({planCode:z.string().trim().max(40),version:z.number().int()}).parse(data);
  const plan=await db.plan.findFirst({where:{code:x.planCode,active:true}});if(!plan)throw new DomainError('notFound',404);
  const sub=await db.subscription.findUnique({where:{tenantId:a.tenantId},include:{plan:true}});if(!sub)throw new DomainError('notFound',404);
  if(sub.planId===plan.id)return {id:sub.id};
  // A downgrade must not strand data above the new ceiling.
  const {usageFor}=await import('./billing');const usage=await usageFor(a.tenantId);
  const over=(plan.maxPrograms>=0&&usage.programs>plan.maxPrograms)||(plan.maxMembers>=0&&usage.members>plan.maxMembers)||(plan.maxEnrollments>=0&&usage.enrollments>plan.maxEnrollments);
  if(over)throw new DomainError('downgradeBlocked',409);
  return db.$transaction(async tx=>{
   const upgrade=plan.priceMonthly>sub.plan.priceMonthly;
   const r=await tx.subscription.updateMany({where:{id:sub.id,version:x.version},data:{planId:plan.id,cancelAtPeriodEnd:false,
    // Upgrades take effect at once and open an invoice; downgrades apply at renewal.
    ...(upgrade?{status:sub.status==='Trialing'?'Trialing':'Active'}:{})},});
   if(!r.count)throw new DomainError('conflict',409);
   if(upgrade&&sub.status!=='Trialing'&&plan.priceMonthly>0){
    const number=await nextInvoiceNumber(tx as never);
    await tx.invoice.create({data:{tenantId:a.tenantId,subscriptionId:sub.id,number,...invoiceAmounts(plan.priceMonthly),currency:plan.currency,periodStart:sub.currentPeriodStart,periodEnd:sub.currentPeriodEnd,dueAt:new Date(Date.now()+DUE_DAYS*86400000),provider:process.env.BILLING_PROVIDER??'manual'}});
   }
   await tx.subscription.update({where:{id:sub.id},data:{version:{increment:1}}});
   await log(tx,sub.id,{from:sub.plan.code,to:plan.code});
   return {id:sub.id};
  });
 }
 case 'billing.cancel':{
  requireRole(a,['Admin']);const x=z.object({version:z.number().int(),cancel:z.boolean()}).parse(data);
  const sub=await db.subscription.findUnique({where:{tenantId:a.tenantId}});if(!sub)throw new DomainError('notFound',404);
  return db.$transaction(async tx=>{
   const r=await tx.subscription.updateMany({where:{id:sub.id,version:x.version},data:{cancelAtPeriodEnd:x.cancel,version:{increment:1}}});
   if(!r.count)throw new DomainError('conflict',409);
   await log(tx,sub.id,{cancelAtPeriodEnd:x.cancel});return {id:sub.id};
  });
 }
 case 'billing.checkout':{
  requireRole(a,['Admin']);const invoice=await db.invoice.findFirst({where:{id:id.parse(data.id),tenantId:a.tenantId}});
  if(!invoice)throw new DomainError('notFound',404);
  if(invoice.status!=='Open')throw new DomainError('conflict',409);
  const provider=paymentProvider(invoice.provider);
  const checkout=await provider.createCheckout({tenantId:a.tenantId,invoiceId:invoice.id,amount:invoice.amount,currency:invoice.currency,description:invoice.number,returnUrl:`${process.env.APP_URL??'http://localhost:3000'}/ar/billing`});
  // The gateway's own reference lets the return flow look the payment up without trusting the query string.
  if(checkout.kind==='redirect'&&checkout.externalId)await db.invoice.update({where:{id:invoice.id},data:{providerRef:checkout.externalId}});
  await db.audit.create({data:{tenantId:a.tenantId,actorId:a.userId,action,entityId:invoice.id,detail:{provider:invoice.provider}}});
  return checkout;
 }
 case 'billing.confirmPayment':{
  // Called when the customer comes back from the gateway. The webhook may or may
  // not have landed yet, so the payment is looked up at the source and settled
  // through the same idempotent path; a webhook arriving later finds it done.
  requireRole(a,['Admin']);const invoice=await db.invoice.findFirst({where:{id:id.parse(data.id),tenantId:a.tenantId}});
  if(!invoice)throw new DomainError('notFound',404);
  if(invoice.status==='Paid')return {status:'paid'};
  if(invoice.provider!=='moyasar'||!invoice.providerRef)return {status:'pending'};
  const event=await moyasar.fetchInvoice(invoice.providerRef);
  if(!event||event.invoiceId!==invoice.id)return {status:'pending'};
  try{
   const outcome=await db.$transaction(tx=>settleExternalPayment(tx as never,'moyasar',event,event as object));
   return {status:outcome};
  }catch(e){
   if(e&&typeof e==='object'&&'code' in e&&(e as {code:string}).code==='P2002')return {status:(await db.invoice.findUnique({where:{id:invoice.id}}))?.status==='Paid'?'paid':'pending'};
   throw e;
  }
 }
 default:return extendedCommand(a,action,data);
 }
}
