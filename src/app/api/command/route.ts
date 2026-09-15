import {NextRequest,NextResponse} from 'next/server';
import {actor} from '@/lib/access';
import {command} from '@/lib/commands';
import {DomainError} from '@/lib/domain';
import {db} from '@/lib/db';
import {ZodError} from 'zod';
import {captureError} from '@/lib/errors';
const LIMIT=240,WINDOW=60000;
/** Per user fair use bucket (NFR-12). Shares the AuthAttempt table so no new infrastructure is needed. */
async function throttle(userId:string){
 const key=`cmd:${userId}`,now=new Date();const b=await db.authAttempt.findUnique({where:{key}});
 if(b&&b.resetAt>now&&b.count>=LIMIT)throw new DomainError('rateLimited',429);
 await db.authAttempt.upsert({where:{key},create:{key,count:1,resetAt:new Date(Date.now()+WINDOW)},update:b&&b.resetAt>now?{count:{increment:1}}:{count:1,resetAt:new Date(Date.now()+WINDOW)}});
}
function respond(status:number,body:object,correlationId?:string){const r=NextResponse.json(body,{status});if(correlationId)r.headers.set('x-correlation-id',correlationId);return r;}
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin&&!['http://localhost:3000','http://127.0.0.1:3000',process.env.APP_URL].includes(req.headers.get('origin')??''))return respond(403,{error:'forbidden'});
 if(!req.headers.get('content-type')?.includes('application/json'))return respond(415,{error:'invalid'});
 let key:string|null=null,correlationId='';
 try{
  const raw=await req.text();if(raw.length>100000)return respond(413,{error:'invalid'});const body=JSON.parse(raw);
  const a=await actor();correlationId=a.correlationId;await throttle(a.userId);
  const header=req.headers.get('idempotency-key')??(typeof body.idempotencyKey==='string'?body.idempotencyKey:null);
  if(header){
   if(!/^[a-zA-Z0-9_-]{8,128}$/.test(header))return respond(422,{error:'invalid'},correlationId);
   key=`${a.userId}:${header}`;
   // The row doubles as a lock: a second identical request that arrives mid flight sees status 0 and is told to retry, never to run twice.
   try{await db.idempotencyKey.create({data:{id:key,userId:a.userId,action:String(body.action),status:0,body:{}}});}
   catch{const prior=await db.idempotencyKey.findUnique({where:{id:key}});if(!prior)return respond(409,{error:'conflict'},correlationId);if(prior.action!==String(body.action))return respond(422,{error:'invalid'},correlationId);if(prior.status===0)return respond(409,{error:'conflict'},correlationId);return respond(prior.status,{...(prior.body as object),replayed:true},correlationId);}
  }
  const result=await command(a,body.action,body.data);
  const payload={ok:true,result};
  if(key)await db.idempotencyKey.update({where:{id:key},data:{status:200,body:JSON.parse(JSON.stringify(payload))}});
  return respond(200,payload,correlationId);
 }
 catch(e){
  let status=500,error='server';
  if(e instanceof DomainError){status=e.status;error=e.code;}else if(e instanceof ZodError||e instanceof SyntaxError){status=422;error='invalid';}else{console.error('command_failure',correlationId,e instanceof Error?e.name:'unknown');await captureError(e,{source:'api',path:'/api/command',context:{correlationId}});}
  if(key){if(status<500)await db.idempotencyKey.update({where:{id:key},data:{status,body:{error}}}).catch(()=>{});else await db.idempotencyKey.delete({where:{id:key}}).catch(()=>{});}
  return respond(status,{error},correlationId);
 }
}
