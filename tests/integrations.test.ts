import {describe,expect,it} from 'vitest';
import {parseCsv,neutralise,suggestMapping} from '../src/lib/csv';
import {prepare,targetFields} from '../src/lib/import-jobs';
import {sign,verify,newSecret,TOLERANCE_SECONDS} from '../src/lib/signature';
import {nextAttempt,MAX_ATTEMPTS,eventTypes} from '../src/lib/events';
import {projection,icalendar,checksumOf,connectorFields} from '../src/lib/connectors';
import {render} from '../src/lib/messaging';
import {unsupportedNumbers,numbersIn,normaliseDigits,renderFacts,citationsIn,type Fact} from '../src/lib/ai-claims';
import {costOf} from '../src/lib/ai';
import type {FormField} from '../src/lib/types';

describe('CSV reading',()=>{
 it('strips the byte order mark Excel adds and detects a semicolon file',()=>{
  const sheet=parseCsv('﻿name;email\nسارة;s@example.org');
  expect(sheet.headers).toEqual(['name','email']);
  expect(sheet.rows[0]).toEqual(['سارة','s@example.org']);
 });
 it('keeps quoted commas and newlines inside one field',()=>{
  const sheet=parseCsv('name,note\n"العمري, سارة","سطر\nثانٍ"');
  expect(sheet.rows[0][0]).toBe('العمري, سارة');
  expect(sheet.rows[0][1]).toBe('سطر\nثانٍ');
 });
 it('neutralises text a spreadsheet would run as a formula',()=>{
  expect(neutralise('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
  expect(neutralise('+1')).toBe("'+1");
  expect(neutralise('@here')).toBe("'@here");
  expect(neutralise('سارة')).toBe('سارة');
 });
 it('suggests a mapping from headers in either language',()=>{
  const fields=targetFields('beneficiaries',[]);
  expect(suggestMapping(['الاسم','البريد الإلكتروني'],fields)).toEqual({name:'الاسم',email:'البريد الإلكتروني'});
  expect(suggestMapping(['Name','Email'],fields)).toEqual({name:'Name',email:'Email'});
 });
});

describe('import preview',()=>{
 const mapping={name:'name',email:'email',phone:'phone'};
 const sheet=(rows:string[][])=>({headers:['name','email','phone'],rows});
 it('reports a reason for every rejected row and keeps the good ones',()=>{
  const {report,rows}=prepare('beneficiaries',sheet([
   ['سارة','s@example.org','+966500000001'],
   ['','x@example.org',''],
   ['خالد','not-an-email',''],
   ['نورة','n@example.org','0500000001'],
   ['سارة مكررة','s@example.org',''],
  ]),mapping,[],new Set());
  expect(rows).toHaveLength(1);
  expect(report.map(r=>r.status)).toEqual(['create','error','error','error','skip']);
  expect(report[1].reason).toBe('nameMissing');
  expect(report[2].reason).toBe('emailInvalid');
  expect(report[3].reason).toBe('phoneInvalid');
  expect(report[4].reason).toBe('duplicateInFile');
 });
 it('skips someone who already exists in the workspace',()=>{
  const {report,rows}=prepare('beneficiaries',sheet([['سارة','s@example.org','']]),mapping,[],new Set(['s@example.org']));
  expect(rows).toHaveLength(0);
  expect(report[0]).toMatchObject({status:'skip',reason:'alreadyInWorkspace'});
 });
 it('validates program answers and refuses a form that needs an attachment',()=>{
  const form:FormField[]=[{id:'city',labelAr:'المدينة',labelEn:'City',type:'select',required:true,options:['الرياض']}];
  const withCity={...mapping,'answer.city':'city'};
  const ok=prepare('applications',{headers:['name','email','phone','city'],rows:[['سارة','s@example.org','','الرياض']]},withCity,form,new Set());
  expect(ok.rows[0].answers).toEqual({city:'الرياض'});
  const bad=prepare('applications',{headers:['name','email','phone','city'],rows:[['سارة','s@example.org','','مكة']]},withCity,form,new Set());
  expect(bad.report[0]).toMatchObject({status:'error',field:'answers'});
  const attachment:FormField[]=[{id:'file',labelAr:'ملف',labelEn:'File',type:'attachment',required:true}];
  const refused=prepare('applications',sheet([['سارة','s@example.org','']]),mapping,attachment,new Set());
  expect(refused.report[0].reason).toBe('attachmentRequired');
 });
 it('treats a formula cell as text rather than executing meaning from it',()=>{
  const {rows}=prepare('beneficiaries',sheet([['=cmd|calc','s@example.org','']]),mapping,[],new Set());
  expect(rows[0].name).toBe('=cmd|calc');
 });
});

describe('webhook signatures',()=>{
 const secret=newSecret();
 const body=JSON.stringify({type:'application.submitted'});
 it('accepts a signature it just produced',()=>{
  expect(verify(secret,body,sign(secret,body))).toEqual({ok:true});
 });
 it('refuses a body that changed by one byte',()=>{
  expect(verify(secret,body+' ',sign(secret,body))).toEqual({ok:false,reason:'mismatch'});
 });
 it('refuses another tenant secret',()=>{
  expect(verify(newSecret(),body,sign(secret,body))).toEqual({ok:false,reason:'mismatch'});
 });
 it('refuses a captured request replayed after the window',()=>{
  const old=Math.floor(Date.now()/1000)-TOLERANCE_SECONDS-1;
  expect(verify(secret,body,sign(secret,body,old))).toEqual({ok:false,reason:'stale'});
 });
 it('refuses a header that is missing or malformed',()=>{
  expect(verify(secret,body,null)).toEqual({ok:false,reason:'malformed'});
  expect(verify(secret,body,'v1=abc')).toEqual({ok:false,reason:'malformed'});
 });
});

describe('delivery backoff',()=>{
 it('grows the delay and gives up after the last attempt',()=>{
  const delays=Array.from({length:MAX_ATTEMPTS},(_,i)=>nextAttempt(i));
  expect(delays.map(d=>d.delayMs/60000)).toEqual([1,5,15,60,180,360]);
  expect(delays.slice(0,-1).every(d=>!d.dead)).toBe(true);
  expect(delays[MAX_ATTEMPTS-1].dead).toBe(true);
 });
 it('names every event type once',()=>{
  expect(new Set(eventTypes).size).toBe(eventTypes.length);
 });
});

describe('connectors',()=>{
 it('sends only mapped fields and never an unknown one',()=>{
  const source={title:'ورشة',startsAt:'2026-09-20',secretNote:'must not travel'};
  expect(projection('calendar',{title:'summary',startsAt:'dtstart',secretNote:'leak'},source)).toEqual({summary:'ورشة',dtstart:'2026-09-20'});
 });
 it('falls back to the standard names when no map is set',()=>{
  expect(projection('bi',{},{programName:'برنامج',completed:4,other:1})).toEqual({programName:'برنامج',completed:4});
 });
 it('lists a field set for every kind',()=>{
  for(const fields of Object.values(connectorFields))expect(fields.length).toBeGreaterThan(3);
 });
 it('changes the checksum when the payload changes',()=>{
  expect(checksumOf({a:1})).toBe(checksumOf({a:1}));
  expect(checksumOf({a:1})).not.toBe(checksumOf({a:2}));
 });
 it('produces a calendar with no personal data and folded long lines',()=>{
  const feed=icalendar([{id:'abc',nameAr:'ورشة المهارات المتقدمة في إدارة البرامج التنموية',nameEn:'Workshop',startsAt:new Date('2026-09-20T07:00:00Z'),endsAt:new Date('2026-09-20T10:00:00Z'),location:'الرياض',status:'Scheduled'}],'ar','برنامج');
  expect(feed).toContain('BEGIN:VCALENDAR');
  expect(feed).toContain('STATUS:CONFIRMED');
  expect(feed).toContain('DTSTART:20260920T070000Z');
  expect(feed.split('\r\n').every(line=>Buffer.byteLength(line)<=75)).toBe(true);
  // The only permitted at sign is the one the format requires inside the UID.
  expect(feed.replace(/^UID:.*$/gm,'')).not.toMatch(/[\w.]+@[\w.]+\.[a-z]{2,}/i);
  expect(feed).not.toContain('ATTENDEE');
 });
 it('marks a cancelled activity as cancelled for the calendar client',()=>{
  const feed=icalendar([{id:'abc',nameAr:'ورشة',nameEn:'Workshop',startsAt:new Date(),endsAt:new Date(),location:'الرياض',status:'Cancelled'}],'en','Program');
  expect(feed).toContain('STATUS:CANCELLED');
 });
});

describe('message templates',()=>{
 it('fills placeholders and leaves unknown ones empty rather than printing them',()=>{
  expect(render('طلبك {reference} في {program}',{reference:'2026-AB12',program:'برنامج'})).toBe('طلبك 2026-AB12 في برنامج');
  expect(render('مرحبًا {missing}',{})).toBe('مرحبًا ');
 });
});

describe('assistant claim checking',()=>{
 const facts:Fact[]=[
  {id:'F1',label:'submitted',value:42},
  {id:'F2',label:'acceptance rate',value:66.7,unit:'%'},
  {id:'F3',label:'coverage',value:null,unit:'%'},
 ];
 it('accepts a summary whose every figure comes from a fact',()=>{
  expect(unsupportedNumbers('بلغت الطلبات 42 (F1) ومعدل القبول 66.7% (F2).',facts)).toEqual([]);
 });
 it('accepts a rounded form of a fact',()=>{
  expect(unsupportedNumbers('معدل القبول 67% تقريبًا (F2).',facts)).toEqual([]);
 });
 it('catches an invented figure',()=>{
  expect(unsupportedNumbers('بلغت الطلبات 42 وارتفع الأثر بنسبة 91%.',facts)).toEqual([91]);
 });
 it('allows small counting words and a year',()=>{
  expect(unsupportedNumbers('ثلاثة برامج خلال 2026 مع 42 طلبًا.',facts)).toEqual([]);
 });
 it('reads Arabic-Indic digits as numbers',()=>{
  expect(normaliseDigits('٤٢')).toBe('42');
  expect(numbersIn('٩١ حالة')).toEqual([91]);
  expect(unsupportedNumbers('ارتفع إلى ٩١ بالمئة.',facts)).toEqual([91]);
 });
 it('states a missing fact instead of hiding it, and lists what was cited',()=>{
  expect(renderFacts(facts)).toContain('F3: coverage = not available');
  expect(citationsIn('كما في (F1) و(F3).',facts)).toEqual(['F1','F3']);
 });
});

describe('assistant cost accounting',()=>{
 it('charges input and output at their own published rates',()=>{
  expect(costOf('claude-opus-5',1_000_000,0)).toBe(187500);
  expect(costOf('claude-opus-5',0,1_000_000)).toBe(937500);
  expect(costOf('claude-opus-5',1000,1000)).toBe(1126);
 });
 it('never charges zero for a call that used tokens',()=>{
  expect(costOf('claude-opus-5',1,1)).toBeGreaterThan(0);
 });
});
