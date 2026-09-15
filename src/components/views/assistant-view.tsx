'use client';

import {useState} from 'react';
import {Sparkles,FileText,Search,Settings2,ShieldAlert,Check,X} from 'lucide-react';
import {
 Badge,Button,Card,Checkbox,EmptyState,Field,Input,PageHeader,SectionHeader,Select,StatusBadge,Table,Tabs,Td,Textarea,Th,Tr,
} from '@/components/ui';
import {useApp} from '@/components/app-provider';
import {formatDateTime,formatNumber} from '@/lib/format';
import {formatMoney as money} from '@/lib/plan-math';
import type {AppState} from '@/lib/types';
import type {AssistantState} from '@/lib/integration-state';

type Tab='draft'|'summary'|'search'|'docs'|'settings';

export function AssistantView({state,data}:{state:AppState;data:AssistantState}){
 const {locale,t}=useApp();
 const [tab,setTab]=useState<Tab>('draft');
 const isAdmin=state.actor.role==='Admin';
 const ready=data.settings.enabled&&Boolean(data.settings.approvedAt);

 return (
  <>
   <PageHeader
    title={t.assistant.title}
    subtitle={t.assistant.subtitle}
    action={<Badge tone={ready?'positive':'neutral'}>{ready?t.common.active:t.common.inactive}</Badge>}
   />

   <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] px-4 py-3">
    <ShieldAlert size={16} className="mt-px shrink-0 text-copper-600"/>
    <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">{t.assistant.noDecisions}</p>
   </div>

   <Tabs
    value={tab}
    onChange={setTab}
    items={[
     {value:'draft',label:t.assistant.tabs.draft},
     {value:'summary',label:t.assistant.tabs.summary},
     {value:'search',label:t.assistant.tabs.search},
     {value:'docs',label:t.assistant.tabs.docs,count:data.docs.length},
     ...(isAdmin?[{value:'settings' as Tab,label:t.assistant.tabs.settings}]:[]),
    ]}
   />

   <div className="mt-5 grid gap-4">
    {!ready&&tab!=='settings'?(
     <Card><EmptyState title={t.assistant.disabled} hint={t.assistant.disabledHint} icon={<Sparkles size={19}/>}/></Card>
    ):null}
    {ready&&tab==='draft'?<Draft data={data}/>:null}
    {ready&&tab==='summary'?<Summary data={data}/>:null}
    {ready&&tab==='search'?<DocSearch/>:null}
    {tab==='docs'?<Docs data={data}/>:null}
    {tab==='settings'&&isAdmin?<Settings data={data}/>:null}
    {tab!=='settings'&&data.runs.length?<Runs data={data}/>:null}
   </div>
  </>
 );
}

function ApprovalRow({id,status}:{id:string;status:string}){
 const {t,run,busy}=useApp();
 if(status!=='Draft')return <Badge tone={status==='Approved'?'positive':'neutral'}>{status==='Approved'?t.assistant.approved:t.statuses[status as keyof typeof t.statuses]??status}</Badge>;
 return (
  <span className="flex flex-wrap items-center gap-2">
   <Badge tone="caution">{t.assistant.pendingApproval}</Badge>
   <Button size="sm" icon={<Check size={13}/>} loading={busy} onClick={()=>run('ai.approve',{id,approve:true})}>{t.assistant.approve}</Button>
   <Button size="sm" variant="ghost" icon={<X size={13}/>} loading={busy} onClick={()=>run('ai.approve',{id,approve:false})}>{t.assistant.reject}</Button>
  </span>
 );
}

