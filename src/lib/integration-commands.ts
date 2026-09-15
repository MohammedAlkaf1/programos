import {z} from 'zod';
import {randomUUID,createHash,randomBytes} from 'node:crypto';
import {db} from './db';
import {programAccess,requireRole,type Actor} from './access';
import {DomainError} from './domain';
import {getState} from './state';
import {issue,scopes as apiScopes} from './api-keys';
import {newSecret,sign} from './signature';
import {emit,eventTypes} from './events';
import {parseCsv} from './csv';
import {createJob,prepare,programForm,targetFields,importKinds,type ImportKind} from './import-jobs';
import {connectorKinds,connectorFields,connectorFor} from './connectors';
import {channels} from './messaging';
import {draftProgram,summariseResults,searchDocuments,settingsFor,aiFeatures} from './ai';
import type {Fact} from './ai-claims';
import type {FormField} from './types';

/**
 * Commands for the second phase: the public API, webhooks, imports, connectors,
 * single sign on, messaging channels and the assistant.
 *
 * Every one of these is an administrative action. They are separated from the
 * program commands so the daily path a coordinator uses stays small and easy to
 * read, and so an integration failure can never be confused with a program rule.
 */

const id=z.string().uuid(),reason=z.string().trim().min(3).max(2000);
const name=z.string().trim().min(2).max(120);
/**
 * A destination a tenant may point us at.
 *
 * The cloud metadata address is refused everywhere: it is never a legitimate
 * webhook target and reaching it from inside our own network is the classic way
 * to steal instance credentials. The rest of the private space is refused in
 * production only, so a developer can still point a webhook at a receiver on
 * their own machine while testing.
 */
const httpsUrl=z.string().trim().url().max(500).refine(u=>{
 const parsed=new URL(u);
 const host=parsed.hostname.toLowerCase().replace(/^\[|\]$/g,'');
 if(['169.254.169.254','metadata.google.internal','metadata.goog'].includes(host)||host.startsWith('169.254.'))return false;
 if(process.env.NODE_ENV!=='production')return true;
 if(parsed.protocol!=='https:')return false;
 return !['localhost','0.0.0.0','::1'].includes(host)&&!/^(10|127)\./.test(host)&&!/^192\.168\./.test(host)&&!/^172\.(1[6-9]|2\d|3[01])\./.test(host);
},'blockedUrl');

