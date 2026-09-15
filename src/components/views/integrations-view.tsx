'use client';

import {useMemo,useState} from 'react';
import {KeyRound,Webhook,Plug,ShieldCheck,MessageSquare,Upload,Copy,Check,RotateCw,Trash2,Send} from 'lucide-react';
import {
 Badge,Button,Card,Checkbox,EmptyState,Field,Input,Modal,PageHeader,SectionHeader,Select,StatusBadge,Table,Tabs,Td,Textarea,Th,Tr,
} from '@/components/ui';
import {useApp} from '@/components/app-provider';
import {formatDateTime,formatNumber} from '@/lib/format';
import type {AppState} from '@/lib/types';
import type {IntegrationState} from '@/lib/integration-state';

const SCOPES=['programs:read','applications:read','applications:write','beneficiaries:read','attendance:write','impact:read','impact:write','reports:read','events:read'] as const;
const EVENT_GROUPS=['program.*','application.*','enrollment.*','activity.*','attendance.*','measurement.*','indicator.*','privacy.*','invoice.*'] as const;
const KINDS=['calendar','lms','crm','bi'] as const;
const FIELDS:Record<(typeof KINDS)[number],string[]>={
 calendar:['title','startsAt','endsAt','location','programName','attendeeCount'],
 lms:['courseId','learnerEmail','learnerName','enrollmentStatus','completedAt','attendanceRate'],
 crm:['contactEmail','contactName','contactPhone','programName','stage','decidedAt'],
 bi:['programId','programName','submitted','accepted','enrolled','completed','completionRate','acceptanceRate','change','coverage'],
};

type Tab='keys'|'webhooks'|'connectors'|'sso'|'messaging'|'imports';

export function IntegrationsView({state,data}:{state:AppState;data:IntegrationState}){
 const {locale,t}=useApp();
 const [tab,setTab]=useState<Tab>('keys');
 return (
  <>
   <PageHeader title={t.integration.title} subtitle={t.integration.subtitle}/>
   <Tabs
    value={tab}
    onChange={setTab}
    items={[
     {value:'keys',label:t.integration.tabs.keys,count:data.keys.filter(k=>!k.revokedAt).length},
     {value:'webhooks',label:t.integration.tabs.webhooks,count:data.endpoints.length},
     {value:'connectors',label:t.integration.tabs.connectors,count:data.connectors.length},
     {value:'sso',label:t.integration.tabs.sso},
     {value:'messaging',label:t.integration.tabs.messaging,count:data.templates.length},
     {value:'imports',label:t.integration.tabs.imports,count:data.imports.length},
    ]}
   />
   <div className="mt-5 grid gap-4">
    {tab==='keys'?<Keys data={data}/>:null}
    {tab==='webhooks'?<Webhooks data={data}/>:null}
    {tab==='connectors'?<Connectors data={data}/>:null}
    {tab==='sso'?<Sso data={data}/>:null}
    {tab==='messaging'?<Messaging data={data}/>:null}
    {tab==='imports'?<Imports state={state} data={data}/>:null}
   </div>
  </>
 );
}

