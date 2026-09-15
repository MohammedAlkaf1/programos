/**
 * Platform-operator billing CLI. These are deliberately NOT actions a tenant
 * admin can perform from the app: a customer must not be able to mark their
 * own invoice paid.
 *
 *   npm run billing:cycle              advance trials, renewals, dunning
 *   npm run billing -- invoices        list open invoices
 *   npm run billing -- paid <number>   record a received bank transfer
 *   npm run billing -- plans           list configured plans
 */
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { runBillingCycle, markInvoicePaid } from '../src/lib/billing-jobs.js';
import { formatMoney } from '../src/lib/plan-math.js';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const [command, argument] = process.argv.slice(2);

async function main() {
  switch (command) {
    case 'cycle': {
      const report = await runBillingCycle();
      console.log('billing cycle:', report);
      break;
    }

    case 'invoices': {
      const invoices = await db.invoice.findMany({
        where: { status: 'Open' },
        orderBy: { dueAt: 'asc' },
      });
      if (!invoices.length) {
        console.log('no open invoices');
        break;
      }
      for (const invoice of invoices) {
        const tenant = await db.tenant.findUnique({ where: { id: invoice.tenantId } });
        const overdue = invoice.dueAt < new Date() ? '  OVERDUE' : '';
        console.log(
          `${invoice.number}  ${formatMoney(invoice.amount, invoice.currency, 'en').padStart(12)}  ` +
            `due ${invoice.dueAt.toISOString().slice(0, 10)}  ${tenant?.nameEn ?? invoice.tenantId}${overdue}`,
        );
      }
      break;
    }

    case 'paid': {
      if (!argument) {
        console.error('usage: npm run billing -- paid <invoice-number> [reference]');
        process.exitCode = 1;
        break;
      }
      const invoice = await db.invoice.findUnique({ where: { number: argument } });
      if (!invoice) {
        console.error(`no invoice numbered ${argument}`);
        process.exitCode = 1;
        break;
      }
      const result = await markInvoicePaid(invoice.id, {
        providerRef: process.argv[4] ?? undefined,
        note: 'recorded via operator CLI',
      });
      console.log(
        result.changed
          ? `${argument} marked paid; subscription and workspace restored if they were blocked`
          : `${argument} was already settled — nothing changed`,
      );
      break;
    }

    case 'plans': {
      const plans = await db.plan.findMany({ orderBy: { sortOrder: 'asc' } });
      for (const plan of plans) {
        const cap = (value: number) => (value < 0 ? '∞' : String(value));
        console.log(
          `${plan.code.padEnd(12)} ${formatMoney(plan.priceMonthly, plan.currency, 'en').padStart(12)}/mo  ` +
            `programs ${cap(plan.maxPrograms)}  members ${cap(plan.maxMembers)}  ` +
            `enrolments ${cap(plan.maxEnrollments)}  [${plan.features.join(', ')}]`,
        );
      }
      break;
    }

    default:
      console.log(
        [
          'usage:',
          '  npm run billing:cycle              advance trials, renewals, dunning',
          '  npm run billing -- invoices        list open invoices',
          '  npm run billing -- paid <number>   record a received payment',
          '  npm run billing -- plans           list configured plans',
        ].join('\n'),
      );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
