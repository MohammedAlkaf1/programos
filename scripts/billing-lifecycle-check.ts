/**
 * Drives one subscription through its whole life against the real database,
 * simulating the passage of time, then removes everything it created.
 *
 *   npm run billing:check
 *
 * Trial ends -> invoice issued -> unpaid past grace -> workspace suspended
 * -> payment recorded -> workspace restored -> next period renews.
 */
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { runBillingCycle, markInvoicePaid } from '../src/lib/billing-jobs.js';
import { GRACE_DAYS, DUE_DAYS } from '../src/lib/billing.js';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DAY = 86_400_000;
const slug = `lifecycle-${Date.now().toString(36)}`;
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${actual}, expected ${expected})`}`);
}

async function tenantStatus(id: string) {
  return (await db.tenant.findUniqueOrThrow({ where: { id } })).status;
}
async function subStatus(id: string) {
  return (await db.subscription.findUniqueOrThrow({ where: { tenantId: id } })).status;
}

async function main() {
  const plan = await db.plan.findFirstOrThrow({ where: { code: 'growth' } });

  const tenant = await db.tenant.create({
    data: { slug, nameAr: 'مؤسسة فحص الفوترة', nameEn: 'Billing Lifecycle Check' },
  });
  const user = await db.user.create({
    data: {
      email: `${slug}@example.invalid`,
      name: 'فاحص',
      password: 'x'.repeat(60),
      verified: true,
    },
  });
  await db.membership.create({
    data: { userId: user.id, tenantId: tenant.id, role: 'Admin', programIds: [] },
  });

  const trialEnds = new Date(Date.now() + 14 * DAY);
  await db.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      status: 'Trialing',
      trialEndsAt: trialEnds,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnds,
    },
  });

  console.log('\n1. during the trial');
  await runBillingCycle(new Date());
  check('subscription still Trialing', await subStatus(tenant.id), 'Trialing');
  check('no invoice yet', await db.invoice.count({ where: { tenantId: tenant.id } }), 0);

  console.log('\n2. the trial ends');
  const afterTrial = new Date(trialEnds.getTime() + DAY);
  await runBillingCycle(afterTrial);
  check('becomes PastDue awaiting first payment', await subStatus(tenant.id), 'PastDue');
  check('one invoice issued', await db.invoice.count({ where: { tenantId: tenant.id } }), 1);
  check('workspace still usable', await tenantStatus(tenant.id), 'Active');

  console.log('\n3. running again the same day changes nothing (idempotent)');
  await runBillingCycle(afterTrial);
  check('still one invoice', await db.invoice.count({ where: { tenantId: tenant.id } }), 1);

  console.log('\n4. invoice unpaid past due + grace');
  const afterGrace = new Date(afterTrial.getTime() + (DUE_DAYS + GRACE_DAYS + 1) * DAY);
  await runBillingCycle(afterGrace);
  check('workspace suspended', await tenantStatus(tenant.id), 'Suspended');
  const suspendedInvoice = await db.invoice.findFirstOrThrow({ where: { tenantId: tenant.id } });
  check('invoice still Open', suspendedInvoice.status, 'Open');

  console.log('\n5. payment recorded');
  const paid = await markInvoicePaid(suspendedInvoice.id, { providerRef: 'BANK-REF-1' });
  check('payment applied', paid.changed, true);
  check('subscription Active again', await subStatus(tenant.id), 'Active');
  check('workspace restored', await tenantStatus(tenant.id), 'Active');

  console.log('\n6. the same payment recorded twice is ignored');
  const again = await markInvoicePaid(suspendedInvoice.id, { providerRef: 'BANK-REF-1' });
  check('second attempt is a no-op', again.changed, false);

  console.log('\n7. the period rolls over');
  const subscription = await db.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
  await runBillingCycle(new Date(subscription.currentPeriodEnd.getTime() + DAY));
  check('second invoice issued', await db.invoice.count({ where: { tenantId: tenant.id } }), 2);
  check('awaiting payment again', await subStatus(tenant.id), 'PastDue');

  console.log('\n8. cancelling at period end');
  const current = await db.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
  await db.subscription.update({
    where: { id: current.id },
    data: { status: 'Active', cancelAtPeriodEnd: true },
  });
  await runBillingCycle(new Date(current.currentPeriodEnd.getTime() + DAY));
  check('subscription Cancelled', await subStatus(tenant.id), 'Cancelled');

  // Clean up everything this check created.
  await db.invoice.deleteMany({ where: { tenantId: tenant.id } });
  await db.subscription.deleteMany({ where: { tenantId: tenant.id } });
  await db.outbox.deleteMany({ where: { tenantId: tenant.id } });
  await db.audit.deleteMany({ where: { tenantId: tenant.id } });
  await db.membership.deleteMany({ where: { tenantId: tenant.id } });
  await db.user.delete({ where: { id: user.id } });
  await db.tenant.delete({ where: { id: tenant.id } });

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall billing lifecycle checks passed');
  if (failures) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
