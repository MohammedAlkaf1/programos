import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {db} from './db';
import {DomainError} from './domain';

/**
 * SMS and WhatsApp delivery (FR-050).
 *
 * Three rules shape this module. Consent is per channel and checked at queue
 * time, not at send time, so a message that should never exist is never
 * written down. Only approved templates go out, because SMS and WhatsApp
 * providers review templates and free text would invalidate that review.
 * And the provider is an interface: with none configured the message is
 * written to `data/messages/` so the whole path stays testable without an
 * account anywhere.
 */

export const channels=['Email','SMS','WhatsApp'] as const;
export type Channel=typeof channels[number];

export type SendResult={providerRef:string};
export type MessageProvider={
 readonly name:string;
 send(input:{to:string;body:string;templateCode?:string|null;channel:Channel}):Promise<SendResult>;
 /** Verifies an inbound delivery receipt and returns its stable external id. */
 parseReceipt(body:string,headers:Record<string,string>):{externalId:string;providerRef:string;status:'Delivered'|'Failed';detail?:string}|null;
};

const registry=new Map<string,MessageProvider>();
export function registerProvider(provider:MessageProvider){registry.set(provider.name,provider);}

/** The default: writes each message to disk instead of sending it. */
const fileProvider:MessageProvider={
 name:'file',
 async send({to,body,channel}){
  const dir=path.resolve('data/messages');mkdirSync(dir,{recursive:true});
  const ref=`file_${Date.now()}_${Math.random().toString(16).slice(2,10)}`;
  writeFileSync(path.join(dir,`${ref}.txt`),[`Channel: ${channel}`,`To: ${to}`,'',body].join('\n'),'utf8');
  return {providerRef:ref};
 },
 parseReceipt(body){
  try{const parsed=JSON.parse(body);if(!parsed.id||!parsed.providerRef)return null;
   return {externalId:String(parsed.id),providerRef:String(parsed.providerRef),status:parsed.status==='Failed'?'Failed':'Delivered',detail:parsed.detail?String(parsed.detail):undefined};}
  catch{return null;}
 },
};
registerProvider(fileProvider);

export function messageProvider(name=process.env.MESSAGING_PROVIDER??'file'){
 return registry.get(name)??fileProvider;
}

/** Fills `{name}` style placeholders. Values are inserted verbatim, never parsed. */
export function render(template:string,values:Record<string,string>){
 return template.replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
}

export async function consentFor(tenantId:string,userId:string,channel:Channel){
 if(channel==='Email')return true;
 const row=await db.messagingConsent.findUnique({where:{tenantId_userId_channel:{tenantId,userId,channel}}});
 return Boolean(row?.optedIn&&row.verifiedAt);
}

/**
 * Queues one templated message. Returns null when there is no consent or no
 * approved template, which is a normal outcome and not an error: the inbox
 * notification already carried the information.
 */
export async function queueMessage(tx:any,tenantId:string,userId:string,channel:Channel,templateCode:string,values:Record<string,string>,dedupeKey?:string){
 if(channel!=='Email'){
  const consent=await tx.messagingConsent.findUnique({where:{tenantId_userId_channel:{tenantId,userId,channel}}});
  if(!consent?.optedIn||!consent.verifiedAt)return null;
  const template=await tx.messagingTemplate.findUnique({where:{tenantId_code_channel:{tenantId,code:templateCode,channel}}});
  if(!template?.approved)return null;
  const body=render(template.bodyAr,values)+'\n'+render(template.bodyEn,values);
  const data={tenantId,channel,recipient:consent.address,subject:templateCode,body,templateCode,dedupeKey};
  if(dedupeKey)return tx.outbox.upsert({where:{dedupeKey},create:data,update:{}});
  return tx.outbox.create({data});
 }
 throw new DomainError('invalid');
}