export async function integrationCommand(a:Actor,action:string,data:Record<string,unknown>){
 const audit=(tx:any,entityId:string,detail:object={})=>tx.audit.create({data:{tenantId:a.tenantId,actorId:a.userId,action,entityId,detail,correlationId:a.correlationId}});
 switch(action){

 /* ── Public API keys (FR-054) ── */
 case 'apikey.create':{
  requireRole(a,['Admin']);
  const x=z.object({name,scopes:z.array(z.enum(apiScopes)).min(1).max(apiScopes.length),days:z.coerce.number().int().min(1).max(730).optional()}).parse(data);
  const {prefix,token,tokenHash}=issue();
  return db.$transaction(async tx=>{
   const key=await tx.apiKey.create({data:{tenantId:a.tenantId,name:x.name,prefix,tokenHash,scopes:x.scopes,createdBy:a.userId,expiresAt:x.days?new Date(Date.now()+x.days*86400000):null}});
   await audit(tx,key.id,{name:x.name,scopes:x.scopes});
   // The plaintext is returned once here and never stored anywhere.
   return {id:key.id,token,prefix};
  });
 }
 case 'apikey.revoke':{
  requireRole(a,['Admin']);const x=z.object({id,reason}).parse(data);
  return db.$transaction(async tx=>{
   const r=await tx.apiKey.updateMany({where:{id:x.id,tenantId:a.tenantId,revokedAt:null},data:{revokedAt:new Date()}});
   if(!r.count)throw new DomainError('notFound',404);
   await audit(tx,x.id,{reason:x.reason});return {ok:true};
  });
 }
 case 'apikey.rotate':{
  // Rotation issues the replacement and revokes the old key in one step, so
  // there is never a window where both are valid.
  requireRole(a,['Admin']);const x=z.object({id,reason}).parse(data);
  const old=await db.apiKey.findFirst({where:{id:x.id,tenantId:a.tenantId,revokedAt:null}});
  if(!old)throw new DomainError('notFound',404);
  const {prefix,token,tokenHash}=issue();
  return db.$transaction(async tx=>{
   await tx.apiKey.update({where:{id:old.id},data:{revokedAt:new Date()}});
   const key=await tx.apiKey.create({data:{tenantId:a.tenantId,name:old.name,prefix,tokenHash,scopes:old.scopes,createdBy:a.userId,expiresAt:old.expiresAt,rotatedFrom:old.id}});
   await audit(tx,key.id,{rotatedFrom:old.id,reason:x.reason});
   return {id:key.id,token,prefix};
  });
 }

 /* ── Webhook endpoints (FR-054) ── */
 case 'webhook.create':{
  requireRole(a,['Admin']);
  const x=z.object({url:httpsUrl,events:z.array(z.string().max(60)).max(40).default([])}).parse(data);
  if(x.events.some(e=>!eventTypes.includes(e as never)&&!e.endsWith('.*')))throw new DomainError('invalid');
  const secret=newSecret();
  return db.$transaction(async tx=>{
   const endpoint=await tx.webhookEndpoint.create({data:{tenantId:a.tenantId,url:x.url,secret,events:x.events,createdBy:a.userId}});
   await audit(tx,endpoint.id,{url:x.url,events:x.events});
   return {id:endpoint.id,secret};
  });
 }
 case 'webhook.update':{
  requireRole(a,['Admin']);
  const x=z.object({id,active:z.boolean(),events:z.array(z.string().max(60)).max(40)}).parse(data);
  return db.$transaction(async tx=>{
   const r=await tx.webhookEndpoint.updateMany({where:{id:x.id,tenantId:a.tenantId},data:{active:x.active,events:x.events}});
   if(!r.count)throw new DomainError('notFound',404);
   await audit(tx,x.id,{active:x.active,events:x.events});return {ok:true};
  });
 }
 case 'webhook.delete':{
  requireRole(a,['Admin']);const x=z.object({id,reason}).parse(data);
  return db.$transaction(async tx=>{
   const endpoint=await tx.webhookEndpoint.findFirst({where:{id:x.id,tenantId:a.tenantId}});
   if(!endpoint)throw new DomainError('notFound',404);
   await tx.webhookDelivery.deleteMany({where:{endpointId:endpoint.id}});
   await tx.webhookEndpoint.delete({where:{id:endpoint.id}});
   await audit(tx,x.id,{reason:x.reason});return {ok:true};
  });
 }
 case 'webhook.replay':{
  // Replaying a dead letter resets the chain rather than creating a second
  // delivery, so the receiver still sees one event with one identifier.
  requireRole(a,['Admin']);const x=z.object({id}).parse(data);
  return db.$transaction(async tx=>{
   const r=await tx.webhookDelivery.updateMany({where:{id:x.id,tenantId:a.tenantId,status:{in:['Dead','Failed']}},data:{status:'Queued',attempts:0,nextAttemptAt:new Date(),error:null}});
   if(!r.count)throw new DomainError('notFound',404);
   await audit(tx,x.id);return {ok:true};
  });
 }
 case 'webhook.test':{
  requireRole(a,['Admin']);const x=z.object({id}).parse(data);
  const endpoint=await db.webhookEndpoint.findFirst({where:{id:x.id,tenantId:a.tenantId}});
  if(!endpoint)throw new DomainError('notFound',404);
  const eventId=randomUUID();
  return db.$transaction(async tx=>{
   const payload={id:eventId,type:'ping',entityId:endpoint.id,tenantId:a.tenantId,occurredAt:new Date().toISOString(),data:{}};
   await tx.webhookDelivery.create({data:{tenantId:a.tenantId,endpointId:endpoint.id,eventId,event:'ping',payload}});
   await audit(tx,endpoint.id);return {ok:true};
  });
 }

 /* ── CSV import (FR-030) ── */
 case 'import.create':{
  requireRole(a,['Admin','Manager','Coordinator']);
  const x=z.object({kind:z.enum(importKinds),filename:z.string().trim().max(120),source:z.string().max(2_000_000),programId:id.optional()}).parse(data);
  if(x.kind==='applications'&&!x.programId)throw new DomainError('invalid');
  if(x.programId)await programAccess(a,x.programId);
  const {job,sheet,fields,mapping}=await createJob(a,x.kind,x.filename,x.source,x.programId??null,null);
  const known=new Set((await db.beneficiary.findMany({where:{tenantId:a.tenantId},select:{email:true}})).map(b=>b.email.toLowerCase()).filter(Boolean));
  const {report}=prepare(x.kind,sheet,mapping,await programForm(a.tenantId,x.programId??null),known);
  await db.importJob.update({where:{id:job.id},data:{report,createdRows:report.filter(r=>r.status==='create').length,skippedRows:report.filter(r=>r.status==='skip').length,errorRows:report.filter(r=>r.status==='error').length}});
  await db.audit.create({data:{tenantId:a.tenantId,actorId:a.userId,action,entityId:job.id,detail:{kind:x.kind,rows:sheet.rows.length},correlationId:a.correlationId}});
  return {id:job.id,headers:sheet.headers,fields,mapping,report:report.slice(0,200),totals:{total:sheet.rows.length,create:report.filter(r=>r.status==='create').length,skip:report.filter(r=>r.status==='skip').length,error:report.filter(r=>r.status==='error').length}};
 }
 case 'import.map':{
  requireRole(a,['Admin','Manager','Coordinator']);
  const x=z.object({id,mapping:z.record(z.string().max(60),z.string().max(200))}).parse(data);
  const job=await db.importJob.findFirst({where:{id:x.id,tenantId:a.tenantId,status:'Draft'}});
  if(!job)throw new DomainError('notFound',404);
  const sheet=parseCsv(job.source);
  const form=await programForm(a.tenantId,job.programId);
  const known=new Set((await db.beneficiary.findMany({where:{tenantId:a.tenantId},select:{email:true}})).map(b=>b.email.toLowerCase()).filter(Boolean));
  const {report}=prepare(job.kind as ImportKind,sheet,x.mapping,form,known);
  await db.importJob.update({where:{id:job.id},data:{mapping:x.mapping,report,createdRows:report.filter(r=>r.status==='create').length,skippedRows:report.filter(r=>r.status==='skip').length,errorRows:report.filter(r=>r.status==='error').length}});
  return {id:job.id,headers:sheet.headers,fields:targetFields(job.kind as ImportKind,form),mapping:x.mapping,report:report.slice(0,200),totals:{total:sheet.rows.length,create:report.filter(r=>r.status==='create').length,skip:report.filter(r=>r.status==='skip').length,error:report.filter(r=>r.status==='error').length}};
 }
 case 'import.apply':{
  requireRole(a,['Admin','Manager']);
  const x=z.object({id,createAccounts:z.boolean().default(false),sendInvitations:z.boolean().default(false),reason}).parse(data);
  // Creating accounts and sending mail are separate explicit choices. An
  // import never does either on its own.
  if(x.sendInvitations&&!x.createAccounts)throw new DomainError('invalid');
  const job=await db.importJob.findFirst({where:{id:x.id,tenantId:a.tenantId,status:'Draft'}});
  if(!job)throw new DomainError('notFound',404);
  if(job.programId)await programAccess(a,job.programId);
  const sheet=parseCsv(job.source);
  const form=await programForm(a.tenantId,job.programId);
  const program=job.programId?await db.program.findFirstOrThrow({where:{id:job.programId,tenantId:a.tenantId}}):null;
  if(program&&!['RegistrationOpen','RegistrationClosed'].includes(program.status))throw new DomainError('window');
  return db.$transaction(async tx=>{
   const known=new Set((await tx.beneficiary.findMany({where:{tenantId:a.tenantId},select:{email:true}})).map((b:{email:string})=>b.email.toLowerCase()).filter(Boolean));
   const {report,rows}=prepare(job.kind as ImportKind,sheet,job.mapping as Record<string,string>,form,known);
   let created=0;
   for(const row of rows){
    let userId:string|null=null;
    if(x.createAccounts){
     const existing=await tx.user.findUnique({where:{email:row.email}});
     userId=existing?.id??null;
     if(!existing){
      const user=await tx.user.create({data:{email:row.email,name:row.name,password:randomUUID()+randomUUID(),verified:false}});
      userId=user.id;
      await tx.membership.create({data:{tenantId:a.tenantId,userId:user.id,role:'Beneficiary'}});
     }else if(!await tx.membership.findUnique({where:{tenantId_userId:{tenantId:a.tenantId,userId:existing.id}}})){
      await tx.membership.create({data:{tenantId:a.tenantId,userId:existing.id,role:'Beneficiary'}});
     }
     if(x.sendInvitations&&userId){
      const token=randomBytes(32).toString('hex');
      await tx.invitation.create({data:{tenantId:a.tenantId,email:row.email,role:'Beneficiary',tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+7*86400000)}});
      await tx.outbox.create({data:{tenantId:a.tenantId,recipient:row.email,subject:'دعوة إلى ProgramOS · Invitation',body:`${process.env.APP_URL??'http://127.0.0.1:3000'}/ar/register?invitation=${token}`}});
     }
    }
    const beneficiary=await tx.beneficiary.create({data:{tenantId:a.tenantId,userId:userId??`import:${randomUUID()}`,name:row.name,email:row.email,phone:row.phone}});
    await tx.externalRef.create({data:{tenantId:a.tenantId,entity:'Beneficiary',entityId:beneficiary.id,source:`import:${job.id}`,externalId:row.email,checksum:String(row.index)}});
    if(job.kind==='applications'&&program){
     const application=await tx.application.create({data:{tenantId:a.tenantId,programId:program.id,beneficiaryId:beneficiary.id,status:'Submitted',reference:`${new Date().getFullYear()}-${randomUUID().slice(0,6).toUpperCase()}`,answers:row.answers,formSnapshot:program.form as object,privacySnapshot:`${program.privacyAr}\n${program.privacyEn}`,submittedAt:new Date()}});
     await tx.externalRef.create({data:{tenantId:a.tenantId,entity:'Application',entityId:application.id,source:`import:${job.id}`,externalId:`${row.email}:${program.id}`,checksum:String(row.index)}});
    }
    created++;
   }
   await tx.importJob.update({where:{id:job.id},data:{status:'Applied',report,createdRows:created,skippedRows:report.filter(r=>r.status==='skip').length,errorRows:report.filter(r=>r.status==='error').length,appliedAt:new Date(),options:{createAccounts:x.createAccounts,sendInvitations:x.sendInvitations},source:''}});
   await audit(tx,job.id,{created,skipped:report.filter(r=>r.status==='skip').length,errors:report.filter(r=>r.status==='error').length,createAccounts:x.createAccounts,sendInvitations:x.sendInvitations,reason:x.reason});
   return {created,skipped:report.filter(r=>r.status==='skip').length,errors:report.filter(r=>r.status==='error').length};
  },{timeout:120000});
 }
 case 'import.discard':{
  requireRole(a,['Admin','Manager','Coordinator']);const x=z.object({id}).parse(data);
  return db.$transaction(async tx=>{
   const r=await tx.importJob.updateMany({where:{id:x.id,tenantId:a.tenantId,status:'Draft'},data:{status:'Discarded',source:''}});
   if(!r.count)throw new DomainError('notFound',404);
   await audit(tx,x.id);return {ok:true};
  });
 }

 /* ── Connectors (FR-052) ── */
 case 'connector.create':{
  requireRole(a,['Admin']);
  const x=z.object({kind:z.enum(connectorKinds),name,url:httpsUrl,scopes:z.array(z.string().max(60)).max(20).default([]),fieldMap:z.record(z.string().max(60),z.string().max(60)).default({})}).parse(data);
  if(Object.keys(x.fieldMap).some(k=>!connectorFields[x.kind].includes(k)))throw new DomainError('invalid');
  const secret=newSecret();
  return db.$transaction(async tx=>{
   const connector=await tx.connector.create({data:{tenantId:a.tenantId,kind:x.kind,name:x.name,config:{url:x.url},fieldMap:x.fieldMap,scopes:x.scopes,secret,createdBy:a.userId}});
   await audit(tx,connector.id,{kind:x.kind,scopes:x.scopes});
   return {id:connector.id,secret};
  });
 }
 case 'connector.update':{
  requireRole(a,['Admin']);
  const x=z.object({id,status:z.enum(['Active','Paused']),scopes:z.array(z.string().max(60)).max(20),fieldMap:z.record(z.string().max(60),z.string().max(60))}).parse(data);
  const connector=await connectorFor(a.tenantId,x.id);
  if(Object.keys(x.fieldMap).some(k=>!connectorFields[connector.kind as keyof typeof connectorFields]?.includes(k)))throw new DomainError('invalid');
  return db.$transaction(async tx=>{
   await tx.connector.update({where:{id:connector.id},data:{status:x.status,scopes:x.scopes,fieldMap:x.fieldMap}});
   await audit(tx,connector.id,{status:x.status});return {ok:true};
  });
 }
 case 'connector.retry':{
  requireRole(a,['Admin']);const x=z.object({id}).parse(data);
  return db.$transaction(async tx=>{
   const r=await tx.connectorRun.updateMany({where:{id:x.id,tenantId:a.tenantId,status:{in:['Dead','Failed']}},data:{status:'Queued',attempts:0,nextAttemptAt:new Date(),error:null}});
   if(!r.count)throw new DomainError('notFound',404);
   await audit(tx,x.id);return {ok:true};
  });
 }
 case 'connector.resolveConflict':{
  requireRole(a,['Admin']);const x=z.object({id,reason}).parse(data);
  return db.$transaction(async tx=>{
   const r=await tx.externalRef.updateMany({where:{id:x.id,tenantId:a.tenantId,conflict:true},data:{conflict:false,conflictDetail:undefined}});
   if(!r.count)throw new DomainError('notFound',404);
   await audit(tx,x.id,{reason:x.reason});return {ok:true};
  });
 }

 /* ── Single sign on (FR-051) ── */
 case 'sso.configure':{
  requireRole(a,['Admin']);
  const x=z.object({issuer:z.string().trim().url().max(300),clientId:z.string().trim().min(3).max(200),clientSecret:z.string().trim().min(8).max(400),domains:z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)).min(1).max(10),defaultRole:z.enum(['Viewer','Coordinator','Reviewer','Impact']).default('Viewer'),autoProvision:z.boolean().default(false)}).parse(data);
  return db.$transaction(async tx=>{
   const config=await tx.ssoConfig.upsert({where:{tenantId:a.tenantId},create:{tenantId:a.tenantId,...x,createdBy:a.userId},update:{...x}});
   await audit(tx,config.id,{issuer:x.issuer,domains:x.domains,autoProvision:x.autoProvision});
   return {id:config.id};
  });
 }
 case 'sso.activate':{
  requireRole(a,['Admin']);const x=z.object({active:z.boolean(),reason}).parse(data);
  return db.$transaction(async tx=>{
   const config=await tx.ssoConfig.findUnique({where:{tenantId:a.tenantId}});
   if(!config)throw new DomainError('notFound',404);
   await tx.ssoConfig.update({where:{tenantId:a.tenantId},data:{active:x.active}});
   // Breaking the link must end access, not merely stop new sign ins.
   if(!x.active)await tx.ssoLink.updateMany({where:{tenantId:a.tenantId,revokedAt:null},data:{revokedAt:new Date()}});
   await audit(tx,config.id,{active:x.active,reason:x.reason});return {ok:true};
  });
 }
 case 'sso.unlink':{
  requireRole(a,['Admin']);const x=z.object({id,reason}).parse(data);
  return db.$transaction(async tx=>{
   const link=await tx.ssoLink.findFirst({where:{id:x.id,tenantId:a.tenantId}});
   if(!link)throw new DomainError('notFound',404);
   await tx.ssoLink.update({where:{id:link.id},data:{revokedAt:new Date()}});
   await tx.user.update({where:{id:link.userId},data:{sessionVersion:{increment:1}}});
   await audit(tx,link.id,{reason:x.reason});return {ok:true};
  });
 }

 /* ── Messaging channels (FR-050) ── */
 case 'messaging.template':{
  requireRole(a,['Admin']);
  const x=z.object({code:z.string().trim().regex(/^[a-z][a-z0-9_]{2,39}$/),channel:z.enum(channels),bodyAr:z.string().trim().min(5).max(600),bodyEn:z.string().trim().min(5).max(600),approved:z.boolean().default(false),providerRef:z.string().trim().max(120).optional()}).parse(data);
  return db.$transaction(async tx=>{
   const template=await tx.messagingTemplate.upsert({where:{tenantId_code_channel:{tenantId:a.tenantId,code:x.code,channel:x.channel}},create:{tenantId:a.tenantId,...x},update:{bodyAr:x.bodyAr,bodyEn:x.bodyEn,approved:x.approved,providerRef:x.providerRef}});
   await audit(tx,template.id,{code:x.code,channel:x.channel,approved:x.approved});return {id:template.id};
  });
 }
 case 'messaging.consent':{
  // A person sets their own consent. An admin may only withdraw it, never grant it.
  const x=z.object({channel:z.enum(channels).exclude(['Email']),address:z.string().trim().regex(/^\+[1-9]\d{6,14}$/),optedIn:z.boolean(),userId:id.optional()}).parse(data);
  let target=a.userId;
  if(x.userId&&x.userId!==a.userId){requireRole(a,['Admin']);if(x.optedIn)throw new DomainError('forbidden',403);target=x.userId;}
  return db.$transaction(async tx=>{
   const row=await tx.messagingConsent.upsert({
    where:{tenantId_userId_channel:{tenantId:a.tenantId,userId:target,channel:x.channel}},
    create:{tenantId:a.tenantId,userId:target,channel:x.channel,address:x.address,optedIn:x.optedIn,verifiedAt:x.optedIn?new Date():null,source:target===a.userId?'Workspace':'AdminWithdrawal'},
    update:{address:x.address,optedIn:x.optedIn,verifiedAt:x.optedIn?new Date():null},
   });
   await audit(tx,row.id,{channel:x.channel,optedIn:x.optedIn});return {ok:true};
  });
 }

 /* ── Assistant and its governance (FR-055 to FR-059) ── */
 case 'ai.settings':{
  requireRole(a,['Admin']);
  const x=z.object({enabled:z.boolean(),monthlyCap:z.coerce.number().int().min(0).max(10_000_000),retainDays:z.coerce.number().int().min(1).max(365),acceptTerms:z.boolean()}).parse(data);
  // Enabling requires an explicit acceptance of how the data is processed.
  if(x.enabled&&!x.acceptTerms)throw new DomainError('aiTermsRequired',422);
  await settingsFor(a.tenantId);
  return db.$transaction(async tx=>{
   const settings=await tx.aiSetting.update({where:{tenantId:a.tenantId},data:{enabled:x.enabled,monthlyCap:x.monthlyCap,retainDays:x.retainDays,
    approvedBy:x.enabled?a.userId:null,approvedAt:x.enabled?new Date():null,
    terms:x.enabled?'المعالجة لدى المزود دون تدريب على بيانات العميل. Processing at the provider without training on customer data.':''}});
   await audit(tx,settings.id,{enabled:x.enabled,monthlyCap:x.monthlyCap,retainDays:x.retainDays});return {ok:true};
  });
 }
 case 'ai.draftProgram':{
  requireRole(a,['Admin','Manager']);
  const x=z.object({nameAr:name,nameEn:name,objective:z.string().trim().min(10).max(1000),audience:z.string().trim().min(3).max(300)}).parse(data);
  return draftProgram(a,x);
 }
 case 'ai.summarise':{
  requireRole(a,['Admin','Manager','Impact']);
  const x=z.object({programId:id}).parse(data);
  const program=await programAccess(a,x.programId);
  const state=await getState(a,{programId:x.programId});
  const kpi=state.kpis[x.programId];
  const facts:Fact[]=[
   {id:'F1',label:'submitted applications',value:kpi?.submitted??0},
   {id:'F2',label:'acceptance rate',value:kpi?.acceptanceRate??null,unit:'%'},
   {id:'F3',label:'enrollments created',value:kpi?.enrollments??0},
   {id:'F4',label:'completed enrollments',value:kpi?.completed??0},
   {id:'F5',label:'completion rate',value:kpi?.completionRate??null,unit:'%'},
   {id:'F6',label:'program fill',value:kpi?.fill??null,unit:'%'},
   ...state.indicators.flatMap((indicator:any,index:number)=>[
    {id:`F${7+index*3}`,label:`mean change in ${indicator.nameEn}`,value:indicator.change,unit:indicator.unit},
    {id:`F${8+index*3}`,label:`verified measurement pairs for ${indicator.nameEn}`,value:indicator.pairs},
    {id:`F${9+index*3}`,label:`measurement coverage for ${indicator.nameEn}`,value:indicator.coverage,unit:'%'},
   ]),
  ];
  return summariseResults(a,x.programId,facts,{programName:`${program.nameAr} / ${program.nameEn}`,periodAr:`${program.startsAt.toISOString().slice(0,10)} — ${program.endsAt.toISOString().slice(0,10)}`});
 }
 case 'ai.search':{
  const x=z.object({question:z.string().trim().min(5).max(500)}).parse(data);
  return searchDocuments(a,x.question);
 }
 case 'ai.approve':{
  // The only way a draft becomes usable: a named person accepts it.
  requireRole(a,['Admin','Manager','Impact']);
  const x=z.object({id,approve:z.boolean()}).parse(data);
  return db.$transaction(async tx=>{
   const run=await tx.aiRun.findFirst({where:{id:x.id,tenantId:a.tenantId,status:'Draft'}});
   if(!run)throw new DomainError('conflict',409);
   await tx.aiRun.update({where:{id:run.id},data:{status:x.approve?'Approved':'Discarded',approvedBy:a.userId,approvedAt:new Date()}});
   await audit(tx,run.id,{feature:run.feature,approve:x.approve});return {ok:true};
  });
 }
 case 'doc.create':{
  requireRole(a,['Admin','Manager','Impact']);
  const x=z.object({title:name,body:z.string().trim().min(20).max(100_000),programId:id.optional(),tags:z.array(z.string().trim().max(40)).max(10).default([])}).parse(data);
  if(x.programId)await programAccess(a,x.programId);
  return db.$transaction(async tx=>{
   const doc=await tx.knowledgeDoc.create({data:{tenantId:a.tenantId,title:x.title,body:x.body,programId:x.programId??null,tags:x.tags,createdBy:a.userId}});
   await audit(tx,doc.id,{title:x.title});return {id:doc.id};
  });
 }
 case 'doc.delete':{
  requireRole(a,['Admin','Manager','Impact']);const x=z.object({id}).parse(data);
  return db.$transaction(async tx=>{
   const r=await tx.knowledgeDoc.deleteMany({where:{id:x.id,tenantId:a.tenantId}});
   if(!r.count)throw new DomainError('notFound',404);
   await audit(tx,x.id);return {ok:true};
  });
 }

 default:throw new DomainError('invalid');
 }
}

/** Re-exported so the command layer can announce events without importing the bus directly. */
export {emit,sign};
