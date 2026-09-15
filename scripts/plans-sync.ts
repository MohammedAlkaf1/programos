/**
 * Brings the plan table in line with the price list below.
 *
 *   npm run plans:sync
 *
 * Plans are matched by code and updated in place, so existing subscriptions
 * keep pointing at the same rows and simply see the new price at their next
 * invoice. A plan missing from the list is deactivated, never deleted: its
 * subscriptions and invoices stay intact and readable.
 *
 * The list itself lives in scripts/plans.ts, shared with scripts/seed.ts.
 */
import 'dotenv/config';
import {db} from '../src/lib/db';

import {PLANS} from './plans';

export async function syncPlans(){
 const codes=PLANS.map(p=>p.code) as string[];
 for(const plan of PLANS){
  const data={...plan,features:[...plan.features],active:true};
  await db.plan.upsert({where:{code:plan.code},create:data,update:data});
 }
 const retired=await db.plan.updateMany({where:{code:{notIn:codes},active:true},data:{active:false}});
 return {upserted:PLANS.length,retired:retired.count};
}

if(process.argv[1]&&/plans-sync\.ts$/.test(process.argv[1])){
 try{
  const result=await syncPlans();
  console.log(`plans: ${result.upserted} in place, ${result.retired} retired`);
  for(const plan of await db.plan.findMany({orderBy:{sortOrder:'asc'}}))console.log(`  ${plan.active?'•':'·'} ${plan.code.padEnd(11)} ${(plan.priceMonthly/100).toFixed(0).padStart(6)} ${plan.currency}  programs ${plan.maxPrograms} members ${plan.maxMembers} enrollments ${plan.maxEnrollments}  [${plan.features.join(', ')}]`);
 }finally{
  await db.$disconnect();
 }
}
