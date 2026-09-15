import {describe,expect,it} from 'vitest';
import {programKpis,ratio,median,targetAchievement,pairedResults} from '../src/lib/domain';
import {validateAnswers} from '../src/lib/answers';
import type {FormField} from '../src/lib/types';

const h=3600000;
const t0=new Date('2026-09-01T08:00:00Z');
const app=(status:string,submittedHoursAgo:number|null,decidedAfterHours:number|null,enrollment:string|null)=>({status,submittedAt:submittedHoursAgo===null?null:new Date(t0.getTime()-submittedHoursAgo*h),firstDecidedAt:submittedHoursAgo!==null&&decidedAfterHours!==null?new Date(t0.getTime()-submittedHoursAgo*h+decidedAfterHours*h):null,enrollment:enrollment?{status:enrollment}:null});

describe('section 14 KPI dictionary',()=>{
 it('returns null for every ratio with a zero denominator instead of 0',()=>{
  const k=programKpis([],10,t0);
  expect(k.acceptanceRate).toBeNull();expect(k.completionRate).toBeNull();expect(k.decisionHours).toBeNull();expect(k.fill).toBe(0);
  expect(ratio(0,0)).toBeNull();expect(ratio(1,4)).toBe(25);
 });
 it('counts acceptance over decided applications only and keeps pending separate',()=>{
  const k=programKpis([app('Accepted',48,10,'InProgress'),app('Rejected',40,4,null),app('Waitlisted',30,2,null),app('UnderReview',5,null,null),app('Draft',null,null,null)],10,t0);
  expect(k.submitted).toBe(4);expect(k.pending).toBe(1);expect(k.decided).toBe(3);expect(k.acceptanceRate).toBeCloseTo(100/3);
 });
 it('uses the median of first decision minus submission in hours',()=>{
  const k=programKpis([app('Accepted',48,10,'InProgress'),app('Rejected',40,4,null),app('Waitlisted',30,2,null)],10,t0);
  expect(k.decisionHours).toBe(4);expect(median([1,2,3,4])).toBe(2.5);expect(median([])).toBeNull();
 });
 it('includes withdrawn enrollments in the completion denominator but not in fill',()=>{
  const k=programKpis([app('Accepted',48,1,'Completed'),app('Accepted',48,1,'Withdrawn'),app('Accepted',48,1,'InProgress'),app('Accepted',48,1,'Suspended')],4,t0);
  expect(k.enrollments).toBe(4);expect(k.completed).toBe(1);expect(k.withdrawn).toBe(1);expect(k.completionRate).toBe(25);
  expect(k.occupied).toBe(3);expect(k.fill).toBe(75);
 });
 it('respects the cutoff for submissions and decisions',()=>{
  const cutoff=new Date(t0.getTime()-20*h);
  const k=programKpis([app('Accepted',48,10,'InProgress'),app('Rejected',10,1,null)],10,cutoff);
  expect(k.submitted).toBe(1);expect(k.decisionHours).toBe(10);
 });
 it('never inverts a lower-is-better ratio',()=>{
  expect(targetAchievement('Higher',80,100).percent).toBe(80);
  expect(targetAchievement('Lower',30,20)).toEqual({percent:null,gap:10});
  expect(targetAchievement('Higher',null,100)).toEqual({percent:null,gap:null});
  expect(targetAchievement('Higher',50,0).percent).toBeNull();
 });
 it('AC-06: pairs 40 to 60 and 50 to 70 with a third endline give change 20 and coverage 66.7%',()=>{
  const rows=[{enrollmentId:'a',period:'Baseline',value:40,status:'Verified'},{enrollmentId:'a',period:'Endline',value:60,status:'Verified'},{enrollmentId:'b',period:'Baseline',value:50,status:'Verified'},{enrollmentId:'b',period:'Endline',value:70,status:'Verified'},{enrollmentId:'c',period:'Endline',value:90,status:'Verified'}];
  const r=pairedResults(rows,3);expect(r.pairs).toBe(2);expect(r.change).toBe(20);expect(r.coverage).toBeCloseTo(66.7,1);
 });
});

describe('form answer validation',()=>{
 const form:FormField[]=[{id:'motivation',labelAr:'أ',labelEn:'a',type:'textarea',required:true},{id:'age',labelAr:'ب',labelEn:'b',type:'number',required:false},{id:'city',labelAr:'ج',labelEn:'c',type:'select',required:true,options:['الرياض','جدة']},{id:'files',labelAr:'د',labelEn:'d',type:'attachment',required:false}];
 it('rejects unknown fields even for drafts',()=>{expect(()=>validateAnswers(form,{other:'x'},false)).toThrow('invalid');});
 it('lets a draft skip required fields but a submission not',()=>{
  expect(validateAnswers(form,{age:'12'},false)).toEqual([]);
  expect(()=>validateAnswers(form,{motivation:'',city:'الرياض'},true)).toThrow('required');
 });
 it('checks types and options on submission',()=>{
  expect(()=>validateAnswers(form,{motivation:'ok',city:'مكة'},true)).toThrow('invalid');
  expect(()=>validateAnswers(form,{motivation:'ok',city:'الرياض',age:'abc'},true)).toThrow('invalid');
  expect(validateAnswers(form,{motivation:'ok',city:'الرياض',age:'30'},true)).toEqual([]);
 });
 it('returns attachment ids and caps them at five unique files',()=>{
  const ids=Array.from({length:5},(_,i)=>`0000000${i}-0000-4000-8000-000000000000`);
  expect(validateAnswers(form,{files:ids},false)).toEqual(ids);
  expect(()=>validateAnswers(form,{files:[...ids,'00000009-0000-4000-8000-000000000000']},false)).toThrow('invalid');
  expect(()=>validateAnswers(form,{files:['not-a-uuid']},false)).toThrow('invalid');
 });
});
