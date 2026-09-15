import {createHash} from 'node:crypto';
import {db} from './db';
import {settingsFor} from './ai';
import type {Actor} from './access';

/**
 * The reads behind the integrations and assistant screens.
 *
 * Kept out of `getState()` on purpose: these are two administrative pages, and
 * loading webhook history or assistant runs on every dashboard request would
 * make the daily path slower for everyone to serve a screen almost nobody has
 * open.
 */

export async function getIntegrationState(a:Actor):Promise<IntegrationState>{
 const [keys,endpoints,deliveries,connectors,runs,conflicts,sso,links,templates,consents,imports,programs]=await Promise.all([
  db.apiKey.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},select:{id:true,name:true,prefix:true,scopes:true,expiresAt:true,lastUsedAt:true,revokedAt:true,createdAt:true}}),
  db.webhookEndpoint.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},select:{id:true,url:true,events:true,active:true,lastSuccessAt:true,lastFailureAt:true,createdAt:true}}),
  db.webhookDelivery.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},take:60,select:{id:true,endpointId:true,event:true,status:true,attempts:true,responseCode:true,error:true,deliveredAt:true,createdAt:true}}),
  db.connector.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},select:{id:true,kind:true,name:true,config:true,fieldMap:true,scopes:true,status:true,lastRunAt:true,lastError:true,secret:true}}),
  db.connectorRun.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},take:40,select:{id:true,connectorId:true,event:true,status:true,attempts:true,error:true,createdAt:true}}),
  db.externalRef.findMany({where:{tenantId:a.tenantId,conflict:true},orderBy:{syncedAt:'desc'},take:40}),
  db.ssoConfig.findUnique({where:{tenantId:a.tenantId},select:{id:true,issuer:true,clientId:true,domains:true,defaultRole:true,autoProvision:true,active:true}}),
  db.ssoLink.findMany({where:{tenantId:a.tenantId},orderBy:{linkedAt:'desc'},take:50}),
  db.messagingTemplate.findMany({where:{tenantId:a.tenantId},orderBy:{code:'asc'}}),
  db.messagingConsent.findMany({where:{tenantId:a.tenantId},orderBy:{updatedAt:'desc'},take:100}),
  db.importJob.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},take:20,select:{id:true,kind:true,filename:true,status:true,totalRows:true,createdRows:true,skippedRows:true,errorRows:true,appliedAt:true,createdAt:true,programId:true}}),
  db.program.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},select:{id:true,nameAr:true,nameEn:true,status:true}}),
 ]);
 const tenant=await db.tenant.findUnique({where:{id:a.tenantId},select:{slug:true}});
 const base=process.env.APP_URL??'http://127.0.0.1:3000';
 const userIds=[...new Set(links.map(l=>l.userId))];
 const users=userIds.length?await db.user.findMany({where:{id:{in:userIds}},select:{id:true,name:true,email:true}}):[];
 return JSON.parse(JSON.stringify({
  keys,endpoints,deliveries,runs,conflicts,sso,templates,consents,imports,programs,
  // The feed address is derived, never stored, so revoking the connector revokes every link at once.
  connectors:connectors.map(c=>({...c,secret:undefined,calendar:c.kind==='calendar'?programs.map(p=>({programId:p.id,nameAr:p.nameAr,nameEn:p.nameEn,url:`${base}/api/calendar?c=${c.id}&p=${p.id}&t=${createHash('sha256').update(`${c.secret}:${p.id}`).digest('hex')}`})):[]})),
  links:links.map(l=>({...l,user:users.find(u=>u.id===l.userId)??null})),
  ssoLoginUrl:`${base}/api/sso/start?tenant=${tenant?.slug??''}`,
  eventTypes:[] as string[],
 }));
}

