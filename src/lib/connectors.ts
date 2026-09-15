import {createHash} from 'node:crypto';
import {db} from './db';
import {DomainError} from './domain';
import {sign} from './signature';

/**
 * Connectors to outside systems (FR-052).
 *
 * Every connector is the same shape regardless of what it talks to: a field
 * map from our vocabulary to theirs, a scope list that limits which events it
 * ever sees, and a signed HTTPS delivery with its own retry chain. A provider
 * being down is contained inside that chain. It can never block a decision, an
 * enrollment or a report, because delivery is queued in the same transaction as
 * the change and drained by a separate worker.
 *
 * Records that come back from a connector are stamped with where they came
 * from, and a value that disagrees with what we last sent is marked as a
 * conflict for a person to settle rather than silently overwritten.
 */

export const connectorKinds=['calendar','lms','crm','bi'] as const;
export type ConnectorKind=typeof connectorKinds[number];

/** The fields each kind may receive, so a field map cannot invent a target. */
export const connectorFields:Record<ConnectorKind,string[]>={
 calendar:['title','startsAt','endsAt','location','programName','attendeeCount'],
 lms:['courseId','learnerEmail','learnerName','enrollmentStatus','completedAt','attendanceRate'],
 crm:['contactEmail','contactName','contactPhone','programName','stage','decidedAt'],
 bi:['programId','programName','submitted','accepted','enrolled','completed','completionRate','acceptanceRate','change','coverage'],
};

export function projection(kind:ConnectorKind,fieldMap:Record<string,string>,source:Record<string,unknown>){
 const allowed=connectorFields[kind];
 const out:Record<string,unknown>={};
 for(const [ours,theirs] of Object.entries(fieldMap)){
  if(!allowed.includes(ours))continue;
  if(source[ours]!==undefined)out[theirs||ours]=source[ours];
 }
 // An empty map means send the standard field names untouched.
 if(!Object.keys(fieldMap).length)for(const field of allowed)if(source[field]!==undefined)out[field]=source[field];
 return out;
}

export function checksumOf(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,32);}

/**
 * Records where a record came from. When the incoming checksum differs from
 * what we hold, the row is flagged rather than overwritten.
 */
export async function trackSource(tx:any,tenantId:string,entity:string,entityId:string,source:string,externalId:string,value:unknown){
 const checksum=checksumOf(value);
 const existing=await tx.externalRef.findUnique({where:{tenantId_source_entity_externalId:{tenantId,source,entity,externalId}}});
 if(existing&&existing.entityId!==entityId){
  await tx.externalRef.update({where:{id:existing.id},data:{conflict:true,conflictDetail:{heldBy:existing.entityId,claimedBy:entityId},syncedAt:new Date()}});
  throw new DomainError('conflict',409);
 }
 return tx.externalRef.upsert({
  where:{tenantId_source_entity_externalId:{tenantId,source,entity,externalId}},
  create:{tenantId,entity,entityId,source,externalId,checksum},
  update:{checksum,conflict:Boolean(existing&&existing.checksum!==checksum),conflictDetail:existing&&existing.checksum!==checksum?{previous:existing.checksum,incoming:checksum}:undefined,syncedAt:new Date()},
 });
}

/** Delivers one payload. The body is signed the same way our webhooks are. */
export async function deliver(connector:{id:string;kind:string;config:unknown;fieldMap:unknown;secret:string},payload:unknown){
 const config=(connector.config??{}) as {url?:string;headers?:Record<string,string>};
 if(!config.url)throw new Error('connector has no url');
 const body=JSON.stringify({connectorId:connector.id,kind:connector.kind,payload});
 const response=await fetch(config.url,{
  method:'POST',
  headers:{'content-type':'application/json','x-programos-signature':sign(connector.secret,body),...(config.headers??{})},
  body,
  signal:AbortSignal.timeout(15000),
 });
 if(!response.ok)throw new Error(`status ${response.status}`);
 return response.status;
}

/**
 * The calendar feed (FR-052, calendar half). Served as text so any calendar
 * client can subscribe without a connector at the other end.
 */
export function icalendar(activities:{id:string;nameAr:string;nameEn:string;startsAt:Date;endsAt:Date;location:string;status:string}[],locale:'ar'|'en',name:string){
 const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const escape=(s:string)=>s.replace(/([,;\\])/g,'\\$1').replace(/\n/g,'\\n');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ProgramOS//AR//','CALSCALE:GREGORIAN','METHOD:PUBLISH',`X-WR-CALNAME:${escape(name)}`,'X-WR-TIMEZONE:Asia/Riyadh'];
 for(const activity of activities){
  lines.push('BEGIN:VEVENT',`UID:${activity.id}@programos`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(activity.startsAt)}`,`DTEND:${stamp(activity.endsAt)}`,
   `SUMMARY:${escape(locale==='ar'?activity.nameAr:activity.nameEn)}`,`LOCATION:${escape(activity.location)}`,
   `STATUS:${activity.status==='Cancelled'?'CANCELLED':'CONFIRMED'}`,'END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 // Folded at 75 octets as the format requires, so long Arabic titles survive.
 return lines.flatMap(line=>{const out=[];let rest=line;while(Buffer.byteLength(rest)>73){let cut=73;while(Buffer.byteLength(rest.slice(0,cut))>73)cut--;out.push(rest.slice(0,cut));rest=' '+rest.slice(cut);}out.push(rest);return out;}).join('\r\n')+'\r\n';
}

export async function connectorFor(tenantId:string,id:string){
 const connector=await db.connector.findFirst({where:{id,tenantId}});
 if(!connector)throw new DomainError('notFound',404);
 return connector;
}
