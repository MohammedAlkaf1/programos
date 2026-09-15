import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import {compare} from 'bcryptjs';
import {createHash} from 'node:crypto';
import {db} from '@/lib/db';
import {unseal,verifyOtp} from '@/lib/totp';

/**
 * Two ways in, one session. The password provider is the ordinary path. The
 * ticket provider redeems a single use token that the single sign on callback
 * issued after it verified the identity provider (FR-051), so exactly one place
 * in the product mints a session and the second factor rule below applies to
 * both. A workspace that requires its own second factor keeps requiring it,
 * because that check lives in the actor resolver, not here.
 */
export const {handlers,auth,signIn,signOut}=NextAuth({
 trustHost:true,
 session:{strategy:'jwt',maxAge:43200},
 providers:[
 Credentials({id:'sso',name:'sso',credentials:{ticket:{}},async authorize(c){
  const raw=String(c.ticket??'');
  if(!/^[a-f0-9]{64}$/.test(raw))return null;
  const record=await db.authToken.findUnique({where:{tokenHash:createHash('sha256').update(raw).digest('hex')}});
  if(!record||record.purpose!=='sso'||record.usedAt||record.expiresAt<new Date())return null;
  const claimed=await db.authToken.updateMany({where:{id:record.id,usedAt:null},data:{usedAt:new Date()}});
  if(!claimed.count)return null;
  const user=await db.user.findUnique({where:{id:record.userId}});
  if(!user?.active)return null;
  if(record.payload)await db.membership.findFirst({where:{tenantId:record.payload,userId:user.id,active:true}}).then(m=>{if(!m)throw new Error('no membership');});
  await db.user.update({where:{id:user.id},data:{lastSeenAt:new Date()}});
  return {id:user.id,name:user.name,email:user.email};
 }}),
 Credentials({credentials:{email:{},password:{},code:{}},async authorize(c){
  const email=String(c.email??'').toLowerCase().trim(),password=String(c.password??'');
  if(email.length>254||password.length>200)return null;
  const key=createHash('sha256').update(email).digest('hex');const now=new Date();
  const attempt=await db.authAttempt.findUnique({where:{key}});
  if(attempt&&attempt.resetAt>now&&attempt.count>=5)return null;
  const user=await db.user.findUnique({where:{email}});
  if(!user||!user.active||!user.verified||!await compare(password,user.password)){
   await db.authAttempt.upsert({where:{key},create:{key,count:1,resetAt:new Date(Date.now()+900000)},update:attempt&&attempt.resetAt>now?{count:{increment:1}}:{count:1,resetAt:new Date(Date.now()+900000)}});return null;
  }
  if(user.mfaEnabled){const step=user.mfaSecret?verifyOtp(unseal(user.mfaSecret),String(c.code??''),user.mfaLastStep):null;if(!step){await db.authAttempt.upsert({where:{key},create:{key,count:1,resetAt:new Date(Date.now()+900000)},update:attempt&&attempt.resetAt>now?{count:{increment:1}}:{count:1,resetAt:new Date(Date.now()+900000)}});return null;}const claim=await db.user.updateMany({where:{id:user.id,mfaLastStep:{lt:step}},data:{mfaLastStep:step}});if(!claim.count)return null;}
  await db.authAttempt.deleteMany({where:{key}});await db.user.update({where:{id:user.id},data:{lastSeenAt:new Date()}});return {id:user.id,name:user.name,email:user.email};
 }})],
 callbacks:{async jwt({token,user}){if(user){token.uid=user.id;token.version=(await db.user.findUnique({where:{id:user.id}}))?.sessionVersion;}return token;},async session({session,token}){const current=await db.user.findUnique({where:{id:String(token.uid)}});if(session.user)session.user.id=current?.active&&current.sessionVersion===token.version?String(token.uid):'';return session;}},
 pages:{signIn:'/ar/login'}
});