function CopyField({label,value}:{label:string;value:string}){
 const {t}=useApp();
 const [copied,setCopied]=useState(false);
 return (
  <Field label={label}>
   <div className="flex gap-2">
    <Input dir="ltr" readOnly value={value} className="font-mono text-[12px]"/>
    <Button
     variant="ghost"
     icon={copied?<Check size={14}/>:<Copy size={14}/>}
     onClick={()=>{navigator.clipboard?.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
    >
     {copied?t.common.copied:t.common.copy}
    </Button>
   </div>
  </Field>
 );
}

/* ── API keys ── */
function Keys({data}:{data:IntegrationState}){
 const {locale,t,run,busy}=useApp();
 const [creating,setCreating]=useState(false);
 const [draft,setDraft]=useState({name:'',scopes:['programs:read'] as string[],days:'365'});
 const [issued,setIssued]=useState<{token:string;prefix:string}|null>(null);
 const [reason,setReason]=useState('');

 return (
  <>
   <Card>
    <SectionHeader
     title={t.integration.tabs.keys}
     hint={t.integration.docsHint}
     action={<Button icon={<KeyRound size={15}/>} onClick={()=>setCreating(true)}>{t.integration.keyCreate}</Button>}
    />
    <p className="mt-3 text-[12.5px] text-[var(--text-muted)]">
     <a className="font-medium text-copper-700 hover:underline" href="/api/v1/openapi.json" dir="ltr">/api/v1/openapi.json</a>
    </p>
    {data.keys.length?(
     <Table className="mt-4">
      <thead><tr><Th>{t.integration.keyName}</Th><Th>{t.integration.keyPrefix}</Th><Th>{t.common.scopes}</Th><Th>{t.integration.keyLastUsed}</Th><Th/></tr></thead>
      <tbody>
       {data.keys.map(key=>(
        <Tr key={key.id}>
         <Td className="text-[13.5px] font-medium">
          {key.name}
          {key.revokedAt?<Badge tone="neutral">{t.integration.keyRevoked}</Badge>:null}
         </Td>
         <Td className="font-mono text-[12px]"><span dir="ltr">{key.prefix}</span></Td>
         <Td className="max-w-[16rem] text-[11.5px] text-[var(--text-muted)]"><span dir="ltr">{key.scopes.join(' ')}</span></Td>
         <Td className="whitespace-nowrap text-[12px]">{key.lastUsedAt?formatDateTime(key.lastUsedAt,locale):'…'}</Td>
         <Td>
          {key.revokedAt?null:(
           <span className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" icon={<RotateCw size={13}/>} loading={busy} disabled={reason.trim().length<3}
             onClick={async()=>{const r=await run('apikey.rotate',{id:key.id,reason:reason.trim()}) as {token?:string;prefix?:string}|null;if(r?.token)setIssued({token:r.token,prefix:r.prefix!});}}>
             {t.integration.keyRotate}
            </Button>
            <Button size="sm" variant="danger" loading={busy} disabled={reason.trim().length<3}
             onClick={()=>run('apikey.revoke',{id:key.id,reason:reason.trim()})}>
             {t.integration.keyRevoke}
            </Button>
           </span>
          )}
         </Td>
        </Tr>
       ))}
      </tbody>
     </Table>
    ):<EmptyState title={t.common.empty} hint={t.common.emptyHint} icon={<KeyRound size={19}/>}/>}
    <div className="mt-3 max-w-sm">
     <Field label={t.common.reason} hint={t.integration.keyRotate}>
      <Input value={reason} onChange={e=>setReason(e.target.value)}/>
     </Field>
    </div>
   </Card>

   {creating?(
    <Modal open onClose={()=>setCreating(false)} title={t.integration.keyCreate}
     footer={<>
      <Button variant="ghost" onClick={()=>setCreating(false)}>{t.common.cancel}</Button>
      <Button loading={busy} disabled={draft.name.trim().length<2||!draft.scopes.length}
       onClick={async()=>{
        const r=await run('apikey.create',{name:draft.name.trim(),scopes:draft.scopes,...(draft.days?{days:Number(draft.days)}:{})}) as {token?:string;prefix?:string}|null;
        if(r?.token){setIssued({token:r.token,prefix:r.prefix!});setCreating(false);setDraft({name:'',scopes:['programs:read'],days:'365'});}
       }}>
       {t.common.create}
      </Button>
     </>}>
     <div className="grid gap-4">
      <Field label={t.integration.keyName} required><Input value={draft.name} onChange={e=>setDraft(c=>({...c,name:e.target.value}))}/></Field>
      <Field label={t.integration.keyExpiry}><Input type="number" min={1} max={730} value={draft.days} onChange={e=>setDraft(c=>({...c,days:e.target.value}))}/></Field>
      <Field label={t.common.scopes} required>
       <div className="grid gap-1.5 sm:grid-cols-2">
        {SCOPES.map(scope=>(
         <Checkbox key={scope} label={scope} checked={draft.scopes.includes(scope)}
          onChange={e=>setDraft(c=>({...c,scopes:e.target.checked?[...c.scopes,scope]:c.scopes.filter(s=>s!==scope)}))}/>
        ))}
       </div>
      </Field>
     </div>
    </Modal>
   ):null}

   {issued?(
    <Modal open onClose={()=>setIssued(null)} title={t.integration.keyCreate} description={t.integration.keyOnce}
     footer={<Button onClick={()=>setIssued(null)}>{t.common.close}</Button>}>
     <CopyField label={t.common.secret} value={issued.token}/>
    </Modal>
   ):null}
  </>
 );
}

/* ── Webhooks ── */
function Webhooks({data}:{data:IntegrationState}){
 const {locale,t,run,busy}=useApp();
 const [url,setUrl]=useState('');
 const [events,setEvents]=useState<string[]>([]);
 const [secret,setSecret]=useState<string|null>(null);
 const dead=data.deliveries.filter(d=>d.status==='Dead');

 return (
  <>
   <Card>
    <SectionHeader title={t.integration.webhookCreate} hint={t.integration.webhookHint}/>
    <div className="mt-4 grid gap-3">
     <Field label={t.common.url} required hint="https://">
      <Input dir="ltr" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.org/hooks/programos"/>
     </Field>
     <Field label={t.integration.webhookEvents} hint={t.integration.webhookAll}>
      <div className="grid gap-1.5 sm:grid-cols-3">
       {EVENT_GROUPS.map(group=>(
        <Checkbox key={group} label={group} checked={events.includes(group)}
         onChange={e=>setEvents(c=>e.target.checked?[...c,group]:c.filter(x=>x!==group))}/>
       ))}
      </div>
     </Field>
     <div className="flex justify-end">
      <Button icon={<Webhook size={15}/>} loading={busy} disabled={!url.startsWith('https://')&&!url.startsWith('http://')}
       onClick={async()=>{const r=await run('webhook.create',{url:url.trim(),events}) as {secret?:string}|null;if(r?.secret){setSecret(r.secret);setUrl('');setEvents([]);}}}>
       {t.common.add}
      </Button>
     </div>
    </div>
   </Card>

   {data.endpoints.length?(
    <Card padded={false}>
     <div className="px-5 pt-5"><SectionHeader title={t.common.events}/></div>
     <Table className="mt-3">
      <thead><tr><Th>{t.common.url}</Th><Th>{t.common.status}</Th><Th>{t.integration.lastSuccess}</Th><Th>{t.integration.lastFailure}</Th><Th/></tr></thead>
      <tbody>
       {data.endpoints.map(endpoint=>(
        <Tr key={endpoint.id}>
         <Td className="max-w-[18rem] truncate text-[12.5px]"><span dir="ltr">{endpoint.url}</span>
          <span className="block text-[11px] text-[var(--text-faint)]" dir="ltr">{endpoint.events.join(' ')||'*'}</span>
         </Td>
         <Td><Badge tone={endpoint.active?'positive':'neutral'}>{endpoint.active?t.common.active:t.common.inactive}</Badge></Td>
         <Td className="whitespace-nowrap text-[12px]">{endpoint.lastSuccessAt?formatDateTime(endpoint.lastSuccessAt,locale):'…'}</Td>
         <Td className="whitespace-nowrap text-[12px]">{endpoint.lastFailureAt?formatDateTime(endpoint.lastFailureAt,locale):'…'}</Td>
         <Td>
          <span className="flex justify-end gap-1.5">
           <Button size="sm" variant="ghost" icon={<Send size={13}/>} loading={busy} onClick={()=>run('webhook.test',{id:endpoint.id})}>{t.common.test}</Button>
           <Button size="sm" variant="ghost" loading={busy} onClick={()=>run('webhook.update',{id:endpoint.id,active:!endpoint.active,events:endpoint.events})}>
            {endpoint.active?t.common.disable:t.common.enable}
           </Button>
           <Button size="sm" variant="danger" icon={<Trash2 size={13}/>} loading={busy} onClick={()=>run('webhook.delete',{id:endpoint.id,reason:'removed by admin'})}>{t.common.remove}</Button>
          </span>
         </Td>
        </Tr>
       ))}
      </tbody>
     </Table>
    </Card>
   ):null}

   {dead.length?(
    <Card padded={false}>
     <div className="px-5 pt-5"><SectionHeader title={t.integration.deadLetter} hint={t.integration.deadLetterHint}/></div>
     <Table className="mt-3">
      <thead><tr><Th>{t.common.events}</Th><Th>{t.integration.attempts}</Th><Th>{t.common.reason}</Th><Th/></tr></thead>
      <tbody>
       {dead.map(delivery=>(
        <Tr key={delivery.id}>
         <Td className="font-mono text-[12px]"><span dir="ltr">{delivery.event}</span></Td>
         <Td className="tabular-nums">{delivery.attempts}</Td>
         <Td className="max-w-[16rem] truncate text-[12px] text-[var(--text-muted)]">{delivery.error??'…'}</Td>
         <Td><span className="flex justify-end"><Button size="sm" variant="ghost" loading={busy} onClick={()=>run('webhook.replay',{id:delivery.id})}>{t.integration.replay}</Button></span></Td>
        </Tr>
       ))}
      </tbody>
     </Table>
    </Card>
   ):null}

   {data.deliveries.length?(
    <Card padded={false}>
     <div className="px-5 pt-5"><SectionHeader title={t.integration.deliveries}/></div>
     <ul className="mt-3 max-h-80 divide-y divide-[var(--line-soft)] overflow-y-auto">
      {data.deliveries.slice(0,40).map(delivery=>(
       <li key={delivery.id} className="flex items-center gap-3 px-5 py-2">
        <span className="min-w-0 flex-1 font-mono text-[12px] text-copper-700" dir="ltr">{delivery.event}</span>
        <StatusBadge status={delivery.status} label={t.statuses[delivery.status as keyof typeof t.statuses]??delivery.status}/>
        <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--text-faint)]">{formatDateTime(delivery.createdAt,locale)}</span>
       </li>
      ))}
     </ul>
    </Card>
   ):null}

   {secret?(
    <Modal open onClose={()=>setSecret(null)} title={t.common.secret} description={t.integration.webhookSecretOnce}
     footer={<Button onClick={()=>setSecret(null)}>{t.common.close}</Button>}>
     <CopyField label={t.common.secret} value={secret}/>
    </Modal>
   ):null}
  </>
 );
}

