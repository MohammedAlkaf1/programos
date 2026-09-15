import {NextRequest,NextResponse} from 'next/server';
import {auth} from '@/auth';
import {db} from '@/lib/db';
import {compare} from 'bcryptjs';
import {newSecret,seal,unseal,verifyOtp} from '@/lib/totp';
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==new URL(process.env.APP_URL??req.url).origin&&req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'forbidden'},{status:403});
 const session=await auth();if(!session?.user?.id)return NextResponse.json({error:'unauthorized'},{status:401});
 const user=await db.user.findUniqueOrThrow({where:{id:session.user.id}});const raw=await req.text();if(raw.length>2000)return NextResponse.json({error:'invalid'},{status:413});
 let data;try{data=JSON.parse(raw);}catch{return NextResponse.json({error:'invalid'},{status:422});}
 const key=`mfa:${user.id}`,now=new Date();const bucket=await db.authAttempt.findUnique({where:{key}});if(bucket&&bucket.resetAt>now&&bucket.count>=5)return NextResponse.json({error:'rateLimited'},{status:429});
 await db.authAttempt.upsert({where:{key},create:{key,count:1,resetAt:new Date(Date.now()+900000)},update:bucket&&bucket.resetAt>now?{count:{increment:1}}:{count:1,resetAt:new Date(Date.now()+900000)}});
 if(!await compare(String(data.password??''),user.password))return NextResponse.json({error:'invalid'},{status:403});
 if(data.action==='setup'&&!user.mfaEnabled){const secret=newSecret();await db.user.update({where:{id:user.id},data:{mfaSecret:seal(secret)}});return NextResponse.json({secret});}
 if(data.action==='confirm'&&!user.mfaEnabled&&user.mfaSecret){const step=verifyOtp(unseal(user.mfaSecret),String(data.code??''));if(!step)return NextResponse.json({error:'invalid'},{status:422});await db.user.update({where:{id:user.id},data:{mfaEnabled:true,mfaLastStep:step,sessionVersion:{increment:1}}});return NextResponse.json({ok:true});}
 return NextResponse.json({error:'invalid'},{status:422});
}
