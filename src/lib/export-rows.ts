import {db} from './db';
import {DomainError} from './domain';
import type {Actor} from './access';
/** Row builders shared by export jobs. Every builder receives the role masked state, so a Viewer can never receive a name through a CSV. */
export const exportTypes=['applications','attendance','impact','programs','subject'] as const;
export type ExportType=typeof exportTypes[number];
export const exportRoles:Record<ExportType,string[]>={applications:['Admin','Manager','Coordinator'],attendance:['Admin','Manager','Coordinator'],impact:['Admin','Manager','Impact','Viewer'],programs:['Admin','Manager','Impact','Viewer'],subject:['Admin']};
type Row=unknown[];
const label=(ar:boolean,a:string,e:string)=>ar?a:e;
export function stateRows(type:ExportType,s:any,ar:boolean,filters:{programId?:string}={}):Row[]{
 const programs=s.programs.filter((p:any)=>!filters.programId||p.id===filters.programId);
 const apps=s.applications.filter((x:any)=>!filters.programId||x.programId===filters.programId);
 const name=(p:any)=>ar?p?.nameAr:p?.nameEn;
 if(type==='impact')return [[label(ar,'المؤشر','Indicator'),label(ar,'البرنامج','Program'),label(ar,'الوحدة','Unit'),label(ar,'الهدف','Target'),label(ar,'التغير','Change'),label(ar,'الأزواج المكتملة','Complete pairs'),label(ar,'التغطية','Coverage')],
  ...s.indicators.filter((i:any)=>!filters.programId||i.programId===filters.programId).map((i:any)=>[name(i),name(programs.find((p:any)=>p.id===i.programId)),i.unit,i.target,i.change??'N/A',i.pairs,i.coverage??'N/A'])];
 if(type==='applications')return [[label(ar,'المرجع','Reference'),label(ar,'الاسم','Name'),label(ar,'البريد','Email'),label(ar,'البرنامج','Program'),label(ar,'الحالة','Status'),label(ar,'تاريخ التقديم','Submitted at'),label(ar,'أول قرار','First decision')],
  ...apps.map((x:any)=>[x.reference,x.beneficiary.name,x.beneficiary.email,name(programs.find((p:any)=>p.id===x.programId)),x.status,x.submittedAt??'',x.firstDecidedAt??''])];
 if(type==='attendance')return [[label(ar,'المستفيد','Beneficiary'),label(ar,'البرنامج','Program'),label(ar,'النشاط','Activity'),label(ar,'الموعد','Starts'),label(ar,'الحضور','Attendance')],
  ...apps.flatMap((x:any)=>{const p=programs.find((p:any)=>p.id===x.programId);return x.enrollment?(p?.activities??[]).filter((a:any)=>a.status!=='Cancelled').map((act:any)=>[x.beneficiary.name,name(p),name(act),act.startsAt,x.enrollment.attendance.find((r:any)=>r.activityId===act.id)?.status??'NotRecorded']):[];})];
 if(type==='programs')return [[label(ar,'البرنامج','Program'),label(ar,'الحالة','Status'),label(ar,'الطلبات','Applications'),label(ar,'بانتظار القرار','Pending'),label(ar,'معدل القبول','Acceptance rate'),label(ar,'وسيط زمن القرار بالساعات','Median decision hours'),label(ar,'الإشغال','Fill'),label(ar,'معدل الإكمال','Completion rate')],
  ...programs.map((p:any)=>{const k=s.kpis?.[p.id];return [name(p),p.status,k?.submitted??0,k?.pending??0,k?.acceptanceRate??'N/A',k?.decisionHours??'N/A',k?.fill??'N/A',k?.completionRate??'N/A'];})];
 throw new DomainError('invalid');
}
/** Everything the platform holds about one person inside one tenant, for Access and Copy requests. Staff notes are excluded by design. */
export async function subjectRows(a:Actor,userId:string,ar:boolean):Promise<Row[]>{
 const rows:Row[]=[[label(ar,'القسم','Section'),label(ar,'الحقل','Field'),label(ar,'القيمة','Value')]];
 const user=await db.user.findUnique({where:{id:userId}});const b=await db.beneficiary.findFirst({where:{tenantId:a.tenantId,userId}});
 if(!user||!await db.membership.findFirst({where:{tenantId:a.tenantId,userId}}))throw new DomainError('notFound',404);
 rows.push(['account','name',user.name],['account','email',user.email],['account','createdAt',user.createdAt.toISOString()]);
 if(b){rows.push(['profile','name',b.name],['profile','email',b.email],['profile','phone',b.phone??''],['profile','status',b.status]);
  const apps=await db.application.findMany({where:{tenantId:a.tenantId,beneficiaryId:b.id},include:{program:true,enrollment:{include:{attendance:{include:{activity:true}},measurements:{include:{indicator:true}}}}}});
  for(const x of apps){const key=`application ${x.reference||x.id.slice(0,8)}`;rows.push([key,'program',ar?x.program.nameAr:x.program.nameEn],[key,'status',x.status],[key,'submittedAt',x.submittedAt?.toISOString()??''],[key,'privacyNotice',x.privacySnapshot]);
   for(const [field,value] of Object.entries(x.answers as Record<string,unknown>))rows.push([key,`answer ${field}`,Array.isArray(value)?value.join(' | '):String(value)]);
   if(x.enrollment){rows.push([key,'enrollment',x.enrollment.status]);for(const r of x.enrollment.attendance)rows.push([key,`attendance ${ar?r.activity.nameAr:r.activity.nameEn}`,r.status]);for(const m of x.enrollment.measurements)rows.push([key,`${m.period} ${ar?m.indicator.nameAr:m.indicator.nameEn}`,`${m.value} ${m.indicator.unit} (${m.status})`]);}}
  for(const c of await db.consentRecord.findMany({where:{tenantId:a.tenantId,beneficiaryId:b.id}}))rows.push(['consent',c.givenAt.toISOString(),c.withdrawnAt?`withdrawn ${c.withdrawnAt.toISOString()}`:'active']);
 }
 for(const r of await db.privacyRequest.findMany({where:{tenantId:a.tenantId,userId}}))rows.push(['privacyRequest',r.type,`${r.status} ${r.createdAt.toISOString()}`]);
 return rows;
}