function Draft({data}:{data:AssistantState}){
 const {t,run,busy}=useApp();
 const [draft,setDraft]=useState({nameAr:'',nameEn:'',objective:'',audience:''});
 const [result,setResult]=useState<{id:string;output:{descriptionAr?:string;descriptionEn?:string;indicators?:{nameAr:string;nameEn:string;unit:string;direction:string;rationaleAr?:string}[]};status:string}|null>(null);

 return (
  <Card>
   <SectionHeader title={t.assistant.tabs.draft} hint={t.assistant.draftHint}/>
   <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <Field label={t.program.nameAr} required><Input value={draft.nameAr} onChange={e=>setDraft(c=>({...c,nameAr:e.target.value}))}/></Field>
    <Field label={t.program.nameEn} required><Input value={draft.nameEn} onChange={e=>setDraft(c=>({...c,nameEn:e.target.value}))}/></Field>
    <Field label={t.assistant.draftObjective} required><Textarea rows={3} value={draft.objective} onChange={e=>setDraft(c=>({...c,objective:e.target.value}))}/></Field>
    <Field label={t.assistant.draftAudience} required><Textarea rows={3} value={draft.audience} onChange={e=>setDraft(c=>({...c,audience:e.target.value}))}/></Field>
    <div className="flex justify-end sm:col-span-2">
     <Button icon={<Sparkles size={15}/>} loading={busy}
      disabled={draft.nameAr.trim().length<2||draft.nameEn.trim().length<2||draft.objective.trim().length<10||draft.audience.trim().length<3}
      onClick={async()=>{
       const r=await run('ai.draftProgram',{nameAr:draft.nameAr.trim(),nameEn:draft.nameEn.trim(),objective:draft.objective.trim(),audience:draft.audience.trim()});
       if(r)setResult(r as typeof result);
      }}>
      {t.assistant.draftRun}
     </Button>
    </div>
   </div>

   {result?(
    <div className="mt-5 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] p-4">
     <ApprovalRow id={result.id} status={result.status}/>
     <p className="mt-3 text-[13.5px] leading-relaxed">{result.output.descriptionAr}</p>
     <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]" dir="ltr">{result.output.descriptionEn}</p>
     {result.output.indicators?.length?(
      <ul className="mt-3 space-y-2">
       {result.output.indicators.map((indicator,index)=>(
        <li key={index} className="rounded-lg bg-[var(--surface-card)] p-3 text-[13px]">
         <span className="font-medium">{indicator.nameAr} · {indicator.nameEn}</span>
         <span className="block text-[11.5px] text-[var(--text-faint)]">{indicator.unit} · {indicator.direction==='Higher'?t.impact.higher:t.impact.lower}</span>
         {indicator.rationaleAr?<span className="mt-1 block text-[12px] text-[var(--text-muted)]">{indicator.rationaleAr}</span>:null}
        </li>
       ))}
      </ul>
     ):null}
    </div>
   ):null}
  </Card>
 );
}

function Summary({data}:{data:AssistantState}){
 const {locale,t,run,busy}=useApp();
 const [programId,setProgramId]=useState(data.programs[0]?.id??'');
 const [result,setResult]=useState<{id:string;text:string;citations:string[];status:string}|null>(null);

 return (
  <Card>
   <SectionHeader title={t.assistant.tabs.summary} hint={t.assistant.summaryHint}/>
   <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
    <Field label={t.common.program} required>
     <Select value={programId} onChange={e=>setProgramId(e.target.value)}>
      {data.programs.map(p=><option key={p.id} value={p.id}>{locale==='ar'?p.nameAr:p.nameEn}</option>)}
     </Select>
    </Field>
    <div className="flex items-end">
     <Button icon={<Sparkles size={15}/>} loading={busy} disabled={!programId}
      onClick={async()=>{const r=await run('ai.summarise',{programId});if(r)setResult(r as typeof result);}}>
      {t.assistant.summaryRun}
     </Button>
    </div>
   </div>
   {result?(
    <div className="mt-5 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] p-4">
     <ApprovalRow id={result.id} status={result.status}/>
     <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed">{result.text}</p>
     {result.citations.length?(
      <p className="mt-3 text-[11.5px] text-[var(--text-faint)]">{t.assistant.citations}: <span dir="ltr">{result.citations.join(', ')}</span></p>
     ):null}
    </div>
   ):null}
  </Card>
 );
}

