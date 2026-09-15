import { db } from './db';
import { addMonths, invoiceAmounts, DUE_DAYS, GRACE_DAYS } from './plan-math';
import { nextInvoiceNumber } from './billing';

/**
 * The billing clock. Every transition here is idempotent and driven by stored
 * dates, so running the cycle twice in one day changes nothing the second
 * time, and a missed day is caught up on the next run.
 *
 * Run it from `npm run billing:cycle` (cron, once a day is enough).
 */

export type CycleReport = {
  trialsEnded: number;
  invoicesIssued: number;
  markedPastDue: number;
  suspended: number;
  restored: number;
  cancelled: number;
};

export async function runBillingCycle(now = new Date()): Promise<CycleReport> {
  const report: CycleReport = {
    trialsEnded: 0,
    invoicesIssued: 0,
    markedPastDue: 0,
    suspended: 0,
    restored: 0,
    cancelled: 0,
  };

  /* 1. Trials that have run out become live subscriptions and get their
        first invoice — or lapse quietly if the plan is free. */
  const expiredTrials = await db.subscription.findMany({
    where: { status: 'Trialing', trialEndsAt: { lte: now } },
    include: { plan: true },
  });

  for (const subscription of expiredTrials) {
    await db.$transaction(async (tx) => {
      const periodStart = now;
      const periodEnd = addMonths(now, 1);

      if (subscription.cancelAtPeriodEnd) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: 'Cancelled', version: { increment: 1 } },
        });
        report.cancelled += 1;
        return;
      }

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: subscription.plan.priceMonthly > 0 ? 'PastDue' : 'Active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          version: { increment: 1 },
        },
      });

      if (subscription.plan.priceMonthly > 0) {
        const number = await nextInvoiceNumber(tx as never);
        await tx.invoice.create({
          data: {
            tenantId: subscription.tenantId,
            subscriptionId: subscription.id,
            number,
            ...invoiceAmounts(subscription.plan.priceMonthly),
            currency: subscription.plan.currency,
            periodStart,
            periodEnd,
            dueAt: new Date(now.getTime() + DUE_DAYS * 86_400_000),
            provider: subscription.provider,
          },
        });
        report.invoicesIssued += 1;
      }
      report.trialsEnded += 1;
    });
  }

  /* 2. Active subscriptions reaching the end of a paid period renew. */
  const renewals = await db.subscription.findMany({
    where: { status: 'Active', currentPeriodEnd: { lte: now } },
    include: { plan: true },
  });

  for (const subscription of renewals) {
    await db.$transaction(async (tx) => {
      if (subscription.cancelAtPeriodEnd) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: 'Cancelled', version: { increment: 1 } },
        });
        report.cancelled += 1;
        return;
      }

      const periodStart = subscription.currentPeriodEnd;
      const periodEnd = addMonths(periodStart, 1);

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          status: subscription.plan.priceMonthly > 0 ? 'PastDue' : 'Active',
          version: { increment: 1 },
        },
      });

      if (subscription.plan.priceMonthly > 0) {
        const number = await nextInvoiceNumber(tx as never);
        await tx.invoice.create({
          data: {
            tenantId: subscription.tenantId,
            subscriptionId: subscription.id,
            number,
            ...invoiceAmounts(subscription.plan.priceMonthly),
            currency: subscription.plan.currency,
            periodStart,
            periodEnd,
            dueAt: new Date(periodStart.getTime() + DUE_DAYS * 86_400_000),
            provider: subscription.provider,
          },
        });
        report.invoicesIssued += 1;
        report.markedPastDue += 1;
      }
    });
  }

  /* 3. Dunning: an invoice unpaid past its due date plus the grace window
        suspends the workspace. Data is never deleted — the tenant is locked
        out of writes by the existing tenantStatus gate and can pay to return. */
  const overdue = await db.invoice.findMany({
    where: {
      status: 'Open',
      dueAt: { lte: new Date(now.getTime() - GRACE_DAYS * 86_400_000) },
    },
  });

  for (const invoice of overdue) {
    const tenant = await db.tenant.findUnique({ where: { id: invoice.tenantId } });
    if (!tenant || tenant.status === 'Suspended') continue;
    await db.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id: invoice.tenantId }, data: { status: 'Suspended' } });
      await tx.outbox.create({
        data: {
          tenantId: invoice.tenantId,
          recipient: await primaryAdminEmail(invoice.tenantId),
          subject: 'تم تعليق مساحة العمل · Workspace suspended',
          body: `لم تُسدَّد الفاتورة ${invoice.number} خلال المهلة، وتم تعليق مساحة العمل مؤقتًا.\nبياناتكم محفوظة كاملة وتُستعاد فور السداد.\n${process.env.APP_URL ?? ''}/ar/billing`,
        },
      });
      await tx.audit.create({
        data: {
          tenantId: invoice.tenantId,
          actorId: 'system',
          action: 'billing.suspend',
          entityId: invoice.id,
          detail: { invoice: invoice.number },
        },
      });
    });
    report.suspended += 1;
  }

  /* 4. A tenant with nothing outstanding comes back automatically. */
  const suspended = await db.tenant.findMany({ where: { status: 'Suspended' } });
  for (const tenant of suspended) {
    const stillOwing = await db.invoice.count({
      where: { tenantId: tenant.id, status: 'Open', dueAt: { lte: now } },
    });
    if (stillOwing) continue;
    await db.tenant.update({ where: { id: tenant.id }, data: { status: 'Active' } });
    report.restored += 1;
  }

  return report;
}

/** Records a payment and returns the subscription to good standing. */
export async function markInvoicePaid(
  invoiceId: string,
  options: { provider?: string; providerRef?: string; note?: string; actorId?: string } = {},
) {
  return db.$transaction(async (tx) => {
    // updateMany with a status guard makes a double-confirmation a no-op.
    const claimed = await tx.invoice.updateMany({
      where: { id: invoiceId, status: 'Open' },
      data: {
        status: 'Paid',
        paidAt: new Date(),
        providerRef: options.providerRef ?? null,
        note: options.note ?? null,
      },
    });
    if (!claimed.count) return { changed: false };

    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

    const outstanding = await tx.invoice.count({
      where: { tenantId: invoice.tenantId, status: 'Open', dueAt: { lte: new Date() } },
    });

    if (!outstanding) {
      await tx.subscription.updateMany({
        where: { id: invoice.subscriptionId, status: 'PastDue' },
        data: { status: 'Active', version: { increment: 1 } },
      });
      await tx.tenant.updateMany({
        where: { id: invoice.tenantId, status: 'Suspended' },
        data: { status: 'Active' },
      });
    }

    await tx.audit.create({
      data: {
        tenantId: invoice.tenantId,
        actorId: options.actorId ?? 'system',
        action: 'billing.paid',
        entityId: invoice.id,
        detail: { number: invoice.number, amount: invoice.amount, ref: options.providerRef ?? '' },
      },
    });

    await tx.outbox.create({
      data: {
        tenantId: invoice.tenantId,
        recipient: await primaryAdminEmail(invoice.tenantId),
        subject: `سداد الفاتورة ${invoice.number} · Payment received`,
        body: `تم استلام سداد الفاتورة ${invoice.number}.\nشكرًا لكم.`,
      },
    });

    return { changed: true, invoice };
  });
}

async function primaryAdminEmail(tenantId: string) {
  const membership = await db.membership.findFirst({
    where: { tenantId, role: 'Admin', active: true },
    include: { user: true },
  });
  return membership?.user.email ?? 'billing@invalid.local';
}
