import {randomUUID} from 'node:crypto';
/**
 * The domain event bus behind the public API and every connector.
 *
 * Commands record what happened; nothing in the command layer knows or cares
 * who is listening. Recording an event and queueing its deliveries happen in
 * the same transaction as the change itself, so a listener can never be told
 * about something that was rolled back, and a committed change can never be
 * silently unannounced.
 */
export const eventTypes=[
 'program.published','program.registration_opened','program.registration_closed','program.activated','program.completed','program.cancelled','program.updated',
 'application.submitted','application.needs_info','application.decided','application.withdrawn',
 'enrollment.created','enrollment.completed','enrollment.withdrawn','enrollment.suspended',
 'activity.created','activity.cancelled','attendance.recorded',
 'measurement.verified','indicator.created',
 'invoice.issued','invoice.paid','subscription.changed',
 'privacy.request_created','privacy.request_fulfilled',
] as const;
export type EventType=typeof eventTypes[number];

/** Payloads carry identifiers and state, never form answers or personal notes. */
export type EventPayload=Record<string,string|number|boolean|null>;

const MAX_ATTEMPTS=6;

/**
 * Records one event and fans it out to every matching webhook endpoint and
 * connector. `tx` is the surrounding transaction, so this is atomic with the
 * write that caused it.
 */
export async function emit(tx:any,tenantId:string,actorId:string,type:EventType,entityId:string,payload:EventPayload){
 const eventId=randomUUID();
 await tx.domainEvent.create({data:{id:eventId,tenantId,type,entityId,actorId,payload}});
 const endpoints=await tx.webhookEndpoint.findMany({where:{tenantId,active:true}});
 const body={id:eventId,type,entityId,tenantId,occurredAt:new Date().toISOString(),data:payload};
 for(const endpoint of endpoints){
  // An empty subscription list means every event; otherwise exact type or a `program.*` prefix.
  const wanted=!endpoint.events.length||endpoint.events.includes(type)||endpoint.events.some((e:string)=>e.endsWith('.*')&&type.startsWith(e.slice(0,-1)));
  if(!wanted)continue;
  await tx.webhookDelivery.create({data:{tenantId,endpointId:endpoint.id,eventId,event:type,payload:body}});
 }
 const connectors=await tx.connector.findMany({where:{tenantId,status:'Active'}});
 for(const connector of connectors){
  if(connector.scopes.length&&!connector.scopes.some((s:string)=>type.startsWith(s.replace(/\*$/,''))))continue;
  await tx.connectorRun.create({data:{tenantId,connectorId:connector.id,event:type,payload:body}});
 }
 return eventId;
}

/** Exponential backoff in minutes: 1, 5, 15, 60, 180, 360, then dead letter. */
export function nextAttempt(attempts:number){
 const minutes=[1,5,15,60,180,360][attempts]??360;
 return {delayMs:minutes*60000,dead:attempts+1>=MAX_ATTEMPTS};
}
export {MAX_ATTEMPTS};