function DocSearch(){
 const {t,run,busy}=useApp();
 const [question,setQuestion]=useState('');
 const [result,setResult]=useState<{id:string|null;text:string;citations:{id:string;title:string;tag:string}[];status:string}|null>(null);

 return (
  <Card>
   <SectionHeader title={t.assistant.tabs.search} hint={t.assistant.searchHint}/>
   <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
    <Field label={t.assistant.searchQuestion} required>
     <Input value={question} onChange={e=>setQuestion(e.target.value)}/>
    </Field>
    <div className="flex items-end">
     <Button icon={<Search size={15}/>} loading={busy} disabled={question.trim().length<5}
      onClick={async()=>{const r=await run('ai.search',{question:question.trim()});if(r)setResult(r as typeof result);}}>
      {t.assistant.searchRun}
     </Button>
    </div>
   </div>
   {result?(
    result.status==='Empty'?<p className="mt-4 text-[13px] text-[var(--text-faint)]">{t.common.empty}</p>:(
     <div className="mt-5 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] p-4">
      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{result.text}</p>
      {result.citations.length?(
       <ul className="mt-3 space-y-1 text-[11.5px] text-[var(--text-faint)]">
        {result.citations.map(citation=><li key={citation.id}><span dir="ltr">{citation.tag}</span> · {citation.title}</li>)}
       </ul>
      ):null}
     </div>
    )
   ):null}
  </Card>
 );
}

function Docs({data}:{data:AssistantState}){
 const {locale,t,run,busy}=useApp();
 const [draft,setDraft]=useState({title:'',body:'',programId:''});
 return (
  <>
   <Card>
    <SectionHeader title={t.assistant.docAdd} hint={t.assistant.searchHint}/>
    <div className="mt-4 grid gap-3">
     <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t.assistant.docTitle} required><Input value={draft.title} onChange={e=>setDraft(c=>({...c,title:e.target.value}))}/></Field>
      <Field label={t.common.program}>
       <Select value={draft.programId} onChange={e=>setDraft(c=>({...c,programId:e.target.value}))}>
        <option value="">{t.report.allPrograms}</option>
        {data.programs.map(p=><option key={p.id} value={p.id}>{locale==='ar'?p.nameAr:p.nameEn}</option>)}
       </Select>
      </Field>
     </div>
     <Field label={t.assistant.docBody} required><Textarea rows={6} value={draft.body} onChange={e=>setDraft(c=>({...c,body:e.target.value}))}/></Field>
     <div className="flex justify-end">
      <Button icon={<FileText size={15}/>} loading={busy} disabled={draft.title.trim().length<2||draft.body.trim().length<20}
       onClick={async()=>{const r=await run('doc.create',{title:draft.title.trim(),body:draft.body.trim(),...(draft.programId?{programId:draft.programId}:{})});if(r)setDraft({title:'',body:'',programId:''});}}>
       {t.common.add}
      </Button>
     </div>
    </div>
   </Card>

   <Card padded={false}>
    {data.docs.length?(
     <Table>
      <thead><tr><Th>{t.assistant.docTitle}</Th><Th>{t.common.program}</Th><Th>{t.common.date}</Th><Th/></tr></thead>
      <tbody>
       {data.docs.map(doc=>{
        const program=data.programs.find(p=>p.id===doc.programId);
        return (
         <Tr key={doc.id}>
          <Td className="text-[13.5px] font-medium">{doc.title}</Td>
          <Td className="text-[12.5px] text-[var(--text-muted)]">{program?(locale==='ar'?program.nameAr:program.nameEn):t.report.allPrograms}</Td>
          <Td className="whitespace-nowrap text-[12px]">{formatDateTime(doc.updatedAt,locale)}</Td>
          <Td><span className="flex justify-end"><Button size="sm" variant="danger" loading={busy} onClick={()=>run('doc.delete',{id:doc.id})}>{t.common.remove}</Button></span></Td>
         </Tr>
        );
       })}
      </tbody>
     </Table>
    ):<EmptyState title={t.assistant.noDocs} hint={t.common.emptyHint} icon={<FileText size={19}/>}/>}
   </Card>
  </>
 );
}

