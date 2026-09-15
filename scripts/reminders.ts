/**
 * Queues the 24 hour reminders (FR-038) and the privacy deadline notices
 * (section 14). Run hourly; the dedupe keys make repeated runs harmless.
 *
 *   npm run reminders
 */
import 'dotenv/config';
import {db} from '../src/lib/db';
const now=new Date(),until=new Date(Date.now()+86400000),threeDays=new Date(Date.now()+3*86400000);
const url=`${process.env.APP_URL??'http://127.0.0.1:3000'}/ar`;
async function remind(tenantId:string,userId:string,key:string,titleAr:string,titleEn:string,href:string,optional=true){
 await db.$transaction(async tx=>{
  const user=await tx.user.findUnique({where:{id:userId}}),tenant=await tx.tenant.findUnique({where:{id:tenantId}});
  if(!user?.active||(optional&&!user.reminders)||tenant?.status!=='Active'||!await tx.membership.findFirst({where:{tenantId,userId,active:true}}))return;
  if(await tx.outbox.findUnique({where:{dedupeKey:key}}))return;
  await tx.outbox.create({data:{tenantId,recipient:user.email,subject:'ProgramOS',body:`${titleAr}\n${titleEn}\n${url}${href}`,dedupeKey:key}});
  await tx.notification.create({data:{tenantId,userId,titleAr,titleEn,href}});
 });
}
try{
 const pending=await db.application.findMany({where:{status:'NeedsInfo',infoDue:{gte:now,lte:until}},include:{beneficiary:true}});
 for(const app of pending){const current=await db.application.findUnique({where:{id:app.id}});if(current?.status==='NeedsInfo')await remind(app.tenantId,app.beneficiary.userId,`info:${app.id}:${app.infoDue?.toISOString()}`,'تنتهي مهلة استكمال طلبك خلال 24 ساعة','Your application completion deadline is within 24 hours','/applications');}
 const activities=await db.activity.findMany({where:{status:'Scheduled',startsAt:{gte:now,lte:until},program:{status:'Active'}}});
 for(const activity of activities){const apps=await db.application.findMany({where:{tenantId:activity.tenantId,programId:activity.programId,enrollment:{status:{in:['Enrolled','InProgress']}}},include:{beneficiary:true}});for(const app of apps)await remind(activity.tenantId,app.beneficiary.userId,`activity:${activity.id}:${app.beneficiary.userId}:${activity.startsAt.toISOString()}`,'لديك نشاط خلال 24 ساعة','You have an activity within 24 hours','/programs');}
 // Privacy requests approaching their statutory deadline go to every admin of the tenant, regardless of reminder preferences.
 const due=await db.privacyRequest.findMany({where:{status:{in:['New','IdentityVerified','InProgress']},dueAt:{lte:threeDays}}});
 for(const r of due){const admins=await db.membership.findMany({where:{tenantId:r.tenantId,role:'Admin',active:true}});for(const m of admins)await remind(r.tenantId,m.userId,`privacyDue:${r.id}:${m.userId}`,'طلب خصوصية يقترب من مهلته النظامية','A privacy request is nearing its deadline','/privacy',false);}
 console.log('Reminder queue updated');
}finally{await db.$disconnect();}
