import {NextRequest,NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {db} from '@/lib/db';
import {icalendar} from '@/lib/connectors';

/**
 * A read only calendar feed of a program's activities (FR-052, calendar half).
 *
 * Calendar clients cannot sign in, so the feed is addressed by an unguessable
 * token derived from the connector secret and the program. It carries titles,
 * times and places only: never a participant, never a name. Pausing or deleting
 * the connector invalidates every link that came from it.
 */
export async function GET(req:NextRequest){
 const url=new URL(req.url);
 const connectorId=url.searchParams.get('c')??'';
 const programId=url.searchParams.get('p')??'';
 const token=url.searchParams.get('t')??'';
 const locale=url.searchParams.get('locale')==='en'?'en':'ar';
 if(!/^[0-9a-f-]{36}$/.test(connectorId)||!/^[0-9a-f-]{36}$/.test(programId)||!/^[0-9a-f]{64}$/.test(token))return new NextResponse('not found',{status:404});

 const connector=await db.connector.findFirst({where:{id:connectorId,kind:'calendar',status:'Active'}});
 if(!connector)return new NextResponse('not found',{status:404});
 const expected=createHash('sha256').update(`${connector.secret}:${programId}`).digest();
 const given=Buffer.from(token,'hex');
 if(expected.length!==given.length||!timingSafeEqual(expected,given))return new NextResponse('not found',{status:404});

 const program=await db.program.findFirst({where:{id:programId,tenantId:connector.tenantId},include:{activities:{orderBy:{startsAt:'asc'}}}});
 if(!program)return new NextResponse('not found',{status:404});

 const body=icalendar(program.activities,locale,locale==='ar'?program.nameAr:program.nameEn);
 return new NextResponse(body,{headers:{'content-type':'text/calendar; charset=utf-8','cache-control':'public, max-age=900','content-disposition':`inline; filename="program-${programId.slice(0,8)}.ics"`}});
}

/** The address a tenant admin copies into a calendar client. */
export function feedUrl(base:string,connector:{id:string;secret:string},programId:string,locale:'ar'|'en'='ar'){
 const token=createHash('sha256').update(`${connector.secret}:${programId}`).digest('hex');
 return `${base}/api/calendar?c=${connector.id}&p=${programId}&t=${token}&locale=${locale}`;
}
