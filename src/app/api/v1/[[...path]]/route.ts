import {NextRequest,NextResponse} from 'next/server';
import {actorForKey,requireScope,type Scope} from '@/lib/api-keys';
import {command} from '@/lib/commands';
import {getState} from '@/lib/state';
import {db} from '@/lib/db';
import {DomainError} from '@/lib/domain';
import {ZodError} from 'zod';

/**
 * The tenant facing REST API (FR-054).
 *
 * It is a thin projection over the same command and state layers the screens
 * use, so an integration can never reach data or an operation the interface
 * would refuse. Reads come from `getState()`, which masks personal fields by
 * role; writes go through `command()`, which re-checks permission, plan limits
 * and the state machine. The key adds scopes on top: a narrower ceiling, never
 * a wider one.
 */

const LIMIT=600,WINDOW=60000;
const json=(status:number,body:unknown,correlationId?:string)=>{
 const r=NextResponse.json(body,{status});
 r.headers.set('cache-control','no-store');
 if(correlationId)r.headers.set('x-correlation-id',correlationId);
 return r;
};

async function throttle(keyId:string){
 const key=`api:${keyId}`,now=new Date();
 const bucket=await db.authAttempt.findUnique({where:{key}});
 if(bucket&&bucket.resetAt>now&&bucket.count>=LIMIT)throw new DomainError('rateLimited',429);
 await db.authAttempt.upsert({where:{key},create:{key,count:1,resetAt:new Date(Date.now()+WINDOW)},update:bucket&&bucket.resetAt>now?{count:{increment:1}}:{count:1,resetAt:new Date(Date.now()+WINDOW)}});
}

const page=(url:URL)=>({take:Math.min(Number(url.searchParams.get('limit')??50)||50,200),cursor:url.searchParams.get('cursor')});

/** Only these fields ever leave over the API. Adding a field here is a deliberate act. */
const shapes={
 program:(p:any)=>({id:p.id,nameAr:p.nameAr,nameEn:p.nameEn,status:p.status,capacity:p.capacity,startsAt:p.startsAt,endsAt:p.endsAt,registrationStart:p.registrationStart,registrationEnd:p.registrationEnd,completionThreshold:p.completionThreshold,initiativeId:p.initiativeId,version:p.version}),
 application:(a:any)=>({id:a.id,reference:a.reference,programId:a.programId,status:a.status,submittedAt:a.submittedAt,firstDecidedAt:a.firstDecidedAt,beneficiary:{id:a.beneficiaryId,name:a.beneficiary.name,email:a.beneficiary.email},enrollment:a.enrollment?{id:a.enrollment.id,status:a.enrollment.status,completedAt:a.enrollment.completedAt}:null}),
 beneficiary:(a:any)=>({id:a.beneficiary.id,name:a.beneficiary.name,email:a.beneficiary.email,status:a.beneficiary.status}),
 indicator:(i:any)=>({id:i.id,programId:i.programId,nameAr:i.nameAr,nameEn:i.nameEn,unit:i.unit,target:i.target,direction:i.direction,aggregation:i.aggregation,pairs:i.pairs,change:i.change,coverage:i.coverage,actual:i.actual}),
};

/** Write routes map one to one onto commands; the body is passed through untouched. */
const writes:Record<string,{scope:Scope;action:string}>={
 'applications/review':{scope:'applications:write',action:'application.review'},
 'applications/decide':{scope:'applications:write',action:'application.decide'},
 'applications/request-info':{scope:'applications:write',action:'application.info'},
 'attendance':{scope:'attendance:write',action:'attendance.save'},
 'measurements':{scope:'impact:write',action:'measurement.save'},
 'measurements/verify':{scope:'impact:write',action:'measurement.verify'},
 'indicators':{scope:'impact:write',action:'indicator.create'},
};

async function authenticate(req:NextRequest){
 const header=req.headers.get('authorization')??'';
 const token=header.toLowerCase().startsWith('bearer ')?header.slice(7):'';
 const resolved=token?await actorForKey(token):null;
 if(!resolved)throw new DomainError('unauthorized',401);
 await throttle(resolved.keyId);
 return resolved;
}