/* ── Connectors ── */
function Connectors({data}:{data:IntegrationState}){
 const {locale,t,run,busy}=useApp();
 const [draft,setDraft]=useState({kind:'calendar' as (typeof KINDS)[number],name:'',url:'',scopes:[] as string[]});
 const [secret,setSecret]=useState<string|null>(null);

 return (
  <>
   <Card>
    <SectionHeader title={t.integration.connectorCreate} hint={t.integration.connectorHint}/>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
     <Field label={t.integration.tabs.connectors} required>
      <Select value={draft.kind} onChange={e=>setDraft(c=>({...c,kind:e.target.value as (typeof KINDS)[number]}))}>
       {KINDS.map(kind=><option key={kind} value={kind}>{t.integration.connectorKinds[kind]}</option>)}
      </Select>
     </Field>
     <Field label={t.common.name} required><Input value={draft.name} onChange={e=>setDraft(c=>({...c,name:e.target.value}))}/></Field>
     <Field label={t.common.url} required><Input dir="ltr" value={draft.url} onChange={e=>setDraft(c=>({...c,url:e.target.value}))} placeholder="https://"/></Field>
     <Field label={t.integration.webhookEvents} hint={t.integration.webhookAll}>
      <div className="grid gap-1.5">
       {EVENT_GROUPS.slice(0,5).map(group=>(
        <Checkbox key={group} label={group} checked={draft.scopes.includes(group)}
         onChange={e=>setDraft(c=>({...c,scopes:e.target.checked?[...c.scopes,group]:c.scopes.filter(s=>s!==group)}))}/>
       ))}
      </div>
     </Field>
     <div className="flex justify-end sm:col-span-2">
      <Button icon={<Plug size={15}/>} loading={busy} disabled={draft.name.trim().length<2||!draft.url.startsWith('http')}
       onClick={async()=>{const r=await run('connector.create',{kind:draft.kind,name:draft.name.trim(),url:draft.url.trim(),scopes:draft.scopes,fieldMap:{}}) as {secret?:string}|null;
        if(r?.secret){setSecret(r.secret);setDraft({kind:'calendar',name:'',url:'',scopes:[]});}}}>
       {t.common.add}
      </Button>
     </div>
    </div>
   </Card>

   {data.connectors.map(connector=>(
    <Card key={connector.id}>
     <SectionHeader
      title={`${connector.name} · ${t.integration.connectorKinds[connector.kind as (typeof KINDS)[number]]??connector.kind}`}
      hint={connector.lastError??undefined}
      action={
       <span className="flex items-center gap-2">
        <Badge tone={connector.status==='Active'?'positive':'neutral'}>{t.statuses[connector.status as keyof typeof t.statuses]??connector.status}</Badge>
        <Button size="sm" variant="ghost" loading={busy}
         onClick={()=>run('connector.update',{id:connector.id,status:connector.status==='Active'?'Paused':'Active',scopes:connector.scopes,fieldMap:connector.fieldMap as Record<string,string>})}>
         {connector.status==='Active'?t.common.disable:t.common.enable}
        </Button>
       </span>
      }
     />
     <p className="mt-2 text-[11.5px] text-[var(--text-faint)]" dir="ltr">{FIELDS[connector.kind as (typeof KINDS)[number]]?.join(' · ')}</p>
     {connector.calendar?.length?(
      <div className="mt-4 grid gap-2">
       <p className="text-[12.5px] font-medium">{t.integration.calendarFeed}</p>
       <p className="text-[11.5px] text-[var(--text-faint)]">{t.integration.calendarFeedHint}</p>
       {connector.calendar.slice(0,5).map(feed=>(
        <CopyField key={feed.programId} label={locale==='ar'?feed.nameAr:feed.nameEn} value={feed.url}/>
       ))}
      </div>
     ):null}
    </Card>
   ))}

   {data.runs.filter(r=>r.status==='Dead').length?(
    <Card padded={false}>
     <div className="px-5 pt-5"><SectionHeader title={t.integration.deadLetter} hint={t.integration.deadLetterHint}/></div>
     <Table className="mt-3">
      <thead><tr><Th>{t.common.events}</Th><Th>{t.integration.attempts}</Th><Th>{t.common.reason}</Th><Th/></tr></thead>
      <tbody>
       {data.runs.filter(r=>r.status==='Dead').map(row=>(
        <Tr key={row.id}>
         <Td className="font-mono text-[12px]"><span dir="ltr">{row.event}</span></Td>
         <Td className="tabular-nums">{row.attempts}</Td>
         <Td className="max-w-[16rem] truncate text-[12px] text-[var(--text-muted)]">{row.error??'…'}</Td>
         <Td><span className="flex justify-end"><Button size="sm" variant="ghost" loading={busy} onClick={()=>run('connector.retry',{id:row.id})}>{t.integration.replay}</Button></span></Td>
        </Tr>
       ))}
      </tbody>
     </Table>
    </Card>
   ):null}

   {data.conflicts.length?(
    <Card padded={false}>
     <div className="px-5 pt-5"><SectionHeader title={t.integration.conflicts} hint={t.integration.conflictsHint}/></div>
     <Table className="mt-3">
      <thead><tr><Th>{t.common.details}</Th><Th>{t.common.date}</Th><Th/></tr></thead>
      <tbody>
       {data.conflicts.map(conflict=>(
        <Tr key={conflict.id}>
         <Td className="text-[12.5px]"><span dir="ltr">{conflict.entity} · {conflict.source} · {conflict.externalId}</span></Td>
         <Td className="whitespace-nowrap text-[12px]">{formatDateTime(conflict.syncedAt,locale)}</Td>
         <Td><span className="flex justify-end"><Button size="sm" variant="ghost" loading={busy} onClick={()=>run('connector.resolveConflict',{id:conflict.id,reason:'reviewed by admin'})}>{t.integration.resolve}</Button></span></Td>
        </Tr>
       ))}
      </tbody>
     </Table>
    </Card>
   ):null}

   {secret?(
    <Modal open onClose={()=>setSecret(null)} title={t.common.secret} description={t.integration.webhookSecretOnce}
     footer={<Button onClick={()=>setSecret(null)}>{t.common.close}</Button>}>
     <CopyField label={t.common.secret} value={secret}/>
    </Modal>
   ):null}
  </>
 );
}

