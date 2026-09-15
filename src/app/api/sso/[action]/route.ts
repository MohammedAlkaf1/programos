import {NextRequest,NextResponse} from 'next/server';
import {createHash,randomBytes} from 'node:crypto';
import {cookies} from 'next/headers';
import {db} from '@/lib/db';
import {DomainError} from '@/lib/domain';
import {discover,exchangeCode,pkce,verifyIdToken,domainOf} from '@/lib/oidc';

/**
 * Single sign on entry and return (FR-051).
 *
 * The provider proves who the person is. It does not decide what they may do:
 * membership, role and program scope stay with the workspace admin, and a
 * provider claim can never grant more than the admin already granted. When the
 * identity checks out we hand the browser a single use ticket that the ordinary
 * sign in form redeems, so there is exactly one place in the product that
 * creates a session.
 */

const COOKIE='programos.sso';
const fail=(locale:string,code:string)=>NextResponse.redirect(new URL(`/${locale}/login?sso=${code}`,process.env.APP_URL??'http://127.0.0.1:3000'));

export async function GET(req:NextRequest,{params}:{params:Promise<{action:string}>}){
 const {action}=await params;
 const url=new URL(req.url);
 const base=process.env.APP_URL??url.origin;
 const locale=url.searchParams.get('locale')==='en'?'en':'ar';
 try{
  if(action==='start'){
   const slug=url.searchParams.get('tenant')??'';
   const tenant=await db.tenant.findUnique({where:{slug}});
   if(!tenant||tenant.status!=='Active')return fail(locale,'unavailable');
   const config=await db.ssoConfig.findUnique({where:{tenantId:tenant.id}});
   if(!config?.active)return fail(locale,'unavailable');
   const discovery=await discover(config.issuer);
   const {verifier,challenge}=pkce();
   const state=randomBytes(16).toString('hex'),nonce=randomBytes(16).toString('hex');
   const authorize=new URL(discovery.authorization_endpoint);
   authorize.searchParams.set('response_type','code');
   authorize.searchParams.set('client_id',config.clientId);
   authorize.searchParams.set('redirect_uri',`${base}/api/sso/callback`);
   authorize.searchParams.set('scope','openid email profile');
   authorize.searchParams.set('state',state);
   authorize.searchParams.set('nonce',nonce);
   authorize.searchParams.set('code_challenge',challenge);
   authorize.searchParams.set('code_challenge_method','S256');
   const response=NextResponse.redirect(authorize);
   response.cookies.set(COOKIE,JSON.stringify({tenantId:tenant.id,state,nonce,verifier,locale}),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:600});
   return response;
  }

  if(action==='callback'){
   const jar=await cookies();
   const raw=jar.get(COOKIE)?.value;
   if(!raw)return fail(locale,'expired');
   const session=JSON.parse(raw) as {tenantId:string;state:string;nonce:string;verifier:string;locale:string};
   if(url.searchParams.get('state')!==session.state)return fail(session.locale,'state');
   const code=url.searchParams.get('code');
   if(!code)return fail(session.locale,'denied');
   const config=await db.ssoConfig.findUnique({where:{tenantId:session.tenantId}});
   if(!config?.active)return fail(session.locale,'unavailable');
   const discovery=await discover(config.issuer);
   const idToken=await exchangeCode(discovery,config.clientId,config.clientSecret,code,`${base}/api/sso/callback`,session.verifier);
   const claims=await verifyIdToken(idToken,discovery,config.clientId,session.nonce);
   if(!config.domains.includes(domainOf(claims.email)))return fail(session.locale,'domain');

   const ticket=randomBytes(32).toString('hex');
   const outcome=await db.$transaction(async tx=>{
    const existing=await tx.ssoLink.findUnique({where:{tenantId_subject:{tenantId:session.tenantId,subject:claims.sub}}});
    let user=await tx.user.findUnique({where:{email:claims.email}});
    // A link is bound to one subject. A different subject claiming a linked
    // address is refused rather than silently rebound.
    if(existing&&existing.revokedAt)return 'revoked';
    if(user&&existing&&existing.userId!==user.id)return 'conflict';
    if(!user){
     if(!config.autoProvision)return 'unknown';
     user=await tx.user.create({data:{email:claims.email,name:claims.name?.slice(0,120)||claims.email.split('@')[0],password:randomBytes(32).toString('hex'),verified:true}});
    }
    const membership=await tx.membership.findUnique({where:{tenantId_userId:{tenantId:session.tenantId,userId:user.id}}});
    if(!membership){
     if(!config.autoProvision)return 'unknown';
     await tx.membership.create({data:{tenantId:session.tenantId,userId:user.id,role:config.defaultRole}});
    }else if(!membership.active)return 'inactive';
    await tx.ssoLink.upsert({where:{tenantId_subject:{tenantId:session.tenantId,subject:claims.sub}},create:{tenantId:session.tenantId,userId:user.id,subject:claims.sub,email:claims.email},update:{userId:user.id,email:claims.email,revokedAt:null}});
    await tx.authToken.create({data:{userId:user.id,tokenHash:createHash('sha256').update(ticket).digest('hex'),purpose:'sso',payload:session.tenantId,expiresAt:new Date(Date.now()+120000)}});
    await tx.audit.create({data:{tenantId:session.tenantId,actorId:user.id,action:'sso.signin',entityId:user.id,detail:{subject:claims.sub,domain:domainOf(claims.email)}}});
    return 'ok';
   });
   if(outcome!=='ok')return fail(session.locale,outcome);
   const response=NextResponse.redirect(new URL(`/${session.locale}/login?ticket=${ticket}`,base));
   response.cookies.delete(COOKIE);
   return response;
  }

  return NextResponse.json({error:'notFound'},{status:404});
 }catch(e){
  if(e instanceof DomainError)return fail(locale,e.code);
  console.error('sso_failure',e instanceof Error?e.name:'unknown');
  return fail(locale,'error');
 }
}
