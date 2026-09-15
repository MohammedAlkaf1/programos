export const roles=['Admin','Manager','Coordinator','Reviewer','Impact','Viewer','Beneficiary'] as const;
export type Role=typeof roles[number];
export const transitions:Record<string,string[]>={Draft:['Published','Cancelled'],Published:['RegistrationOpen','Cancelled'],RegistrationOpen:['RegistrationClosed','Cancelled'],RegistrationClosed:['RegistrationOpen','Active','Cancelled'],Active:['Completed','Cancelled'],Completed:['Archived'],Cancelled:['Archived'],Archived:[]};
export function canTransition(from:string,to:string){return transitions[from]?.includes(to)??false;}
export function weightedScore(rubric:{weight:number}[],scores:number[]){
 if(!rubric.length||rubric.reduce((s,x)=>s+x.weight,0)!==100||scores.length!==rubric.length||scores.some(x=>!Number.isFinite(x)||x<0||x>5))throw new Error('invalid');
 return rubric.reduce((s,r,i)=>s+r.weight*scores[i]/5,0);
}
export function pairedResults(rows:{enrollmentId:string;period:string;value:number;status:string}[],target:number){
 const pairs=new Map<string,{Baseline?:number;Endline?:number}>();
 for(const r of rows)if(r.status==='Verified')pairs.set(r.enrollmentId,{...pairs.get(r.enrollmentId),[r.period]:r.value});
 const complete=[...pairs.values()].filter(x=>x.Baseline!==undefined&&x.Endline!==undefined);
 return {pairs:complete.length,change:complete.length?complete.reduce((s,x)=>s+x.Endline!-x.Baseline!,0)/complete.length:null,coverage:target?complete.length/target*100:null};
}
export function csvCell(value:unknown){let s=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function completion(statuses:string[],threshold:number){const included=statuses.filter(x=>x!=='Excused');return included.length>0&&!included.includes('NotRecorded')&&included.filter(x=>x==='Present').length/included.length*100>=threshold;}
export class DomainError extends Error {constructor(public code:string,public status=400){super(code);}}
export function ratio(numerator:number,denominator:number){return denominator>0?numerator/denominator*100:null;}
export function median(values:number[]){if(!values.length)return null;const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
export type KpiApplication={status:string;submittedAt:string|Date|null;firstDecidedAt:string|Date|null;enrollment:{status:string}|null};
/** Section 14 KPI dictionary. Every denominator of zero yields null so the UI renders N/A instead of 0%. */
export function programKpis(apps:KpiApplication[],capacity:number,cutoff:Date=new Date()){
 const at=(v:string|Date|null)=>v?new Date(v).getTime():null;
 const submitted=apps.filter(a=>{const t=at(a.submittedAt);return t!==null&&t<=cutoff.getTime();});
 const decided=submitted.filter(a=>['Accepted','Rejected','Waitlisted'].includes(a.status)||a.enrollment);
 const accepted=submitted.filter(a=>a.status==='Accepted'||a.enrollment);
 const pending=submitted.filter(a=>['Submitted','UnderReview','NeedsInfo'].includes(a.status)).length;
 const hours=submitted.map(a=>{const s=at(a.submittedAt),d=at(a.firstDecidedAt);return s!==null&&d!==null&&d<=cutoff.getTime()?(d-s)/3600000:null;}).filter((x):x is number=>x!==null);
 const enrollments=apps.filter(a=>a.enrollment),occupied=enrollments.filter(a=>!['Withdrawn','Cancelled'].includes(a.enrollment!.status)),completed=enrollments.filter(a=>a.enrollment!.status==='Completed');
 const withdrawn=enrollments.filter(a=>['Withdrawn','Cancelled'].includes(a.enrollment!.status)).length;
 return {submitted:submitted.length,pending,decided:decided.length,acceptanceRate:ratio(accepted.length,decided.length),decisionHours:median(hours),occupied:occupied.length,capacity,fill:ratio(occupied.length,capacity),enrollments:enrollments.length,completed:completed.length,withdrawn,completionRate:ratio(completed.length,enrollments.length)};
}
export type ProgramKpis=ReturnType<typeof programKpis>;
/** Target achievement: for Higher-is-better indicators a percentage of target; for Lower-is-better the signed gap, never an inverted ratio. */
export function targetAchievement(direction:string,actual:number|null,target:number){
 if(actual===null)return {percent:null,gap:null};
 if(direction==='Higher')return {percent:target?actual/target*100:null,gap:actual-target};
 return {percent:null,gap:actual-target};
}
export const FORMULA_VERSION='2';
/**
 * FR-008: what still stands between a draft and publication. The same list is
 * shown to the manager as a checklist and enforced by `program.transition`, so
 * the screen never promises a publish the server will refuse.
 */
export type PublishBlocker='form'|'rubric'|'privacy'|'owner';
export function publishBlockers(program:{form:unknown[];rubric:{weight:number}[];privacyAr:string;privacyEn:string;ownerId:string|null},ownerActive:boolean):PublishBlocker[]{
 const blockers:PublishBlocker[]=[];
 if(!Array.isArray(program.form)||program.form.length===0)blockers.push('form');
 if(!program.rubric.length||program.rubric.reduce((s,r)=>s+r.weight,0)!==100)blockers.push('rubric');
 if(!program.privacyAr.trim()||!program.privacyEn.trim())blockers.push('privacy');
 if(!program.ownerId||!ownerActive)blockers.push('owner');
 return blockers;
}
