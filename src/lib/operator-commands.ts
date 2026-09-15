import { z } from 'zod';
import { db } from './db';
import { DomainError } from './domain';
import { markInvoicePaid } from './billing-jobs';
import { closeTenant, createTenant, grantOperator, purgeTenant, revokeOperator, setTenantPlan, setTenantStatus, PLATFORM } from './platform';
import type { OperatorActor } from './operator-access';

/**
 * The operator panel's writes. Every action is prefixed `platform.` so the
 * client provider routes it to /api/operator instead of the tenant API, and
 * every one leaves an audit row.
 */
const id = z.string().uuid();
const reason = z.string().trim().min(3).max(1000);
const text = z.string().trim().min(1).max(200);

export async function operatorCommand(a: OperatorActor, action: string, input: unknown) {
  const data = z.record(z.string(), z.unknown()).parse(input ?? {});
  const actor = { userId: a.userId, correlationId: a.correlationId };
  const log = (tenantId: string, entityId: string, detail: object = {}) =>
    db.audit.create({ data: { tenantId, actorId: a.userId, action, entityId, detail, correlationId: a.correlationId } });

  switch (action) {
    case 'platform.tenant.create': {
      const x = z.object({ slug: z.string().trim().toLowerCase(), nameAr: text, nameEn: text, adminEmail: z.string().trim().email(), adminName: z.string().trim().max(120).optional() }).parse(data);
      const r = await createTenant(actor, x);
      return { id: r.tenant.id, invitationEmail: r.invitationEmail };
    }
    case 'platform.tenant.suspend':
      return setTenantStatus(actor, id.parse(data.id), 'Suspended', reason.parse(data.reason));
    case 'platform.tenant.resume':
      return setTenantStatus(actor, id.parse(data.id), 'Active', reason.parse(data.reason));
    case 'platform.tenant.close':
      return closeTenant(actor, id.parse(data.id), z.coerce.number().int().min(1).max(365).parse(data.days ?? 30), reason.parse(data.reason));
    case 'platform.tenant.purge':
      return purgeTenant(actor, id.parse(data.id));
    case 'platform.tenant.changePlan':
      return setTenantPlan(actor, id.parse(data.id), z.string().trim().max(40).parse(data.planCode));

    case 'platform.invoice.markPaid': {
      const x = z.object({ id, reference: z.string().trim().max(120).optional(), note: z.string().trim().max(500).optional() }).parse(data);
      const invoice = await db.invoice.findUnique({ where: { id: x.id } });
      if (!invoice) throw new DomainError('notFound', 404);
      if (invoice.status !== 'Open') throw new DomainError('conflict', 409);
      const r = await markInvoicePaid(x.id, { provider: 'manual', providerRef: x.reference, note: x.note, actorId: a.userId });
      await log(invoice.tenantId, x.id, { reference: x.reference ?? '', changed: r.changed });
      return r;
    }

    case 'platform.backup.request': {
      // A run that has been "Running" for two hours died with its worker; do not let it block new requests.
      await db.backupRun.updateMany({ where: { status: 'Running', startedAt: { lt: new Date(Date.now() - 2 * 3_600_000) } }, data: { status: 'Failed', finishedAt: new Date(), error: 'worker stopped before finishing' } });
      const pending = await db.backupRun.findFirst({ where: { status: { in: ['Requested', 'Running'] } } });
      if (pending) return { id: pending.id, status: pending.status };
      const run = await db.backupRun.create({ data: { status: 'Requested', trigger: 'panel', requestedBy: a.email } });
      await log(PLATFORM, run.id);
      return { id: run.id, status: run.status };
    }

    case 'platform.error.resolve': {
      const x = z.object({ id }).parse(data);
      await db.errorEvent.update({ where: { id: x.id }, data: { resolvedAt: new Date() } });
      await log(PLATFORM, x.id);
      return { id: x.id };
    }
    case 'platform.error.resolveAll': {
      const x = z.object({ source: z.enum(['server', 'api', 'worker', 'client']).optional() }).parse(data);
      const r = await db.errorEvent.updateMany({ where: { resolvedAt: null, ...(x.source ? { source: x.source } : {}) }, data: { resolvedAt: new Date() } });
      await log(PLATFORM, x.source ?? 'all', { count: r.count });
      return { count: r.count };
    }

    case 'platform.lead.update': {
      const x = z.object({ id, status: z.enum(['New', 'Contacted', 'Closed']) }).parse(data);
      const lead = await db.contactLead.findUnique({ where: { id: x.id } });
      if (!lead) throw new DomainError('notFound', 404);
      await db.contactLead.update({ where: { id: x.id }, data: { status: x.status, handledBy: x.status === 'New' ? null : a.email, handledAt: x.status === 'New' ? null : new Date() } });
      await log(PLATFORM, x.id, { from: lead.status, to: x.status });
      return { id: x.id, status: x.status };
    }

    case 'platform.operator.grant':
      return grantOperator(actor, z.string().trim().email().parse(data.email));
    case 'platform.operator.revoke':
      return revokeOperator(actor, id.parse(data.userId));

    default:
      throw new DomainError('notFound', 404);
  }
}
