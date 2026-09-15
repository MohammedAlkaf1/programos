import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {verify,SIGNATURE_HEADER} from '@/lib/signature';
import {messageProvider} from '@/lib/messaging';
import {paymentProvider,moyasar,settleExternalPayment} from '@/lib/billing';
import {timingSafeEqual} from 'node:crypto';

/**
 * Inbound signed events from providers: delivery receipts for SMS and WhatsApp
 * (FR-050) and payment notifications (FR-053).
 *
 * Three layers guard this route. The signature proves the sender. The timestamp
 * inside the signed string makes a captured request useless after five minutes.
 * And the unique (provider, externalId) row makes a replay inside that window a
 * no-op: the second delivery finds the first already recorded and changes
 * nothing. Payment state is therefore reconciled, never incremented.
 */

const ok=(body:object={received:true})=>NextResponse.json(body,{status:200});

export async function POST(req:NextRequest,{params}:{params:Promise<{provider:string}>}){
 const {provider}=await params;
 const raw=await req.text();
 if(raw.length>100000)return NextResponse.json({error:'invalid'},{status:413});

 let body:Record<string,unknown>;
 try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'invalid'},{status:422});}

 // Moyasar authenticates with a shared secret token inside the payload rather than an HMAC header.
 if(provider==='moyasar'){
  const expected=process.env.MOYASAR_WEBHOOK_SECRET;
  if(!expected)return NextResponse.json({error:'unavailable'},{status:503});
  const given=String(body.secret_token??req.headers.get('x-moyasar-secret')??'');
  const a=Buffer.from(given),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))return NextResponse.json({error:'mismatch'},{status:401});
  const event=moyasar.parseEvent?.(body);
  if(!event)return NextResponse.json({error:'invalid'},{status:422});
  try{
   const outcome=await db.$transaction(tx=>settleExternalPayment(tx as never,'moyasar',event,body as object));
   return ok({received:true,outcome});
  }catch(e){
   if(e&&typeof e==='object'&&'code' in e&&(e as {code:string}).code==='P2002')return ok({received:true,duplicate:true});
   console.error('hook_failure',provider,e instanceof Error?e.name:'unknown');
   return NextResponse.json({error:'server'},{status:500});
  }
 }

 const secret=provider==='billing'?process.env.BILLING_WEBHOOK_SECRET:process.env.MESSAGING_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:'unavailable'},{status:503});
 const result=verify(secret,raw,req.headers.get(SIGNATURE_HEADER)??req.headers.get('x-signature'));
 if(!result.ok)return NextResponse.json({error:result.reason},{status:result.reason==='stale'?408:401});

 try{
  if(provider==='messaging'){
   const receipt=messageProvider().parseReceipt(raw,Object.fromEntries(req.headers));
   if(!receipt)return NextResponse.json({error:'invalid'},{status:422});
   const message=await db.outbox.findFirst({where:{providerRef:receipt.providerRef}});
   await db.$transaction(async tx=>{
    await tx.inboundEvent.create({data:{provider,externalId:receipt.externalId,type:receipt.status,tenantId:message?.tenantId??null,payload:body as object}});
    if(message)await tx.outbox.update({where:{id:message.id},data:receipt.status==='Delivered'?{deliveredAt:new Date(),status:'Sent'}:{status:'Failed',failure:receipt.detail?.slice(0,300)??'provider reported failure'}});
   });
   return ok();
  }

  if(provider==='billing'){
   const event=paymentProvider(String(body.provider??process.env.BILLING_PROVIDER??'manual')).parseEvent?.(body);
   const externalId=String(body.id??event?.externalId??'');
   const invoiceId=String(body.invoiceId??event?.invoiceId??'');
   const status=String(body.status??event?.status??'');
   if(!externalId||!invoiceId)return NextResponse.json({error:'invalid'},{status:422});
   // The unique constraint inside settleExternalPayment is the whole replay defence; a duplicate throws P2002 below.
   const amount=body.amount===undefined?event?.amount:Number(body.amount);
   const outcome=await db.$transaction(tx=>settleExternalPayment(tx as never,provider,{externalId,invoiceId,status:status==='paid'?'paid':status==='failed'?'failed':'pending',amount},body as object));
   return ok({received:true,outcome});
  }

  return NextResponse.json({error:'notFound'},{status:404});
 }catch(e){
  // A duplicate delivery lands here and is answered as success on purpose:
  // the provider has done its job and must not keep retrying.
  if(e&&typeof e==='object'&&'code' in e&&(e as {code:string}).code==='P2002')return ok({received:true,duplicate:true});
  console.error('hook_failure',provider,e instanceof Error?e.name:'unknown');
  return NextResponse.json({error:'server'},{status:500});
 }
}
