'use client';

import {useState,type FormEvent} from 'react';
import {Send,CheckCircle2,AlertTriangle} from 'lucide-react';
import {Field,Input,Select,Textarea,Checkbox,Button} from '@/components/ui';
import {getSiteCopy} from '@/i18n/site';
import {getDictionary,type Locale} from '@/i18n/dictionary';

/**
 * The only form on the public site.
 *
 * It posts to the same unauthenticated command endpoint the sign up flow uses,
 * which already carries the rate limiting and the uniform answers, so this
 * component holds nothing but the fields and their state.
 */
export function ContactForm({locale}:{locale:Locale}){
 const t=getSiteCopy(locale);
 const errors=getDictionary(locale).errors;
 const [form,setForm]=useState({name:'',email:'',organization:'',phone:'',topic:'demo',message:'',consent:false});
 const [state,setState]=useState<'idle'|'sending'|'sent'|'failed'>('idle');
 const [reason,setReason]=useState<string|null>(null);

 const set=(key:keyof typeof form)=>(value:string|boolean)=>setForm(current=>({...current,[key]:value}));
 const phoneOk=!form.phone.trim()||/^\+[1-9]\d{6,14}$/.test(form.phone.trim());
 const ready=form.name.trim().length>=2&&form.email.includes('@')&&form.organization.trim().length>=2
  &&form.message.trim().length>=10&&form.consent&&phoneOk;

 async function submit(event:FormEvent){
  event.preventDefault();
  if(!ready)return;
  setState('sending');setReason(null);
  try{
   const response=await fetch('/api/public',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'contact.submit',data:{
     name:form.name.trim(),email:form.email.trim(),organization:form.organization.trim(),
     phone:form.phone.trim(),topic:form.topic,message:form.message.trim(),locale,consent:true,
    }}),
   });
   const payload=await response.json().catch(()=>({}));
   if(!response.ok||!payload.ok){
    setState('failed');
    setReason(errors[payload.error as keyof typeof errors]??null);
    return;
   }
   setState('sent');
   setForm({name:'',email:'',organization:'',phone:'',topic:'demo',message:'',consent:false});
  }catch{
   setState('failed');setReason(errors.network);
  }
 }

 if(state==='sent'){
  return (
   <div role="status" className="surface flex items-start gap-3 p-6">
    <CheckCircle2 size={20} className="mt-px shrink-0 text-positive" aria-hidden/>
    <div>
     <p className="text-[15px] font-semibold">{t.contact.success}</p>
     <button type="button" onClick={()=>setState('idle')}
      className="mt-2 text-[13.5px] font-medium text-copper-700 hover:underline">
      {locale==='ar'?'أرسل رسالة أخرى':'Send another message'}
     </button>
    </div>
   </div>
  );
 }

 return (
  <form onSubmit={submit} className="surface grid gap-4 p-6 sm:p-7" noValidate>
   {state==='failed'?(
    <p role="alert" className="flex items-start gap-2.5 rounded-[10px] bg-critical-soft px-3.5 py-3 text-[13px] text-critical">
     <AlertTriangle size={16} className="mt-px shrink-0" aria-hidden/>
     {reason??t.contact.failure}
    </p>
   ):null}

   <div className="grid gap-4 sm:grid-cols-2">
    <Field label={t.contact.name} required>
     <Input name="name" value={form.name} autoComplete="name" onChange={e=>set('name')(e.target.value)}/>
    </Field>
    <Field label={t.contact.organization} required>
     <Input name="organization" value={form.organization} autoComplete="organization" onChange={e=>set('organization')(e.target.value)}/>
    </Field>
    <Field label={t.contact.email} required>
     <Input name="email" dir="ltr" type="email" autoComplete="email" value={form.email} onChange={e=>set('email')(e.target.value)}/>
    </Field>
    <Field label={t.contact.phone} hint={t.contact.phoneHint}>
     <Input name="phone" dir="ltr" type="tel" autoComplete="tel" value={form.phone} onChange={e=>set('phone')(e.target.value)} placeholder="+9665xxxxxxxx"/>
    </Field>
   </div>

   <Field label={t.contact.topic} required>
    <Select name="topic" value={form.topic} onChange={e=>set('topic')(e.target.value)}>
     {(Object.keys(t.contact.topics) as Array<keyof typeof t.contact.topics>).map(key=>(
      <option key={key} value={key}>{t.contact.topics[key]}</option>
     ))}
    </Select>
   </Field>

   <Field label={t.contact.message} required>
    <Textarea name="message" rows={6} value={form.message} onChange={e=>set('message')(e.target.value)}/>
   </Field>

   <Checkbox name="consent" label={t.contact.consent} checked={form.consent} onChange={e=>set('consent')(e.target.checked)}/>

   <div className="flex justify-end">
    <Button type="submit" icon={<Send size={15}/>} loading={state==='sending'} disabled={!ready}>
     {t.contact.submit}
    </Button>
   </div>
  </form>
 );
}
