import {NextRequest,NextResponse} from 'next/server';
import {auth} from '@/auth';
import {db} from '@/lib/db';
export async function POST(req:NextRequest){
 const origin=req.headers.get('origin');if(!origin||!['http://localhost:3000','http://127.0.0.1:3000',process.env.APP_URL].includes(origin))return NextResponse.json({error:'forbidden'},{status:403});
 const session=await auth();if(!session?.user?.id)return new NextResponse(null,{status:401});
 const {tenantId}=await req.json();const m=await db.membership.findFirst({where:{tenantId,userId:session.user.id,active:true}});if(!m)return new NextResponse(null,{status:403});
 const res=NextResponse.json({ok:true});res.cookies.set('programos.tenant',tenantId,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'});return res;
}