export async function getAssistantState(a:Actor):Promise<AssistantState>{
 const settings=await settingsFor(a.tenantId);
 const [runs,docs,programs]=await Promise.all([
  db.aiRun.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},take:30,select:{id:true,userId:true,feature:true,model:true,status:true,output:true,citations:true,inputTokens:true,outputTokens:true,cost:true,error:true,approvedBy:true,approvedAt:true,createdAt:true}}),
  db.knowledgeDoc.findMany({where:{tenantId:a.tenantId},orderBy:{updatedAt:'desc'},take:100,select:{id:true,title:true,programId:true,tags:true,updatedAt:true}}),
  db.program.findMany({where:{tenantId:a.tenantId},orderBy:{createdAt:'desc'},select:{id:true,nameAr:true,nameEn:true,status:true}}),
 ]);
 return JSON.parse(JSON.stringify({settings:{enabled:settings.enabled,model:settings.model,monthlyCap:settings.monthlyCap,spentThisMonth:settings.spentThisMonth,retainDays:settings.retainDays,approvedAt:settings.approvedAt,terms:settings.terms},runs,docs,programs}));
}

/**
 * Declared rather than inferred: these objects cross the server boundary as
 * JSON, so dates arrive as strings and an inferred type would claim otherwise.
 */
export type ApiKeyRow={id:string;name:string;prefix:string;scopes:string[];expiresAt:string|null;lastUsedAt:string|null;revokedAt:string|null;createdAt:string};
export type EndpointRow={id:string;url:string;events:string[];active:boolean;lastSuccessAt:string|null;lastFailureAt:string|null;createdAt:string};
export type DeliveryRow={id:string;endpointId:string;event:string;status:string;attempts:number;responseCode:number|null;error:string|null;deliveredAt:string|null;createdAt:string};
export type ConnectorRow={id:string;kind:string;name:string;config:{url?:string};fieldMap:Record<string,string>;scopes:string[];status:string;lastRunAt:string|null;lastError:string|null;calendar:{programId:string;nameAr:string;nameEn:string;url:string}[]};
export type ConnectorRunRow={id:string;connectorId:string;event:string;status:string;attempts:number;error:string|null;createdAt:string};
export type ConflictRow={id:string;entity:string;entityId:string;source:string;externalId:string;conflict:boolean;syncedAt:string};
export type SsoRow={id:string;issuer:string;clientId:string;domains:string[];defaultRole:string;autoProvision:boolean;active:boolean}|null;
export type SsoLinkRow={id:string;userId:string;subject:string;email:string;linkedAt:string;revokedAt:string|null;user:{id:string;name:string;email:string}|null};
export type TemplateRow={id:string;code:string;channel:string;bodyAr:string;bodyEn:string;approved:boolean;providerRef:string|null};
export type ConsentRow={id:string;userId:string;channel:string;address:string;optedIn:boolean;verifiedAt:string|null;updatedAt:string};
export type ImportRow={id:string;kind:string;filename:string;status:string;totalRows:number;createdRows:number;skippedRows:number;errorRows:number;appliedAt:string|null;createdAt:string;programId:string|null};
export type ProgramRow={id:string;nameAr:string;nameEn:string;status:string};

export type IntegrationState={
 keys:ApiKeyRow[];endpoints:EndpointRow[];deliveries:DeliveryRow[];connectors:ConnectorRow[];runs:ConnectorRunRow[];
 conflicts:ConflictRow[];sso:SsoRow;links:SsoLinkRow[];templates:TemplateRow[];consents:ConsentRow[];
 imports:ImportRow[];programs:ProgramRow[];ssoLoginUrl:string;
};

export type AiRunRow={id:string;userId:string;feature:string;model:string;status:string;output:unknown;citations:unknown;inputTokens:number;outputTokens:number;cost:number;error:string|null;approvedBy:string|null;approvedAt:string|null;createdAt:string};
export type DocRow={id:string;title:string;programId:string|null;tags:string[];updatedAt:string};
export type AssistantState={
 settings:{enabled:boolean;model:string;monthlyCap:number;spentThisMonth:number;retainDays:number;approvedAt:string|null;terms:string};
 runs:AiRunRow[];docs:DocRow[];programs:ProgramRow[];
};
