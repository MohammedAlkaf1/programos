import {db} from './db';
import {scope,type Actor} from './access';
import {pairedResults,programKpis,targetAchievement,type ProgramKpis} from './domain';
export type StateOptions={programId?:string;cutoffAt?:Date};
/**
 * The single read that feeds every screen, export and snapshot. Personal
 * fields are masked by role here, so nothing downstream has to remember to.
 */
export async function getState(a:Actor,opts:StateOptions={}){
 const cutoff=opts.cutoffAt??new Date();
 const programRows=await db.program.findMany({where:{...scope(a),...(opts.programId?{id:opts.programId}:{}),...(a.role==='Beneficiary'?{status:{not:'Draft'}}:{})},orderBy:{createdAt:'desc'},include:{activities:true,indicators:true}});
 const ownerIds=[...new Set(programRows.map(p=>p.ownerId).filter((x):x is string=>!!x))];
 const activeOwners=new Set(ownerIds.length?(await db.membership.findMany({where:{tenantId:a.tenantId,userId:{in:ownerIds},active:true},select:{userId:true}})).map(m=>m.userId):[]);
 const programs=programRows.map(p=>({...p,ownerActive:!!p.ownerId&&activeOwners.has(p.ownerId)}));
 const ids=programs.map(p=>p.id);
 const applicationWhere={tenantId:a.tenantId,programId:{in:ids},...(a.role==='Beneficiary'?{beneficiary:{userId:a.userId}}:{status:{not:'Draft'}}),...(a.role==='Reviewer'?{reviewerIds:{has:a.userId}}:{})};
 const staff=['Admin','Manager','Coordinator'].includes(a.role);
 const raw=await db.application.findMany({where:applicationWhere,include:{beneficiary:true,evaluations:true,enrollment:{include:{attendance:true,measurements:true}}},orderBy:{createdAt:'desc'}});
 const revisions=(staff||a.role==='Beneficiary')&&raw.length?await db.applicationRevision.findMany({where:{tenantId:a.tenantId,applicationId:{in:raw.map(x=>x.id)}},orderBy:{revision:'asc'}}):[];
 const masked=['Viewer','Impact'].includes(a.role);
 const safe=raw.map(x=>({...x,beneficiary:masked?{id:x.beneficiary.id,name:'••••',email:'',userId:'',status:x.beneficiary.status}:x.beneficiary,evaluations:a.role==='Beneficiary'?[]:a.role==='Reviewer'?x.evaluations.filter(e=>e.reviewerId===a.userId):x.evaluations,answers:masked?{}:x.answers,reviewerIds:a.role==='Beneficiary'?[]:x.reviewerIds,revisions:revisions.filter(r=>r.applicationId===x.id)}));
 const totals={programs:programs.length,applications:raw.length,enrolled:raw.filter(x=>x.enrollment&&!['Withdrawn','Cancelled'].includes(x.enrollment.status)).length,completed:raw.filter(x=>x.enrollment?.status==='Completed').length};
 const kpis:Record<string,ProgramKpis>={};for(const p of programs)kpis[p.id]=programKpis(raw.filter(x=>x.programId===p.id),p.capacity,cutoff);
 const indicators=programs.flatMap(p=>p.indicators.map(i=>{const paired=pairedResults(raw.flatMap(x=>x.enrollment?.measurements.filter(m=>m.indicatorId===i.id&&m.createdAt<=cutoff)??[]),raw.filter(x=>x.programId===p.id&&x.enrollment).length);const endline=raw.flatMap(x=>x.enrollment?.measurements.filter(m=>m.indicatorId===i.id&&m.period==='Endline'&&m.status==='Verified')??[]);const actual=endline.length?endline.reduce((s,m)=>s+m.value,0)/endline.length:null;return {...i,...paired,achievement:targetAchievement(i.direction,actual,i.target),actual};}));
 const [memberships,notifications,members,audit,privacy,snapshots,initiatives,exports,failedMail,deletionCandidates,profile]=await Promise.all([
 db.membership.findMany({where:{userId:a.userId,active:true},include:{tenant:true}}),
 db.notification.findMany({where:{tenantId:a.tenantId,userId:a.userId},orderBy:{createdAt:'desc'},take:50}),
 a.role==='Admin'?db.membership.findMany({where:{tenantId:a.tenantId},include:{user:{select:{id:true,name:true,email:true}}}}):Promise.resolve([]),
 a.role==='Admin'?db.audit.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},take:300}):Promise.resolve([]),
 db.privacyRequest.findMany({where:{tenantId:a.tenantId,...(a.role==='Admin'?{}:{userId:a.userId})},orderBy:{createdAt:'desc'}}),
 ['Admin','Manager','Impact','Viewer'].includes(a.role)?db.reportSnapshot.findMany({where:{tenantId:a.tenantId,...(a.role==='Admin'?{}:{userId:a.userId})},orderBy:{createdAt:'desc'}}):Promise.resolve([]),
 db.initiative.findMany({where:{tenantId:a.tenantId}}),
 db.exportJob.findMany({where:{tenantId:a.tenantId,OR:[{userId:a.userId},...(a.role==='Admin'?[{type:{not:'subject'}}]:[])]},orderBy:{createdAt:'desc'},take:20,select:{id:true,userId:true,type:true,status:true,filters:true,rows:true,expiresAt:true,createdAt:true,completedAt:true,error:true}}),
 a.role==='Admin'?db.outbox.findMany({where:{tenantId:a.tenantId,status:'Failed'},orderBy:{createdAt:'desc'},take:50,select:{id:true,recipient:true,subject:true,attempts:true,createdAt:true}}):Promise.resolve([]),
 a.role==='Admin'?db.deletionCandidate.findMany({where:{tenantId:a.tenantId,status:'Pending'},orderBy:{dueAt:'asc'}}):Promise.resolve([]),
 db.beneficiary.findUnique({where:{tenantId_userId:{tenantId:a.tenantId,userId:a.userId}},select:{name:true,email:true,phone:true,status:true}})
 ]);
 const candidateNames=deletionCandidates.length?await db.beneficiary.findMany({where:{id:{in:deletionCandidates.map(c=>c.beneficiaryId)}},select:{id:true,name:true,email:true}}):[];
 const aggregateOnly=a.role==='Viewer';
 const notes=staff?await db.operationalNote.findMany({where:{tenantId:a.tenantId,programId:{in:ids}},orderBy:{createdAt:'desc'}}):[];
 const consents=staff?await db.consentRecord.findMany({where:{tenantId:a.tenantId,beneficiaryId:{in:[...new Set(raw.map(x=>x.beneficiaryId))]}},orderBy:{givenAt:'desc'}}):a.role==='Beneficiary'?await db.consentRecord.findMany({where:{tenantId:a.tenantId,beneficiaryId:{in:[...new Set(raw.map(x=>x.beneficiaryId))]}},orderBy:{givenAt:'desc'}}):[];
 return JSON.parse(JSON.stringify({actor:a,asOf:new Date().toISOString(),cutoffAt:cutoff.toISOString(),programs,applications:aggregateOnly?[]:safe,indicators:aggregateOnly?indicators.map(i=>({...i,change:i.pairs<5?null:i.change,coverage:i.pairs<5?null:i.coverage,actual:i.pairs<5?null:i.actual,achievement:i.pairs<5?{percent:null,gap:null}:i.achievement})):indicators,kpis,totals,memberships,notifications,members,audit,privacy,snapshots,initiatives,notes,exports,failedMail,deletionCandidates:deletionCandidates.map(c=>({...c,beneficiary:candidateNames.find(b=>b.id===c.beneficiaryId)??null})),profile,consents}));
}
