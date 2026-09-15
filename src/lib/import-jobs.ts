import {z} from 'zod';
import {createHash} from 'node:crypto';
import {db} from './db';
import {DomainError} from './domain';
import {parseCsv,neutralise,suggestMapping} from './csv';
import {validateAnswers} from './answers';
import type {Actor} from './access';
import type {FormField} from './types';

/**
 * CSV import (FR-030).
 *
 * Two phases on purpose. `preview` parses, maps and validates every row without
 * writing anything, so the person sees exactly what would happen, including the
 * reason each rejected row fails. `apply` then repeats the same validation
 * against live data inside one transaction. Nothing is created for a row that
 * fails, and the rest of the file still lands: a single bad row never costs the
 * other nine hundred.
 *
 * Two things it deliberately does not do unless explicitly asked: create user
 * accounts, and send invitations. Importing a list is not consent to email
 * everyone on it.
 */

export const importKinds=['beneficiaries','applications'] as const;
export type ImportKind=typeof importKinds[number];

const email=z.string().trim().toLowerCase().email().max(254);
const phone=z.string().trim().regex(/^\+[1-9]\d{6,14}$/);

export type RowReport={row:number;status:'create'|'skip'|'error';reason?:string;field?:string;name?:string;email?:string};

export const targetFields=(kind:ImportKind,form:FormField[]):{id:string;labelAr:string;labelEn:string;required:boolean}[]=>
 kind==='beneficiaries'
  ?[{id:'name',labelAr:'الاسم',labelEn:'Name',required:true},{id:'email',labelAr:'البريد الإلكتروني',labelEn:'Email',required:true},{id:'phone',labelAr:'رقم الجوال',labelEn:'Mobile',required:false}]
  :[{id:'name',labelAr:'الاسم',labelEn:'Name',required:true},{id:'email',labelAr:'البريد الإلكتروني',labelEn:'Email',required:true},{id:'phone',labelAr:'رقم الجوال',labelEn:'Mobile',required:false},
    ...form.map(f=>({id:`answer.${f.id}`,labelAr:f.labelAr,labelEn:f.labelEn,required:f.required}))];

export async function programForm(tenantId:string,programId?:string|null){
 if(!programId)return [] as FormField[];
 const program=await db.program.findFirst({where:{id:programId,tenantId}});
 if(!program)throw new DomainError('notFound',404);
 return program.form as unknown as FormField[];
}

type Prepared={report:RowReport[];rows:{index:number;name:string;email:string;phone:string|null;answers:Record<string,string>}[]};

/**
 * Validates every row against the mapping and the existing data. `known` is the
 * set of emails already in the tenant, passed in so the caller controls whether
 * it was read inside a transaction.
 */
export function prepare(kind:ImportKind,sheet:{headers:string[];rows:string[][]},mapping:Record<string,string>,form:FormField[],known:Set<string>):Prepared{
 const fields=targetFields(kind,form);
 const column=(id:string)=>{const header=mapping[id];return header?sheet.headers.indexOf(header):-1;};
 const report:RowReport[]=[];const rows:Prepared['rows']=[];
 const seen=new Set<string>();
 sheet.rows.forEach((raw,index)=>{
  const line=index+2; // header is line 1, as the person sees it in Excel
  const value=(id:string)=>{const c=column(id);return c>=0?neutralise(raw[c]??'').replace(/^'/,'').trim():'';};
  const name=value('name');
  const address=value('email').toLowerCase();
  const mobile=value('phone');
  if(!name||name.length<2){report.push({row:line,status:'error',field:'name',reason:'nameMissing'});return;}
  if(!email.safeParse(address).success){report.push({row:line,status:'error',field:'email',reason:'emailInvalid',name});return;}
  if(mobile&&!phone.safeParse(mobile).success){report.push({row:line,status:'error',field:'phone',reason:'phoneInvalid',name,email:address});return;}
  if(seen.has(address)){report.push({row:line,status:'skip',reason:'duplicateInFile',name,email:address});return;}
  if(known.has(address)){report.push({row:line,status:'skip',reason:'alreadyInWorkspace',name,email:address});return;}
  const answers:Record<string,string>={};
  for(const field of fields)if(field.id.startsWith('answer.')){const v=value(field.id);if(v)answers[field.id.slice(7)]=v;}
  if(kind==='applications'){
   try{validateAnswers(form.filter(f=>f.type!=='attachment'),answers,true);}
   catch(e){report.push({row:line,status:'error',field:'answers',reason:e instanceof DomainError?e.code:'invalid',name,email:address});return;}
   if(form.some(f=>f.type==='attachment'&&f.required)){report.push({row:line,status:'error',field:'answers',reason:'attachmentRequired',name,email:address});return;}
  }
  seen.add(address);
  rows.push({index:line,name,email:address,phone:mobile||null,answers});
  report.push({row:line,status:'create',name,email:address});
 });
 return {report,rows};
}

export async function createJob(a:Actor,kind:ImportKind,filename:string,source:string,programId:string|null,mapping:Record<string,string>|null){
 if(source.length>2_000_000)throw new DomainError('invalid',413);
 const sheet=parseCsv(source);
 if(!sheet.headers.length||!sheet.rows.length)throw new DomainError('invalid');
 const form=await programForm(a.tenantId,programId);
 const fields=targetFields(kind,form);
 const suggested=mapping??suggestMapping(sheet.headers,fields);
 const job=await db.importJob.create({data:{tenantId:a.tenantId,userId:a.userId,kind,filename:filename.slice(0,120),programId,source,mapping:suggested,totalRows:sheet.rows.length}});
 return {job,sheet,fields,mapping:suggested};
}

export function checksum(row:{email:string;name:string}){return createHash('sha256').update(`${row.email}|${row.name}`).digest('hex').slice(0,32);}
