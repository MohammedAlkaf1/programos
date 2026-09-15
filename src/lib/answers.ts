import {DomainError} from './domain';
import type {FormField} from './types';
type Answer=string|number|string[];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Server side validation of form answers against the form definition the
 * applicant saw. Returns the attachment ids referenced so the caller can
 * confirm they belong to this person and passed the file scan. With `strict`
 * every required field must be present and every value must match its type;
 * a draft only has to reference known fields.
 */
export function validateAnswers(form:FormField[],answers:Record<string,Answer|undefined>,strict:boolean){
 if(Object.keys(answers).some(k=>!form.some(f=>f.id===k)))throw new DomainError('invalid');
 const files:string[]=[];
 for(const f of form){const v=answers[f.id];if(f.type==='attachment'&&v!==undefined){if(!Array.isArray(v)||v.some(x=>!UUID.test(x)))throw new DomainError('invalid');files.push(...v);}}
 if(files.length>5||new Set(files).size!==files.length)throw new DomainError('invalid');
 if(!strict)return files;
 for(const f of form){
  const v=answers[f.id];
  if(f.required&&(v===undefined||v===''||(Array.isArray(v)&&!v.length)))throw new DomainError('required');
  if(v===undefined||v==='')continue;
  if(f.type==='multiselect'){if(!Array.isArray(v)||v.some(o=>!f.options?.includes(o))||new Set(v).size!==v.length)throw new DomainError('invalid');continue;}
  if(f.type!=='attachment'&&Array.isArray(v))throw new DomainError('invalid');
  if(f.type==='number'&&!Number.isFinite(Number(v)))throw new DomainError('invalid');
  if(f.type==='select'&&!f.options?.includes(String(v)))throw new DomainError('invalid');
  if(f.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(String(v))||!Number.isFinite(Date.parse(String(v)))))throw new DomainError('invalid');
 }
 return files;
}