/* ── Single sign on ── */
function Sso({data}:{data:IntegrationState}){
 const {locale,t,run,busy}=useApp();
 const [draft,setDraft]=useState({
  issuer:data.sso?.issuer??'',clientId:data.sso?.clientId??'',clientSecret:'',
  domains:(data.sso?.domains??[]).join(', '),defaultRole:data.sso?.defaultRole??'Viewer',autoProvision:data.sso?.autoProvision??false,
 });
 return (
  <>
   <Card>
    <SectionHeader
     title={t.integration.tabs.sso}
     hint={t.integration.ssoHint}
     action={data.sso?<Badge tone={data.sso.active?'positive':'neutral'}>{data.sso.active?t.common.active:t.common.inactive}</Badge>:null}
    />
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
     <Field label={t.integration.ssoIssuer} required><Input dir="ltr" value={draft.issuer} onChange={e=>setDraft(c=>({...c,issuer:e.target.value}))} placeholder="https://login.example.org"/></Field>
     <Field label={t.integration.ssoClientId} required><Input dir="ltr" value={draft.clientId} onChange={e=>setDraft(c=>({...c,clientId:e.target.value}))}/></Field>
     <Field label={t.integration.ssoClientSecret} required><Input dir="ltr" type="password" value={draft.clientSecret} onChange={e=>setDraft(c=>({...c,clientSecret:e.target.value}))}/></Field>
     <Field label={t.integration.ssoDomains} required><Input dir="ltr" value={draft.domains} onChange={e=>setDraft(c=>({...c,domains:e.target.value}))} placeholder="example.org, example.sa"/></Field>
     <Field label={t.integration.ssoDefaultRole}>
      <Select value={draft.defaultRole} onChange={e=>setDraft(c=>({...c,defaultRole:e.target.value}))}>
       {['Viewer','Coordinator','Reviewer','Impact'].map(role=><option key={role} value={role}>{t.roles[role as keyof typeof t.roles]}</option>)}
      </Select>
     </Field>
     <div className="flex items-end">
      <Checkbox label={t.integration.ssoAutoProvision} checked={draft.autoProvision} onChange={e=>setDraft(c=>({...c,autoProvision:e.target.checked}))}/>
     </div>
     <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
      <Button loading={busy} disabled={!draft.issuer.startsWith('https://')||draft.clientId.length<3||draft.clientSecret.length<8||!draft.domains.trim()}
       onClick={()=>run('sso.configure',{issuer:draft.issuer.trim(),clientId:draft.clientId.trim(),clientSecret:draft.clientSecret,domains:draft.domains.split(',').map(d=>d.trim()).filter(Boolean),defaultRole:draft.defaultRole,autoProvision:draft.autoProvision})}>
       {t.common.save}
      </Button>
      {data.sso?(
       <Button variant={data.sso.active?'danger':'primary'} loading={busy}
        onClick={()=>run('sso.activate',{active:!data.sso!.active,reason:'changed by admin'})}>
        {data.sso.active?t.common.disable:t.common.enable}
       </Button>
      ):null}
     </div>
    </div>
    {data.sso?.active?<div className="mt-4"><CopyField label={t.integration.ssoLoginUrl} value={data.ssoLoginUrl}/></div>:null}
   </Card>

   {data.links.length?(
    <Card padded={false}>
     <div className="px-5 pt-5"><SectionHeader title={t.integration.ssoLinks}/></div>
     <Table className="mt-3">
      <thead><tr><Th>{t.common.name}</Th><Th>{t.common.email}</Th><Th>{t.common.date}</Th><Th/></tr></thead>
      <tbody>
       {data.links.map(link=>(
        <Tr key={link.id}>
         <Td className="text-[13px]">{link.user?.name??'…'}</Td>
         <Td className="text-[12px]"><span dir="ltr">{link.email}</span></Td>
         <Td className="whitespace-nowrap text-[12px]">{formatDateTime(link.linkedAt,locale)}</Td>
         <Td>
          <span className="flex justify-end">
           {link.revokedAt?<Badge tone="neutral">{t.integration.keyRevoked}</Badge>:(
            <Button size="sm" variant="danger" loading={busy} onClick={()=>run('sso.unlink',{id:link.id,reason:'unlinked by admin'})}>{t.integration.ssoUnlink}</Button>
           )}
          </span>
         </Td>
        </Tr>
       ))}
      </tbody>
     </Table>
    </Card>
   ):null}
  </>
 );
}

