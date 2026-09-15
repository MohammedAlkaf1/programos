/**
 * Drains the outbound integration queues: webhook deliveries (FR-054) and
 * connector runs (FR-052).
 *
 *   npm run integrations           once
 *   npm run integrations:worker    every 15 seconds until stopped
 *
 * Both queues follow the same discipline. Each payload has its own attempt
 * chain with growing backoff, a chain that runs out becomes a dead letter the
 * tenant admin can see and replay, and a receiver that is down never blocks a
 * program operation because nothing here runs inside a request.
 */
import 'dotenv/config';
import { captureError } from '../src/lib/errors';
import {db} from '../src/lib/db';
import {sign} from '../src/lib/signature';
import {nextAttempt,MAX_ATTEMPTS} from '../src/lib/events';
import {deliver,projection,type ConnectorKind} from '../src/lib/connectors';

const BATCH=25;

async function drainWebhooks(){
 const due=await db.webhookDelivery.findMany({where:{status:'Queued',nextAttemptAt:{lte:new Date()}},orderBy:{createdAt:'asc'},take:BATCH,include:{endpoint:true}});
 let sent=0,failed=0,dead=0;
 for(const delivery of due){
  if(!delivery.endpoint.active){await db.webhookDelivery.update({where:{id:delivery.id},data:{status:'Skipped',error:'endpoint inactive'}});continue;}
  const body=JSON.stringify(delivery.payload);
  try{
   const response=await fetch(delivery.endpoint.url,{
    method:'POST',
    headers:{'content-type':'application/json','x-programos-signature':sign(delivery.endpoint.secret,body),'x-programos-event':delivery.event,'x-programos-delivery':delivery.id},
    body,
    signal:AbortSignal.timeout(15000),
   });
   if(!response.ok)throw new Error(`status ${response.status}`);
   await db.$transaction([
    db.webhookDelivery.update({where:{id:delivery.id},data:{status:'Delivered',attempts:{increment:1},responseCode:response.status,deliveredAt:new Date(),error:null}}),
    db.webhookEndpoint.update({where:{id:delivery.endpointId},data:{lastSuccessAt:new Date()}}),
   ]);
   sent++;
  }catch(error){
   const {delayMs,dead:exhausted}=nextAttempt(delivery.attempts);
   await db.$transaction([
    db.webhookDelivery.update({where:{id:delivery.id},data:{attempts:{increment:1},status:exhausted?'Dead':'Queued',nextAttemptAt:new Date(Date.now()+delayMs),error:(error instanceof Error?error.message:'unknown').slice(0,300)}}),
    db.webhookEndpoint.update({where:{id:delivery.endpointId},data:{lastFailureAt:new Date()}}),
   ]);
   exhausted?dead++:failed++;
  }
 }
 return {sent,failed,dead,considered:due.length};
}

async function drainConnectors(){
 const due=await db.connectorRun.findMany({where:{status:'Queued',nextAttemptAt:{lte:new Date()}},orderBy:{createdAt:'asc'},take:BATCH,include:{connector:true}});
 let sent=0,failed=0,dead=0;
 for(const run of due){
  if(run.connector.status!=='Active'){await db.connectorRun.update({where:{id:run.id},data:{status:'Skipped',error:'connector paused'}});continue;}
  try{
   const envelope=run.payload as {data?:Record<string,unknown>};
   const mapped=projection(run.connector.kind as ConnectorKind,run.connector.fieldMap as Record<string,string>,envelope.data??{});
   await deliver(run.connector,{event:run.event,fields:mapped});
   await db.$transaction([
    db.connectorRun.update({where:{id:run.id},data:{status:'Delivered',attempts:{increment:1},completedAt:new Date(),error:null}}),
    db.connector.update({where:{id:run.connectorId},data:{lastRunAt:new Date(),lastError:null}}),
   ]);
   sent++;
  }catch(error){
   const {delayMs,dead:exhausted}=nextAttempt(run.attempts);
   const message=(error instanceof Error?error.message:'unknown').slice(0,300);
   await db.$transaction([
    db.connectorRun.update({where:{id:run.id},data:{attempts:{increment:1},status:exhausted?'Dead':'Queued',nextAttemptAt:new Date(Date.now()+delayMs),error:message}}),
    db.connector.update({where:{id:run.connectorId},data:{lastError:message}}),
   ]);
   exhausted?dead++:failed++;
  }
 }
 return {sent,failed,dead,considered:due.length};
}

export async function drain(){
 const [webhooks,connectors]=[await drainWebhooks(),await drainConnectors()];
 return {webhooks,connectors};
}

const watch=process.argv.includes('--watch');
async function once(){
 const result=await drain();
 if(result.webhooks.considered||result.connectors.considered){
  console.log(`webhooks: ${result.webhooks.sent} delivered, ${result.webhooks.failed} retrying, ${result.webhooks.dead} dead · connectors: ${result.connectors.sent} delivered, ${result.connectors.failed} retrying, ${result.connectors.dead} dead`);
 }
 return result;
}

if(watch){
 console.log(`integration worker started (every 15s, up to ${MAX_ATTEMPTS} attempts per payload) — Ctrl+C to stop`);
 await once();
 const timer=setInterval(()=>{once().catch(error=>{console.error(error);void captureError(error,{source:'worker',path:'integrations:worker'});});},15000);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{clearInterval(timer);await db.$disconnect();process.exit(0);});
}else{
 await once();
 await db.$disconnect();
}
