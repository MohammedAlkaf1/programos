/**
 * CSV reading for imports (FR-030).
 *
 * Written by hand rather than pulled from a dependency because the rules that
 * matter here are ours: a byte order mark that Excel adds, semicolon separated
 * files that Arabic Windows produces, quoted fields containing newlines, and
 * above all neutralising formula injection so a cell that starts with `=` is
 * treated as text by us and by whatever opens the file next.
 */
export type Sheet={headers:string[];rows:string[][]};

const RISKY=/^[\s]*[=+\-@\t\r]/;

/** Text that could be read as a formula is prefixed, exactly as on export. */
export function neutralise(value:string){return RISKY.test(value)?`'${value}`:value;}

function detectDelimiter(line:string){
 const counts=[',',';','\t'].map(d=>[d,line.split(d).length] as const);
 return counts.sort((a,b)=>b[1]-a[1])[0][1]>1?counts.sort((a,b)=>b[1]-a[1])[0][0]:',';
}

export function parseCsv(text:string,limit=5000):Sheet{
 let input=text.replace(/^﻿/,'').replace(/\r\n/g,'\n');
 const delimiter=detectDelimiter(input.split('\n')[0]??'');
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(quoted){
   if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else quoted=false;}
   else field+=c;
   continue;
  }
  if(c==='"'){quoted=true;continue;}
  if(c===delimiter){row.push(field.trim());field='';continue;}
  if(c==='\n'){row.push(field.trim());field='';if(row.some(v=>v!==''))rows.push(row);row=[];if(rows.length>limit+1)break;continue;}
  field+=c;
 }
 row.push(field.trim());
 if(row.some(v=>v!==''))rows.push(row);
 const headers=(rows.shift()??[]).map(h=>h.replace(/^'/,''));
 const width=headers.length;
 return {headers,rows:rows.slice(0,limit).map(r=>Array.from({length:width},(_,i)=>r[i]??''))};
}

/** Suggests a mapping by matching header text in either language. */
export function suggestMapping(headers:string[],fields:{id:string;labelAr:string;labelEn:string}[]){
 const normal=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
 const mapping:Record<string,string>={};
 for(const field of fields){
  const targets=[field.id,field.labelAr,field.labelEn].map(normal);
  const index=headers.findIndex(h=>targets.includes(normal(h)));
  if(index>=0)mapping[field.id]=headers[index];
 }
 return mapping;
}
