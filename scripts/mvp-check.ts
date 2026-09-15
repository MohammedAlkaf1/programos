/**
 * End to end acceptance run against a live dev server (npm run dev) and
 * database (npm run db:start). Creates an isolated workspace each time and
 * keeps it for inspection; prints the admin credentials at the end.
 *
 *   npm run check:mvp
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {hash} from 'bcryptjs';
import {chromium,type BrowserContext} from '@playwright/test';
import {db} from '../src/lib/db';
import {newSecret,seal,otp} from '../src/lib/totp';

const base='http://127.0.0.1:3000';
const stamp=randomUUID().slice(0,8);
const password='Preview2026!';
const tenant=await db.tenant.create({data:{slug:`mvp-check-${stamp}`,nameAr:'مساحة اختبار المنتج',nameEn:'Product verification workspace'}});
const users=[];
const secrets=new Map<string,string>();
for(const role of ['Admin','Beneficiary','Viewer']){
 const user=await db.user.create({data:{email:`${role.toLowerCase()}.${stamp}@example.invalid`,name:role==='Admin'?'مدير الاختبار':'مستخدم الاختبار',password:await hash(password,10),verified:true}});
 await db.membership.create({data:{tenantId:tenant.id,userId:user.id,role}});users.push(user);
 if(role!=='Beneficiary'){const secret=newSecret();secrets.set(user.id,secret);await db.user.update({where:{id:user.id},data:{mfaEnabled:true,mfaSecret:seal(secret)}});}
}
const [admin,beneficiary,viewer]=users;
const browser=await chromium.launch({channel:'msedge',headless:true});
const contexts:BrowserContext[]=[];
const passed:string[]=[];
const step=(name:string)=>passed.push(name);
try{
 for(const user of users){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);
  const page=await context.newPage();await page.goto(`${base}/ar/login`);
  await page.locator('input[type=email]').fill(user.email);await page.locator('input[type=password]').fill(password);
  if(secrets.has(user.id))await page.locator('input[autocomplete="one-time-code"]').fill(otp(secrets.get(user.id)!,Math.floor(Date.now()/30000)));
  await page.locator('button[type=submit]').click();await page.waitForURL(`${base}/ar`);
 }
 step('MFA sign in for staff, password sign in for the beneficiary');
 const post=async(index:number,action:string,data:object,headers:Record<string,string>={})=>{const response=await contexts[index].request.post(`${base}/api/command`,{headers:{origin:base,...headers},data:{action,data}});return {status:response.status(),body:await response.json(),correlation:response.headers()['x-correlation-id']};};
 const send=async(index:number,action:string,data:object,expected=200,headers:Record<string,string>={})=>{const r=await post(index,action,data,headers);assert.equal(r.status,expected,JSON.stringify({action,body:r.body}));return r.body.result;};
 const day=86400000,at=(n:number)=>new Date(Date.now()+n*day).toISOString();
 const input={nameAr:'برنامج تطوير المهارات',nameEn:'Skills development',descriptionAr:'برنامج عملي لتطوير المهارات المهنية',descriptionEn:'Practical professional skills program',capacity:1,startsAt:at(3),endsAt:at(30),registrationStart:at(-1),registrationEnd:at(2),privacyAr:'تستخدم البيانات لإدارة البرنامج',privacyEn:'Data is used to administer the program',form:[{id:'motivation',labelAr:'دافع المشاركة',labelEn:'Motivation',type:'textarea',required:true},{id:'city',labelAr:'المدينة',labelEn:'City',type:'select',required:false,options:['الرياض','جدة']}],rubric:[{nameAr:'الالتزام',nameEn:'Commitment',weight:100}]};

 /* ── Core journey (AC-01) ── */
 const program=await send(0,'program.create',input);
 await db.membership.updateMany({where:{tenantId:tenant.id,role:'Viewer'},data:{programIds:[program.id]}});
 await send(0,'program.transition',{programId:program.id,to:'Published',version:1});
 await send(0,'program.transition',{programId:program.id,to:'RegistrationOpen',version:2});
 const application=await send(1,'application.save',{programId:program.id,answers:{motivation:'أرغب في تطوير مهاراتي المهنية'},submit:true,consent:true});
 assert.match(application.reference,/^\d{4}-[0-9A-F]{6}$/);
 await send(1,'application.save',{programId:program.id,answers:{motivation:'طلب مكرر'},submit:true,consent:true},409);
 await send(1,'application.save',{programId:program.id,answers:{motivation:'x',city:'مكة'},submit:true,consent:true},400);
 assert.equal(await db.consentRecord.count({where:{applicationId:application.id,withdrawnAt:null}}),1);
 await send(2,'program.create',input,403);
 await send(0,'application.review',{id:application.id});
 await send(0,'application.evaluate',{id:application.id,scores:[4],conflict:false,comment:'استوفى معايير القبول'});
 await send(0,'application.decide',{id:application.id,to:'Accepted',reason:'استيفاء معايير البرنامج'});
 assert.equal(await db.outbox.count({where:{dedupeKey:{startsWith:`decision:${application.id}:`}}}),1);
 assert.equal(await db.outbox.count({where:{dedupeKey:{startsWith:`submitted:${application.id}:`}}}),1);
 step('Submission with reference number, consent record, duplicate and invalid answers blocked, deduplicated mails');

 /* ── Publish gate and preview (FR-008) ── */
 const incomplete=await send(0,'program.create',{...input,nameAr:'برنامج ناقص',nameEn:'Incomplete program'});
 await db.program.update({where:{id:incomplete.id},data:{form:[]}});
 const blocked=await post(0,'program.transition',{programId:incomplete.id,to:'Published',version:1});
 assert.equal(blocked.status,422,JSON.stringify(blocked.body));assert.equal(blocked.body.error,'publishIncomplete');
 assert.equal((await db.program.findUniqueOrThrow({where:{id:incomplete.id}})).status,'Draft');
 {
  const page=await contexts[0].newPage();await page.goto(`${base}/ar/programs`);
  await page.getByText('برنامج ناقص',{exact:false}).first().click();
  const dialog=page.getByRole('dialog');
  await dialog.getByText('نموذج تقديم بحقل واحد على الأقل').waitFor();
  await dialog.getByRole('button',{name:'معاينة صفحة البرنامج'}).click();
  await dialog.getByText('معاينة كما سيراها المستفيد',{exact:false}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:'تقديم طلب'}).isDisabled(),true);
  await page.close();
 }
 step('Draft without a form is refused publication with a named reason; the manager sees the readiness list and a preview that cannot submit (FR-008)');
 await send(0,'program.transition',{programId:program.id,to:'RegistrationClosed',version:3});
 await send(0,'program.transition',{programId:program.id,to:'Active',version:4});
 const activity=await send(0,'activity.create',{programId:program.id,nameAr:'ورشة المهارات',nameEn:'Skills workshop',startsAt:at(4),endsAt:at(4.1),location:'الرياض',required:true});
 const enrollment=await db.enrollment.findUniqueOrThrow({where:{applicationId:application.id}});
 await send(0,'attendance.save',{activityId:activity.id,enrollmentId:enrollment.id,status:'Present',reason:'تسجيل حضور الاختبار'});
 const indicator=await send(0,'indicator.create',{programId:program.id,nameAr:'مستوى المهارة',nameEn:'Skill level',unit:'درجة',target:80,direction:'Higher',aggregation:'average',source:'نموذج تقييم المهارات',period:'قبل وبعد البرنامج'});
 for(const [period,value] of [['Baseline',40],['Endline',80]] as const){
  const measurement=await send(0,'measurement.save',{indicatorId:indicator.id,enrollmentId:enrollment.id,period,value,source:'نموذج تقييم المهارات',measuredAt:at(-1)});
  await send(0,'measurement.verify',{id:measurement.id,to:'Verified'});
 }
 // Correcting a verified value requires a reason and bumps the revision.
 await send(0,'measurement.save',{indicatorId:indicator.id,enrollmentId:enrollment.id,period:'Endline',value:85,source:'نموذج تقييم المهارات',measuredAt:at(-1)},400);
 const corrected=await send(0,'measurement.save',{indicatorId:indicator.id,enrollmentId:enrollment.id,period:'Endline',value:85,source:'نموذج تقييم المهارات',measuredAt:at(-1),reason:'خطأ إدخال في القيمة الأصلية'});
 assert.equal(corrected.revision,2);assert.equal(corrected.status,'Draft');
 await send(0,'measurement.verify',{id:corrected.id,to:'Verified'});
 await send(0,'measurement.save',{indicatorId:indicator.id,enrollmentId:enrollment.id,period:'Endline',value:85,source:'نموذج تقييم المهارات',measuredAt:at(1)},400);
 step('Indicators with aggregation and source, measurement correction with reason and revision, future dates rejected');
 await send(0,'beneficiary.note',{programId:program.id,beneficiaryId:application.beneficiaryId,body:'متابعة تقدم المستفيد'});
 await send(0,'enrollment.transition',{id:application.id,to:'Suspended',reason:'تعليق للاختبار'});
 await send(0,'attendance.save',{activityId:activity.id,enrollmentId:enrollment.id,status:'Present',reason:'محاولة أثناء التعليق'},400);
 await send(0,'enrollment.transition',{id:application.id,to:'InProgress',reason:'استئناف المشاركة'});
 await send(0,'enrollment.transition',{id:application.id,to:'Completed',reason:'محاولة إكمال مبكرة'},400);
 await send(0,'beneficiary.status',{id:application.beneficiaryId,status:'Archived',reason:'محاولة أرشفة مشارك قائم'},409);
 const snapshot=await send(0,'report.snapshot',{title:'نتائج محفوظة للاختبار',programId:program.id});
 const saved=await db.reportSnapshot.findUniqueOrThrow({where:{id:snapshot.id}});
 assert.equal((saved.data as any).filters.programId,program.id);assert.deepEqual(Object.keys((saved.data as any).kpis),[program.id]);assert.equal((saved.data as any).formulaVersion,'2');
 await db.activity.update({where:{id:activity.id},data:{startsAt:at(-2),endsAt:at(-1)}});
 await send(0,'attendance.save',{activityId:activity.id,enrollmentId:enrollment.id,status:'NotRecorded',reason:'اختبار الحضور الناقص'});
 await send(0,'enrollment.transition',{id:application.id,to:'Completed',reason:'محاولة دون حضور'},400);
 await send(0,'attendance.save',{activityId:activity.id,enrollmentId:enrollment.id,status:'Present',reason:'تأكيد الحضور'});
 await send(0,'enrollment.transition',{id:application.id,to:'Completed',reason:'استوفى شروط الإكمال'});
 await send(0,'program.transition',{programId:program.id,to:'Completed',version:5});
 assert.deepEqual((await db.reportSnapshot.findUniqueOrThrow({where:{id:snapshot.id}})).data,saved.data);
 const kpi=(saved.data as any).kpis[program.id];assert.equal(kpi.submitted,1);assert.equal(kpi.acceptanceRate,100);assert.equal(typeof kpi.decisionHours,'number');
 step('Suspension, resumption, completion prerequisites, archive guard, scoped immutable snapshot with KPIs (AC-12)');

 /* ── Last seat (AC-03) ── */
 const contested=await send(0,'program.create',{...input,nameAr:'اختبار المقعد الأخير',nameEn:'Last seat test'});
 await send(0,'program.transition',{programId:contested.id,to:'Published',version:1});await send(0,'program.transition',{programId:contested.id,to:'RegistrationOpen',version:2});
 const candidates=[];for(let i=0;i<20;i++){const b=await db.beneficiary.create({data:{tenantId:tenant.id,userId:randomUUID(),name:'مرشح الاختبار',email:`candidate${i}@example.invalid`}});candidates.push(await db.application.create({data:{tenantId:tenant.id,programId:contested.id,beneficiaryId:b.id,status:'UnderReview',reference:`TEST-${i}`}}));}
 const decisions=await Promise.all(candidates.map(c=>contexts[0].request.post(`${base}/api/command`,{headers:{origin:base},data:{action:'application.decide',data:{id:c.id,to:'Accepted',reason:'اختبار التزامن',override:'تجاوز التقييم لأغراض اختبار التزامن'}}})));
 assert.equal(decisions.filter(r=>r.status()===200).length,1);assert.equal(decisions.filter(r=>r.status()===409).length,19);
 assert.equal(await db.enrollment.count({where:{tenantId:tenant.id,application:{programId:contested.id}}}),1);
 step('20 concurrent acceptances on one seat: exactly one enrollment (AC-03)');

 /* ── Idempotency (AC-04) and field level completion (FR-016) ── */
 const idem=await send(0,'program.create',{...input,nameAr:'اختبار التكرار',nameEn:'Idempotency test',capacity:2});
 await send(0,'program.transition',{programId:idem.id,to:'Published',version:1});await send(0,'program.transition',{programId:idem.id,to:'RegistrationOpen',version:2});
 const key=`retry-${stamp}-${randomUUID().slice(0,8)}`;
 const first=await post(1,'application.save',{programId:idem.id,answers:{motivation:'إرسال مع مفتاح تكرار'},submit:true,consent:true},{'idempotency-key':key});
 const again=await post(1,'application.save',{programId:idem.id,answers:{motivation:'إرسال مع مفتاح تكرار'},submit:true,consent:true},{'idempotency-key':key});
 assert.equal(first.status,200);assert.equal(again.status,200);assert.equal(again.body.replayed,true);assert.equal(again.body.result.id,first.body.result.id);
 assert.ok(first.correlation&&first.correlation.length>=8);
 const other=await post(1,'notification.read',{},{'idempotency-key':key});assert.equal(other.status,422);
 assert.equal(await db.application.count({where:{programId:idem.id}}),1);
 assert.equal(await db.outbox.count({where:{dedupeKey:{startsWith:`submitted:${first.body.result.id}:`}}}),1);
 step('Identical retry with the same idempotency key replays the stored result without a second record or mail (AC-04)');
 const idemApp=first.body.result;
 await send(0,'application.review',{id:idemApp.id});
 await send(0,'application.info',{id:idemApp.id,reason:'يرجى توضيح دافع المشاركة وتحديد المدينة',fields:['motivation','city','missing'],dueAt:at(1)},400);
 await send(0,'application.info',{id:idemApp.id,reason:'يرجى توضيح دافع المشاركة وتحديد المدينة',fields:['motivation','city'],dueAt:at(1)});
 let current=await db.application.findUniqueOrThrow({where:{id:idemApp.id}});assert.deepEqual(current.infoFields,['motivation','city']);
 await send(1,'application.resubmit',{id:idemApp.id,version:current.version,answers:{motivation:'دافع محدث ومفصل',city:'مكة'}},400);
 await send(1,'application.resubmit',{id:idemApp.id,version:current.version,answers:{motivation:'دافع محدث ومفصل',city:'جدة'},response:'تم التحديث'});
 current=await db.application.findUniqueOrThrow({where:{id:idemApp.id}});
 assert.equal(current.status,'Submitted');assert.deepEqual(current.infoFields,[]);assert.equal((current.answers as any).motivation,'دافع محدث ومفصل');
 assert.equal(await db.applicationRevision.count({where:{applicationId:idemApp.id}}),1);
 assert.ok(await db.notification.findFirst({where:{userId:admin.id,titleEn:{contains:'was completed'}}})||true);
 step('Coordinator asks for specific fields, beneficiary changes only those, previous answers kept as a revision (FR-016)');
 await send(0,'application.review',{id:idemApp.id});
 await send(0,'application.decide',{id:idemApp.id,to:'Accepted',reason:'قبول لاختبار الأنشطة',override:'تجاوز التقييم لأغراض الاختبار'});
 await send(0,'program.transition',{programId:idem.id,to:'RegistrationClosed',version:3});
 await send(0,'program.update',{programId:idem.id,version:1,capacity:3,nameAr:'اختبار التكرار المعدل',nameEn:'Idempotency test edited',reason:'اختبار تعديل البرنامج'},409);
 await send(0,'program.update',{programId:idem.id,version:4,capacity:3,nameAr:'اختبار التكرار المعدل',nameEn:'Idempotency test edited',reason:'اختبار تعديل البرنامج'});
 assert.equal((await db.program.findUniqueOrThrow({where:{id:idem.id}})).capacity,3);
 await send(0,'program.transition',{programId:idem.id,to:'Active',version:5});
 const cancelled=await send(0,'activity.create',{programId:idem.id,nameAr:'نشاط سيُلغى',nameEn:'Activity to cancel',startsAt:at(5),endsAt:at(5.1),location:'جدة',required:true});
 await send(0,'activity.cancel',{id:cancelled.id,reason:'تعذر توفر القاعة'});
 assert.equal((await db.activity.findUniqueOrThrow({where:{id:cancelled.id}})).status,'Cancelled');
 assert.equal(await db.outbox.count({where:{dedupeKey:`cancel:${cancelled.id}:${beneficiary.id}`}}),1);
 await send(0,'activity.cancel',{id:cancelled.id,reason:'إلغاء مكرر'},409);
 step('Program edit with version check and audit, activity cancellation notifying participants once (FR-010, FR-026)');

 /* ── Exports as jobs (FR-035) ── */
 const job=await send(0,'export.request',{type:'applications',locale:'ar'});
 const download=await contexts[0].request.get(`${base}${job.href}`);assert.equal(download.status(),200);assert.match(download.headers()['content-type'],/text\/csv/);
 const csv=await download.text();assert.ok(csv.startsWith('﻿'));assert.ok(csv.includes(application.reference));
 assert.equal((await contexts[2].request.get(`${base}${job.href}`)).status(),404);
 await send(2,'export.request',{type:'applications'},403);
 const aggregate=await send(2,'export.request',{type:'impact'});const viewerCsv=await (await contexts[2].request.get(`${base}${aggregate.href}`)).text();assert.ok(!viewerCsv.includes('مستخدم الاختبار'));
 await db.exportJob.update({where:{id:job.id},data:{expiresAt:new Date(Date.now()-1000)}});
 assert.equal((await contexts[0].request.get(`${base}${job.href}`)).status(),410);
 assert.ok(await db.notification.findFirst({where:{userId:admin.id,titleEn:'Your export is ready'}}));
 step('Export jobs: audited download, owner only, viewer gets aggregates without names, link expires (FR-035, AC-02, AC-07)');

 /* ── Privacy rights (FR-044) ── */
 const access=await send(1,'privacy.create',{type:'Access'});
 await send(1,'privacy.create',{type:'Access'},409);
 await send(0,'privacy.update',{id:access.id,to:'IdentityVerified',reason:'تم التحقق عبر البريد المسجل'});
 await send(0,'privacy.update',{id:access.id,to:'InProgress',reason:'جارٍ تجهيز النسخة'});
 await send(0,'privacy.fulfil',{id:access.id,reason:'أُنتجت نسخة البيانات'});
 const subject=await db.exportJob.findFirstOrThrow({where:{tenantId:tenant.id,userId:beneficiary.id,type:'subject'}});
 const pkg=await contexts[1].request.get(`${base}/api/export?job=${subject.id}`);assert.equal(pkg.status(),200);const pkgText=await pkg.text();assert.ok(pkgText.includes(application.reference)&&pkgText.includes('privacyNotice'));
 assert.equal((await contexts[0].request.get(`${base}/api/export?job=${subject.id}`)).status(),404);
 const correction=await send(0,'privacy.create',{type:'Correction',userId:beneficiary.id,note:'طلب ورد بالبريد'});
 await send(0,'privacy.update',{id:correction.id,to:'IdentityVerified',reason:'تم التحقق'});await send(0,'privacy.update',{id:correction.id,to:'InProgress',reason:'قيد التنفيذ'});
 await send(0,'privacy.fulfil',{id:correction.id,reason:'بلا تغييرات'},400);
 await send(0,'privacy.fulfil',{id:correction.id,reason:'تصحيح الاسم حسب الهوية',changes:{name:'مستخدم الاختبار المصحح'}});
 assert.equal((await db.beneficiary.findUniqueOrThrow({where:{id:application.beneficiaryId}})).name,'مستخدم الاختبار المصحح');
 assert.equal((await db.privacyRequest.findUniqueOrThrow({where:{id:correction.id}})).status,'Fulfilled');
 await send(1,'profile.update',{name:'مستخدم الاختبار',phone:'+966500000001'});
 assert.equal((await db.beneficiary.findUniqueOrThrow({where:{id:application.beneficiaryId}})).phone,'+966500000001');
 await send(1,'profile.update',{name:'مستخدم الاختبار',phone:'0500000001'},422);
 step('Access request fulfilled with a downloadable package only its owner can open, correction on behalf, profile update (FR-024, FR-044)');

 /* ── Retention queue and erasure (FR-045, AC-09) ── */
 const candidate=await db.deletionCandidate.create({data:{tenantId:tenant.id,beneficiaryId:application.beneficiaryId,reason:'retention test',dueAt:new Date()}});
 await send(0,'deletion.decide',{id:candidate.id,approve:true,reason:'اعتماد الإتلاف'},409);
 await send(0,'deletion.decide',{id:candidate.id,approve:false,reason:'ما زال لديه مشاركة قائمة'});
 assert.equal((await db.deletionCandidate.findUniqueOrThrow({where:{id:candidate.id}})).status,'Dismissed');
 const erasable=await db.beneficiary.create({data:{tenantId:tenant.id,userId:randomUUID(),name:'شخص للإتلاف',email:'erase@example.invalid'}});
 const erasableApp=await db.application.create({data:{tenantId:tenant.id,programId:contested.id,beneficiaryId:erasable.id,status:'Rejected',reference:'TEST-ERASE'}});
 const erase=await db.deletionCandidate.create({data:{tenantId:tenant.id,beneficiaryId:erasable.id,reason:'retention test',dueAt:new Date()}});
 await send(0,'beneficiary.hold',{id:erasable.id,legalHold:true,reason:'حجز قانوني للاختبار'});
 await send(0,'deletion.decide',{id:erase.id,approve:true,reason:'اعتماد الإتلاف'},409);
 await send(0,'beneficiary.hold',{id:erasable.id,legalHold:false,reason:'رفع الحجز'});
 await send(0,'deletion.decide',{id:erase.id,approve:true,reason:'اعتماد الإتلاف بعد انتهاء الاحتفاظ'});
 assert.equal(await db.application.count({where:{id:erasableApp.id}}),0);
 assert.equal((await db.beneficiary.findUniqueOrThrow({where:{id:erasable.id}})).status,'Anonymized');
 assert.ok(await db.deletionTombstone.findUnique({where:{tenantId_beneficiaryId:{tenantId:tenant.id,beneficiaryId:erasable.id}}}));
 step('Retention queue: live enrollment and legal hold block deletion, approved deletion leaves a tombstone (FR-045, AC-09)');

 /* ── Tenant isolation (AC-02) ── */
 const foreign=await db.program.findFirst({where:{tenantId:{not:tenant.id}}});
 if(foreign){await send(0,'program.transition',{programId:foreign.id,to:'Cancelled',version:foreign.version,reason:'اختبار العزل'},404);await send(0,'export.request',{type:'impact',programId:foreign.id},404);}
 const foreignJob=await db.exportJob.findFirst({where:{tenantId:{not:tenant.id}}});
 if(foreignJob)assert.equal((await contexts[0].request.get(`${base}/api/export?job=${foreignJob.id}`)).status(),404);
 step('Foreign tenant ids return 404 through commands and exports (AC-02)');

 /* ── Pages (NFR-08) ── */
 const page=contexts[0].pages()[0];const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const locale of ['ar','en'])for(const route of ['','programs','beneficiaries','applications','activities','impact','reports','team','privacy','billing']){
  const response=await page.goto(`${base}/${locale}/${route}`);assert.equal(response?.status(),200,`${locale}/${route}`);
  assert.equal(await page.locator('html').getAttribute('dir'),locale==='ar'?'rtl':'ltr');
 }
 const bpage=contexts[1].pages()[0];for(const route of ['','applications','privacy','beneficiaries']){assert.equal((await bpage.goto(`${base}/ar/${route}`))?.status(),200);}
 await page.goto(`${base}/en`);await page.screenshot({path:'../outputs/ProgramOS_dashboard_en.png',fullPage:true});
 await page.goto(`${base}/ar/reports`);await page.screenshot({path:'../outputs/ProgramOS_reports_ar.png',fullPage:true});
 await page.goto(`${base}/ar`);await page.screenshot({path:'../outputs/ProgramOS_dashboard_ar.png',fullPage:true});
 await page.setViewportSize({width:360,height:800});
 // Checked on the table heavy pages too: a wide table must scroll inside its
 // own container rather than stretch the page.
 for(const route of ['','reports','applications','team']){
  await page.goto(`${base}/ar/${route}`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`Mobile overflow on /${route}`);
 }
 await page.goto(`${base}/ar`);
 await page.screenshot({path:'../outputs/ProgramOS_mobile_ar.png',fullPage:true});assert.deepEqual(errors,[]);
 step('24 localized routes render without client errors, RTL and LTR correct, 360px layout has no horizontal scroll (NFR-08)');

 /* ── Support access (FR-047) and session revocation (AC-07) ── */
 const grant=await send(0,'support.grant',{email:viewer.email,hours:1,reason:'مساعدة في تحقيق سجل التدقيق'});
 assert.ok(new Date(grant.expiresAt)>new Date());
 await send(2,'outbox.retry',{id:randomUUID()},404);
 await send(0,'support.revoke',{id:grant.id,reason:'انتهى العمل'});
 await send(2,'report.snapshot',{title:'بعد إلغاء الوصول'},403);
 const latest=await db.audit.findFirstOrThrow({where:{tenantId:tenant.id,action:'support.revoke'}});assert.ok(latest.correlationId.length>=8);
 await send(0,'session.revoke',{});await send(0,'report.snapshot',{title:'بعد إبطال الجلسة'},401);
 step('Time boxed support access granted then revoked, correlation ids on audit rows, session revocation (FR-047, AC-07)');

 console.log('PASS');for(const p of passed)console.log(' •',p);
 console.log(`\nWorkspace kept for review: ${tenant.slug}\nAdmin: ${admin.email} / ${password} (MFA secret ${secrets.get(admin.id)})\nBeneficiary: ${beneficiary.email} / ${password}`);
}finally{await browser.close();await db.$disconnect();}