function Settings({data}:{data:AssistantState}){
 const {locale,t,run,busy}=useApp();
 const [draft,setDraft]=useState({
  enabled:data.settings.enabled,
  monthlyCap:String(data.settings.monthlyCap),
  retainDays:String(data.settings.retainDays),
  acceptTerms:Boolean(data.settings.approvedAt),
 });
 return (
  <Card>
   <SectionHeader title={t.assistant.tabs.settings} hint={t.assistant.capHint}/>
   <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <Field label={t.assistant.cap} required>
     <Input type="number" min={0} value={draft.monthlyCap} onChange={e=>setDraft(c=>({...c,monthlyCap:e.target.value}))}/>
    </Field>
    <Field label={t.assistant.retain} required>
     <Input type="number" min={1} max={365} value={draft.retainDays} onChange={e=>setDraft(c=>({...c,retainDays:e.target.value}))}/>
    </Field>
    <div className="sm:col-span-2">
     <Checkbox label={t.assistant.enable} checked={draft.enabled} onChange={e=>setDraft(c=>({...c,enabled:e.target.checked}))}/>
    </div>
    <div className="sm:col-span-2">
     <Checkbox label={t.assistant.terms} checked={draft.acceptTerms} onChange={e=>setDraft(c=>({...c,acceptTerms:e.target.checked}))}/>
    </div>
    <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
     <p className="text-[12.5px] text-[var(--text-muted)]">
      {t.assistant.spent}: <span className="font-semibold tabular-nums">{money(data.settings.spentThisMonth,'SAR',locale)}</span>
      <span className="mx-1">/</span>
      <span className="tabular-nums">{money(data.settings.monthlyCap,'SAR',locale)}</span>
     </p>
     <Button loading={busy} disabled={draft.enabled&&!draft.acceptTerms}
      onClick={()=>run('ai.settings',{enabled:draft.enabled,monthlyCap:Number(draft.monthlyCap),retainDays:Number(draft.retainDays),acceptTerms:draft.acceptTerms})}>
      {t.common.save}
     </Button>
    </div>
   </div>
  </Card>
 );
}

function Runs({data}:{data:AssistantState}){
 const {locale,t}=useApp();
 return (
  <Card padded={false}>
   <div className="px-5 pt-5"><SectionHeader title={t.assistant.runs}/></div>
   <Table className="mt-3">
    <thead><tr><Th>{t.common.date}</Th><Th>{t.common.details}</Th><Th>{t.common.status}</Th><Th>{t.assistant.tokens}</Th><Th>{t.assistant.cost}</Th></tr></thead>
    <tbody>
     {data.runs.slice(0,20).map(run=>(
      <Tr key={run.id}>
       <Td className="whitespace-nowrap text-[12px]">{formatDateTime(run.createdAt,locale)}</Td>
       <Td className="font-mono text-[12px]"><span dir="ltr">{run.feature}</span>
        {run.error?<span className="block text-[11px] text-critical">{t.assistant.unverified}</span>:null}
       </Td>
       <Td><StatusBadge status={run.status} label={t.statuses[run.status as keyof typeof t.statuses]??run.status}/></Td>
       <Td className="tabular-nums text-[12px]">{formatNumber(run.inputTokens+run.outputTokens,locale)}</Td>
       <Td className="tabular-nums text-[12px]">{money(run.cost,'SAR',locale)}</Td>
      </Tr>
     ))}
    </tbody>
   </Table>
  </Card>
 );
}