/* ── Messaging ── */
function Messaging({data}:{data:IntegrationState}){
 const {locale,t,run,busy}=useApp();
 const [draft,setDraft]=useState({code:'application_received',channel:'SMS',bodyAr:'',bodyEn:'',approved:false});
 const [consent,setConsent]=useState({address:'',channel:'SMS'});
 return (
  <>
   <Card>
    <SectionHeader title={t.integration.templates} hint={t.integration.templatesHint}/>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
     <Field label={t.integration.templateCode} required>
      <Select value={draft.code} onChange={e=>setDraft(c=>({...c,code:e.target.value}))}>
       {['application_received','application_needs_info','application_decided','activity_reminder'].map(code=><option key={code} value={code}>{code}</option>)}
      </Select>
     </Field>
     <Field label={t.integration.channel} required>
      <Select value={draft.channel} onChange={e=>setDraft(c=>({...c,channel:e.target.value}))}>
       {['SMS','WhatsApp'].map(channel=><option key={channel} value={channel}>{channel}</option>)}
      </Select>
     </Field>
     <Field label={`${t.integration.templates} · العربية`} required hint="{reference} {program} {decision}">
      <Textarea rows={2} value={draft.bodyAr} onChange={e=>setDraft(c=>({...c,bodyAr:e.target.value}))}/>
     </Field>
     <Field label={`${t.integration.templates} · English`} required hint="{reference} {program} {decision}">
      <Textarea rows={2} value={draft.bodyEn} onChange={e=>setDraft(c=>({...c,bodyEn:e.target.value}))}/>
     </Field>
     <Checkbox label={t.integration.templateApproved} checked={draft.approved} onChange={e=>setDraft(c=>({...c,approved:e.target.checked}))}/>
     <div className="flex justify-end">
      <Button icon={<MessageSquare size={15}/>} loading={busy} disabled={draft.bodyAr.trim().length<5||draft.bodyEn.trim().length<5}
       onClick={()=>run('messaging.template',{code:draft.code,channel:draft.channel,bodyAr:draft.bodyAr.trim(),bodyEn:draft.bodyEn.trim(),approved:draft.approved})}>
       {t.common.save}
      </Button>
     </div>
    </div>
    {data.templates.length?(
     <Table className="mt-4">
      <thead><tr><Th>{t.integration.templateCode}</Th><Th>{t.integration.channel}</Th><Th>{t.common.status}</Th></tr></thead>
      <tbody>
       {data.templates.map(template=>(
        <Tr key={template.id}>
         <Td className="font-mono text-[12px]"><span dir="ltr">{template.code}</span></Td>
         <Td className="text-[12.5px]">{template.channel}</Td>
         <Td><Badge tone={template.approved?'positive':'caution'}>{template.approved?t.integration.templateApproved:t.statuses.Pending}</Badge></Td>
        </Tr>
       ))}
      </tbody>
     </Table>
    ):null}
   </Card>

   <Card>
    <SectionHeader title={t.integration.consent} hint={t.integration.consentHint}/>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
     <Field label={t.integration.consentAddress} hint="+9665xxxxxxxx">
      <Input dir="ltr" value={consent.address} onChange={e=>setConsent(c=>({...c,address:e.target.value}))}/>
     </Field>
     <Field label={t.integration.channel}>
      <Select value={consent.channel} onChange={e=>setConsent(c=>({...c,channel:e.target.value}))}>
       {['SMS','WhatsApp'].map(channel=><option key={channel} value={channel}>{channel}</option>)}
      </Select>
     </Field>
     <div className="flex items-end gap-2">
      <Button loading={busy} disabled={!/^\+[1-9]\d{6,14}$/.test(consent.address)}
       onClick={()=>run('messaging.consent',{channel:consent.channel,address:consent.address,optedIn:true})}>{t.integration.optIn}</Button>
      <Button variant="ghost" loading={busy} disabled={!/^\+[1-9]\d{6,14}$/.test(consent.address)}
       onClick={()=>run('messaging.consent',{channel:consent.channel,address:consent.address,optedIn:false})}>{t.integration.optOut}</Button>
     </div>
    </div>
    {data.consents.length?(
     <p className="mt-3 text-[12px] text-[var(--text-muted)]">
      {formatNumber(data.consents.filter(c=>c.optedIn).length,locale)} / {formatNumber(data.consents.length,locale)}
     </p>
    ):null}
   </Card>
  </>
 );
}