export async function GET(req:NextRequest,{params}:{params:Promise<{path?:string[]}>}){
 const {path=[]}=await params;const route=path.join('/');let correlationId='';
 try{
  const {actor,scopes}=await authenticate(req);correlationId=actor.correlationId;
  const url=new URL(req.url),{take,cursor}=page(url);

  if(route===''||route==='openapi.json')return json(200,openapi());

  if(route==='programs'){requireScope(scopes,'programs:read');const s=await getState(actor);return json(200,{data:s.programs.map(shapes.program)},correlationId);}

  if(route==='applications'){
   requireScope(scopes,'applications:read');
   const s=await getState(actor,{programId:url.searchParams.get('programId')??undefined});
   let rows=s.applications;
   const status=url.searchParams.get('status');if(status)rows=rows.filter((a:any)=>a.status===status);
   return json(200,{data:rows.slice(0,take).map(shapes.application),nextCursor:rows.length>take?rows[take].id:null},correlationId);
  }

  if(route==='beneficiaries'){
   requireScope(scopes,'beneficiaries:read');
   const s=await getState(actor);
   const unique=new Map(s.applications.map((a:any)=>[a.beneficiaryId,shapes.beneficiary(a)]));
   return json(200,{data:[...unique.values()].slice(0,take)},correlationId);
  }

  if(route==='indicators'){requireScope(scopes,'impact:read');const s=await getState(actor,{programId:url.searchParams.get('programId')??undefined});return json(200,{data:s.indicators.map(shapes.indicator)},correlationId);}

  if(route==='reports/kpis'){requireScope(scopes,'reports:read');const s=await getState(actor,{programId:url.searchParams.get('programId')??undefined});return json(200,{asOf:s.asOf,formulaVersion:'2',data:s.kpis},correlationId);}

  if(route==='events'){
   requireScope(scopes,'events:read');
   const rows=await db.domainEvent.findMany({where:{tenantId:actor.tenantId,...(url.searchParams.get('type')?{type:url.searchParams.get('type')!}:{}),...(cursor?{createdAt:{lt:new Date(cursor)}}:{})},orderBy:{createdAt:'desc'},take});
   return json(200,{data:rows.map(e=>({id:e.id,type:e.type,entityId:e.entityId,occurredAt:e.createdAt,data:e.payload})),nextCursor:rows.length===take?rows[rows.length-1].createdAt.toISOString():null},correlationId);
  }

  throw new DomainError('notFound',404);
 }catch(e){return fail(e,correlationId);}
}

export async function POST(req:NextRequest,{params}:{params:Promise<{path?:string[]}>}){
 const {path=[]}=await params;const route=path.join('/');let correlationId='';
 try{
  const target=writes[route];if(!target)throw new DomainError('notFound',404);
  if(!req.headers.get('content-type')?.includes('application/json'))throw new DomainError('invalid',415);
  const raw=await req.text();if(raw.length>100000)throw new DomainError('invalid',413);
  const {actor,scopes,keyId}=await authenticate(req);correlationId=actor.correlationId;
  requireScope(scopes,target.scope);

  // Idempotency works exactly as it does for the screens, keyed per API key.
  const header=req.headers.get('idempotency-key');
  let key:string|null=null;
  if(header){
   if(!/^[a-zA-Z0-9_-]{8,128}$/.test(header))throw new DomainError('invalid',422);
   key=`apikey:${keyId}:${header}`;
   try{await db.idempotencyKey.create({data:{id:key,userId:actor.userId,action:target.action,status:0,body:{}}});}
   catch{
    const prior=await db.idempotencyKey.findUnique({where:{id:key}});
    if(!prior||prior.status===0)throw new DomainError('conflict',409);
    if(prior.action!==target.action)throw new DomainError('invalid',422);
    return json(prior.status,{...(prior.body as object),replayed:true},correlationId);
   }
  }
  try{
   const result=await command(actor,target.action,JSON.parse(raw));
   const payload={ok:true,result};
   if(key)await db.idempotencyKey.update({where:{id:key},data:{status:200,body:JSON.parse(JSON.stringify(payload))}});
   return json(200,payload,correlationId);
  }catch(e){
   if(key){const status=e instanceof DomainError?e.status:500;if(status<500)await db.idempotencyKey.update({where:{id:key},data:{status,body:{error:e instanceof DomainError?e.code:'server'}}}).catch(()=>{});else await db.idempotencyKey.delete({where:{id:key}}).catch(()=>{});}
   throw e;
  }
 }catch(e){return fail(e,correlationId);}
}

function fail(e:unknown,correlationId:string){
 if(e instanceof DomainError)return json(e.status,{error:e.code},correlationId);
 if(e instanceof ZodError||e instanceof SyntaxError)return json(422,{error:'invalid'},correlationId);
 console.error('api_failure',correlationId,e instanceof Error?e.name:'unknown');
 return json(500,{error:'server'},correlationId);
}

/** A machine readable description so an integrator does not have to guess. */
function openapi(){
 return {
  openapi:'3.1.0',
  info:{title:'ProgramOS API',version:'1.0.0',description:'Read program, application and results data, and drive review actions. Authenticate with Authorization: Bearer pos_… . Send Idempotency-Key on writes.'},
  servers:[{url:`${process.env.APP_URL??'http://127.0.0.1:3000'}/api/v1`}],
  components:{securitySchemes:{bearer:{type:'http',scheme:'bearer'}}},
  security:[{bearer:[]}],
  paths:Object.fromEntries([
   ...['programs','applications','beneficiaries','indicators','reports/kpis','events'].map(p=>[`/${p}`,{get:{summary:`List ${p}`,responses:{'200':{description:'OK'},'401':{description:'Unknown or revoked key'},'403':{description:'Missing scope'},'429':{description:'Rate limited'}}}}]),
   ...Object.entries(writes).map(([p,w])=>[`/${p}`,{post:{summary:w.action,description:`Requires scope ${w.scope}. Body matches the ${w.action} command.`,responses:{'200':{description:'OK'},'409':{description:'Conflict or in flight retry'},'422':{description:'Validation failed'}}}}]),
  ]),
 };
}
