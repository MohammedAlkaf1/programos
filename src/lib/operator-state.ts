import { readdirSync } from 'node:fs';
import { cache } from 'react';
import { db } from './db';
import { backupDirectory, s3TargetFromEnv } from './backup';
import { invoiceBreakdown } from './plan-math';

/**
 * Everything the operator panel shows, in one read, already serialisable
 * (dates as ISO strings) so it can cross to client components untouched.
 */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function getOperatorState() {
  const [tenants, subscriptions, plans, invoices, backups, errors, leads, operators, memberCounts, programCounts, applicationCounts, userCount, audit] = await Promise.all([
    db.tenant.findMany({ orderBy: { createdAt: 'desc' } }),
    db.subscription.findMany({ include: { plan: true } }),
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    db.invoice.findMany({ orderBy: { issuedAt: 'desc' }, take: 300 }),
    db.backupRun.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    db.errorEvent.findMany({ orderBy: { lastSeenAt: 'desc' }, take: 200 }),
    db.contactLead.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    db.user.findMany({ where: { platformOperator: true }, select: { id: true, name: true, email: true, active: true, mfaEnabled: true } }),
    db.membership.groupBy({ by: ['tenantId'], where: { active: true }, _count: { _all: true } }),
    db.program.groupBy({ by: ['tenantId'], _count: { _all: true } }),
    db.application.groupBy({ by: ['tenantId'], where: { status: { not: 'Draft' } }, _count: { _all: true } }),
    db.user.count({ where: { active: true } }),
    db.audit.findMany({ where: { action: { startsWith: 'platform.' } }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  const count = (rows: { tenantId: string; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.tenantId, r._count._all]));
  const members = count(memberCounts);
  const programs = count(programCounts);
  const applications = count(applicationCounts);
  const subscriptionByTenant = new Map(subscriptions.map((s) => [s.tenantId, s]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const openByTenant = new Map<string, number>();
  for (const inv of invoices) if (inv.status === 'Open') openByTenant.set(inv.tenantId, (openByTenant.get(inv.tenantId) ?? 0) + 1);

  const now = Date.now();
  const mrr = subscriptions.filter((s) => ['Active', 'PastDue'].includes(s.status) && tenantById.get(s.tenantId)?.status === 'Active').reduce((sum, s) => sum + s.plan.priceMonthly, 0);
  const lastBackup = backups.find((b) => b.status === 'Completed') ?? null;
  const localFiles = (() => {
    try {
      return readdirSync(backupDirectory()).filter((f) => f.endsWith('.ndjson.gz')).length;
    } catch {
      return 0;
    }
  })();

  return {
    totals: {
      tenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === 'Active').length,
      trialing: subscriptions.filter((s) => s.status === 'Trialing').length,
      users: userCount,
      programs: [...programs.values()].reduce((a, b) => a + b, 0),
      applications: [...applications.values()].reduce((a, b) => a + b, 0),
      mrr,
      currency: plans[0]?.currency ?? 'SAR',
      openInvoices: invoices.filter((i) => i.status === 'Open').length,
      pastDueInvoices: invoices.filter((i) => i.status === 'Open' && i.dueAt.getTime() < now).length,
      unresolvedErrors: errors.filter((e) => !e.resolvedAt).length,
      errorsLastDay: errors.filter((e) => !e.resolvedAt && now - e.lastSeenAt.getTime() < 86_400_000).length,
      newLeads: leads.filter((l) => l.status === 'New').length,
      lastBackupAt: iso(lastBackup?.finishedAt),
      lastBackupOk: lastBackup ? now - (lastBackup.finishedAt?.getTime() ?? 0) < 36 * 3_600_000 : false,
    },
    tenants: tenants.map((t) => {
      const s = subscriptionByTenant.get(t.id);
      return {
        id: t.id,
        slug: t.slug,
        nameAr: t.nameAr,
        nameEn: t.nameEn,
        status: t.status,
        retentionMonths: t.retentionMonths,
        createdAt: t.createdAt.toISOString(),
        deleteAt: iso(t.deleteAt),
        members: members.get(t.id) ?? 0,
        programs: programs.get(t.id) ?? 0,
        applications: applications.get(t.id) ?? 0,
        openInvoices: openByTenant.get(t.id) ?? 0,
        plan: s ? { code: s.plan.code, nameAr: s.plan.nameAr, nameEn: s.plan.nameEn, priceMonthly: s.plan.priceMonthly, currency: s.plan.currency } : null,
        subscription: s ? { status: s.status, trialEndsAt: iso(s.trialEndsAt), currentPeriodEnd: s.currentPeriodEnd.toISOString(), cancelAtPeriodEnd: s.cancelAtPeriodEnd } : null,
      };
    }),
    plans: plans.map((p) => ({ code: p.code, nameAr: p.nameAr, nameEn: p.nameEn, priceMonthly: p.priceMonthly, currency: p.currency })),
    invoices: invoices.map((i) => {
      const t = tenantById.get(i.tenantId);
      return {
        id: i.id,
        number: i.number,
        tenantId: i.tenantId,
        tenantNameAr: t?.nameAr ?? '',
        tenantNameEn: t?.nameEn ?? '',
        tenantSlug: t?.slug ?? '',
        ...invoiceBreakdown(i),
        currency: i.currency,
        status: i.status,
        issuedAt: i.issuedAt.toISOString(),
        dueAt: i.dueAt.toISOString(),
        paidAt: iso(i.paidAt),
        periodStart: i.periodStart.toISOString(),
        periodEnd: i.periodEnd.toISOString(),
        provider: i.provider,
        providerRef: i.providerRef,
        note: i.note,
        overdue: i.status === 'Open' && i.dueAt.getTime() < now,
      };
    }),
    backups: backups.map((b) => ({
      id: b.id,
      status: b.status,
      trigger: b.trigger,
      requestedBy: b.requestedBy,
      startedAt: iso(b.startedAt),
      finishedAt: iso(b.finishedAt),
      file: b.file,
      bytes: b.bytes,
      tables: b.tables,
      rows: b.rows,
      checksum: b.checksum,
      remote: b.remote,
      error: b.error,
      createdAt: b.createdAt.toISOString(),
    })),
    backupConfig: { directory: backupDirectory(), keep: Number(process.env.BACKUP_KEEP ?? 14), remote: s3TargetFromEnv() ? `${s3TargetFromEnv()!.bucket}` : null, localFiles },
    errors: errors.map((e) => ({
      id: e.id,
      fingerprint: e.fingerprint,
      source: e.source,
      name: e.name,
      message: e.message,
      stack: e.stack,
      path: e.path,
      count: e.count,
      context: e.context as Record<string, unknown>,
      firstSeenAt: e.firstSeenAt.toISOString(),
      lastSeenAt: e.lastSeenAt.toISOString(),
      resolvedAt: iso(e.resolvedAt),
    })),
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      organization: l.organization,
      phone: l.phone,
      topic: l.topic,
      message: l.message,
      locale: l.locale,
      status: l.status,
      handledBy: l.handledBy,
      handledAt: iso(l.handledAt),
      createdAt: l.createdAt.toISOString(),
    })),
    operators,
    audit: audit.map((a) => ({ id: a.id, tenantId: a.tenantId, actorId: a.actorId, action: a.action, entityId: a.entityId, detail: a.detail as Record<string, unknown>, createdAt: a.createdAt.toISOString() })),
  };
}

export type OperatorState = Awaited<ReturnType<typeof getOperatorState>>;

/** Deduplicated per request: the layout and the page share one read. */
export const loadOperatorState = cache(getOperatorState);