/* ── CSV import ── */
type Preview={id:string;headers:string[];fields:{id:string;labelAr:string;labelEn:string;required:boolean}[];mapping:Record<string,string>;report:{row:number;status:string;reason?:string;name?:string;email?:string}[];totals:{total:number;create:number;skip:number;error:number}};

function Imports({state,data}:{state:AppState;data:IntegrationState}){
 const {locale,t,run,busy}=useApp();
 const [kind,setKind]=useState<'beneficiaries'|'applications'>('beneficiaries');
 const [programId,setProgramId]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null);
 const [options,setOptions]=useState({createAccounts:false,sendInvitations:false});
 const open=data.programs.filter(p=>['RegistrationOpen','RegistrationClosed'].includes(p.status));

 async function pick(file:File){
  const source=await file.text();
  const result=await run('import.create',{kind,filename:file.name,source,...(kind==='applications'?{programId}:{})}) as Preview|null;
  if(result)setPreview(result);
 }

 return (
  <>
   <Card>
    <SectionHeader title={t.importer.title} hint={t.importer.subtitle}/>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
     <Field label={t.importer.kind} required>
      <Select value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setPreview(null);}}>
       <option value="beneficiaries">{t.importer.kinds.beneficiaries}</option>
       <option value="applications">{t.importer.kinds.applications}</option>
      </Select>
     </Field>
     {kind==='applications'?(
      <Field label={t.common.program} required>
       <Select value={programId} onChange={e=>{setProgramId(e.target.value);setPreview(null);}}>
        <option value="">{t.common.none}</option>
        {open.map(p=><option key={p.id} value={p.id}>{locale==='ar'?p.nameAr:p.nameEn}</option>)}
       </Select>
      </Field>
     ):null}
     <Field label={t.importer.pick} required>
      <Input type="file" accept=".csv,text/csv" disabled={busy||(kind==='applications'&&!programId)}
       onChange={e=>{const file=e.target.files?.[0];if(file)pick(file);}}/>
     </Field>
    </div>
   </Card>

   {preview?(
    <>
     <Card>
      <SectionHeader title={t.importer.mapping} hint={t.importer.mappingHint}/>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
       {preview.fields.map(field=>(
        <Field key={field.id} label={locale==='ar'?field.labelAr:field.labelEn} required={field.required}>
         <Select value={preview.mapping[field.id]??''}
          onChange={async e=>{
           const mapping={...preview.mapping,[field.id]:e.target.value};
           if(!e.target.value)delete mapping[field.id];
           const result=await run('import.map',{id:preview.id,mapping}) as Preview|null;
           if(result)setPreview(result);
          }}>
          <option value="">{t.common.none}</option>
          {preview.headers.map(header=><option key={header} value={header}>{header}</option>)}
         </Select>
        </Field>
       ))}
      </div>
     </Card>

     <Card>
      <SectionHeader title={t.importer.preview}/>
      <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
       <span><span className="text-[var(--text-muted)]">{t.common.total}: </span><span className="font-semibold tabular-nums">{formatNumber(preview.totals.total,locale)}</span></span>
       <span><span className="text-[var(--text-muted)]">{t.importer.willCreate}: </span><span className="font-semibold tabular-nums text-positive">{formatNumber(preview.totals.create,locale)}</span></span>
       <span><span className="text-[var(--text-muted)]">{t.importer.willSkip}: </span><span className="font-semibold tabular-nums">{formatNumber(preview.totals.skip,locale)}</span></span>
       <span><span className="text-[var(--text-muted)]">{t.importer.willError}: </span><span className="font-semibold tabular-nums text-critical">{formatNumber(preview.totals.error,locale)}</span></span>
      </div>
      {preview.report.filter(r=>r.status!=='create').length?(
       <Table className="mt-4">
        <thead><tr><Th>{t.importer.rowNumber}</Th><Th>{t.common.name}</Th><Th>{t.common.status}</Th><Th>{t.common.reason}</Th></tr></thead>
        <tbody>
         {preview.report.filter(r=>r.status!=='create').slice(0,50).map(row=>(
          <Tr key={row.row}>
           <Td className="tabular-nums">{row.row}</Td>
           <Td className="text-[12.5px]">{row.name??'…'}<span className="block text-[11px] text-[var(--text-faint)]" dir="ltr">{row.email}</span></Td>
           <Td><Badge tone={row.status==='error'?'critical':'caution'}>{row.status==='error'?t.importer.willError:t.importer.willSkip}</Badge></Td>
           <Td className="text-[12px] text-[var(--text-muted)]">{t.importer.reasons[row.reason as keyof typeof t.importer.reasons]??row.reason}</Td>
          </Tr>
         ))}
        </tbody>
       </Table>
      ):null}
      <div className="mt-4 grid gap-2">
       <Checkbox label={t.importer.createAccounts} checked={options.createAccounts}
        onChange={e=>setOptions({createAccounts:e.target.checked,sendInvitations:e.target.checked?options.sendInvitations:false})}/>
       <p className="text-[11.5px] text-[var(--text-faint)]">{t.importer.createAccountsHint}</p>
       <Checkbox label={t.importer.sendInvitations} checked={options.sendInvitations} disabled={!options.createAccounts}
        onChange={e=>setOptions(c=>({...c,sendInvitations:e.target.checked}))}/>
       <p className="text-[11.5px] text-[var(--text-faint)]">{t.importer.sendInvitationsHint}</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
       <Button variant="ghost" loading={busy} onClick={async()=>{await run('import.discard',{id:preview.id});setPreview(null);}}>{t.common.discard}</Button>
       <Button icon={<Upload size={15}/>} loading={busy} disabled={!preview.totals.create}
        onClick={async()=>{const r=await run('import.apply',{id:preview.id,...options,reason:'reviewed preview'});if(r)setPreview(null);}}>
        {t.common.apply}
       </Button>
      </div>
     </Card>
    </>
   ):null}

   {data.imports.length?(
    <Card padded={false}>
     <div className="px-5 pt-5"><SectionHeader title={t.importer.history}/></div>
     <Table className="mt-3">
      <thead><tr><Th>{t.common.date}</Th><Th>{t.importer.kind}</Th><Th>{t.common.status}</Th><Th>{t.importer.willCreate}</Th><Th>{t.importer.willError}</Th></tr></thead>
      <tbody>
       {data.imports.map(job=>(
        <Tr key={job.id}>
         <Td className="whitespace-nowrap text-[12px]">{formatDateTime(job.createdAt,locale)}</Td>
         <Td className="text-[12.5px]">{t.importer.kinds[job.kind as keyof typeof t.importer.kinds]??job.kind}</Td>
         <Td><StatusBadge status={job.status} label={t.statuses[job.status as keyof typeof t.statuses]??job.status}/></Td>
         <Td className="tabular-nums">{formatNumber(job.createdRows,locale)}</Td>
         <Td className="tabular-nums">{formatNumber(job.errorRows,locale)}</Td>
        </Tr>
       ))}
      </tbody>
     </Table>
    </Card>
   ):null}
  </>
 );
}
