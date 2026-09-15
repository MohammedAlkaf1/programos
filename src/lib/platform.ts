import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { DomainError } from './domain';

/**
 * Tenant lifecycle as the platform operator sees it. Shared by the command
 * line console (scripts/operator.ts) and the operator panel, so both paths
 * write the same rows and the same audit entries.
 *
 * The operator is never a member of the tenant: these actions are recorded
 * with the operator's user id (or "operator" from the console) as the actor.
 */

export const PLATFORM = 'platform';

export type PlatformActor = { userId: string; correlationId?: string };

const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;

async function audit(tenantId: string, actor: PlatformActor, action: string, entityId: string, detail: object = {}) {
  await db.audit.create({ data: { tenantId, actorId: actor.userId, action, entityId, detail, correlationId: actor.correlationId ?? '' } });
}

export async function tenantById(id: string) {
  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) throw new DomainError('notFound', 404);
  return tenant;
}

export async function createTenant(actor: PlatformActor, input: { slug: string; nameAr: string; nameEn: string; adminEmail: string; adminName?: string }) {
  if (!SLUG.test(input.slug)) throw new DomainError('invalid', 422);
  if (await db.tenant.findUnique({ where: { slug: input.slug } })) throw new DomainError('duplicate', 409);
  const token = randomBytes(32).toString('hex');
  const email = input.adminEmail.toLowerCase();
  return db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { slug: input.slug, nameAr: input.nameAr, nameEn: input.nameEn } });
    // The first admin joins through an invitation like everyone else, so the platform never sets a password on their behalf.
    await tx.invitation.create({ data: { tenantId: tenant.id, email, role: 'Admin', tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
    await tx.outbox.create({
      data: {
        tenantId: tenant.id,
        recipient: email,
        subject: 'دعوة لإدارة مساحة العمل · Workspace admin invitation',
        body: `${process.env.APP_URL ?? 'http://127.0.0.1:3000'}/ar/register?invitation=${token}\n\nالرابط صالح لمدة 7 أيام.`,
      },
    });
    await tx.audit.create({ data: { tenantId: tenant.id, actorId: actor.userId, action: 'platform.tenant.create', entityId: tenant.id, detail: { slug: input.slug, admin: email, adminName: input.adminName ?? '' }, correlationId: actor.correlationId ?? '' } });
    return { tenant, invitationEmail: email };
  });
}

export async function setTenantStatus(actor: PlatformActor, id: string, status: 'Active' | 'Suspended', reason: string) {
  const tenant = await tenantById(id);
  if (tenant.status === 'Closed') throw new DomainError('conflict', 409);
  await db.tenant.update({ where: { id }, data: { status, deleteAt: null } });
  await audit(id, actor, status === 'Suspended' ? 'platform.tenant.suspend' : 'platform.tenant.resume', id, { reason, from: tenant.status });
  return { id, status };
}

export async function closeTenant(actor: PlatformActor, id: string, days: number, reason: string) {
  const tenant = await tenantById(id);
  if (tenant.status === 'Closed') throw new DomainError('conflict', 409);
  const deleteAt = new Date(Date.now() + Math.max(1, Math.min(365, days)) * 86_400_000);
  await db.tenant.update({ where: { id }, data: { status: 'Closing', deleteAt } });
  await audit(id, actor, 'platform.tenant.close', id, { reason, deleteAt, from: tenant.status });
  return { id, status: 'Closing', deleteAt };
}

/** Only a Closing tenant whose grace period has ended can be purged. The audit trail and tombstones stay. */
export async function purgeTenant(actor: PlatformActor, id: string) {
  const tenant = await tenantById(id);
  if (tenant.status !== 'Closing' || !tenant.deleteAt || tenant.deleteAt > new Date()) throw new DomainError('conflict', 409);
  await db.$transaction(async (tx) => {
    const where = { tenantId: id };
    await tx.measurement.deleteMany({ where });
    await tx.attendance.deleteMany({ where });
    await tx.enrollment.deleteMany({ where });
    await tx.evaluation.deleteMany({ where });
    await tx.applicationRevision.deleteMany({ where });
    await tx.operationalNote.deleteMany({ where });
    await tx.consentRecord.deleteMany({ where });
    await tx.application.deleteMany({ where });
    await tx.attachment.deleteMany({ where });
    await tx.indicator.deleteMany({ where });
    await tx.activity.deleteMany({ where });
    await tx.program.deleteMany({ where });
    await tx.initiative.deleteMany({ where });
    await tx.beneficiary.deleteMany({ where });
    await tx.notification.deleteMany({ where });
    await tx.outbox.deleteMany({ where });
    await tx.exportJob.deleteMany({ where });
    await tx.privacyRequest.deleteMany({ where });
    await tx.reportSnapshot.deleteMany({ where });
    await tx.deletionCandidate.deleteMany({ where });
    await tx.invitation.deleteMany({ where });
    await tx.membership.deleteMany({ where });
    await tx.tenant.update({ where: { id }, data: { status: 'Closed', nameAr: 'جهة محذوفة', nameEn: 'Deleted organization' } });
    await tx.audit.create({ data: { tenantId: id, actorId: actor.userId, action: 'platform.tenant.purge', entityId: id, detail: { slug: tenant.slug }, correlationId: actor.correlationId ?? '' } });
  });
  return { id, status: 'Closed' };
}

export async function setTenantPlan(actor: PlatformActor, id: string, planCode: string) {
  await tenantById(id);
  const plan = await db.plan.findFirst({ where: { code: planCode, active: true } });
  if (!plan) throw new DomainError('notFound', 404);
  const subscription = await db.subscription.findUnique({ where: { tenantId: id }, include: { plan: true } });
  if (!subscription) throw new DomainError('notFound', 404);
  if (subscription.planId === plan.id) return { id, plan: plan.code };
  await db.subscription.update({ where: { id: subscription.id }, data: { planId: plan.id, version: { increment: 1 } } });
  await audit(id, actor, 'platform.tenant.changePlan', subscription.id, { from: subscription.plan.code, to: plan.code });
  return { id, plan: plan.code };
}

export async function grantOperator(actor: PlatformActor, email: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new DomainError('notFound', 404);
  await db.user.update({ where: { id: user.id }, data: { platformOperator: true } });
  await audit(PLATFORM, actor, 'platform.operator.grant', user.id, { email: user.email });
  return { userId: user.id };
}

export async function revokeOperator(actor: PlatformActor, userId: string) {
  if (userId === actor.userId) throw new DomainError('conflict', 409);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new DomainError('notFound', 404);
  await db.user.update({ where: { id: userId }, data: { platformOperator: false } });
  await audit(PLATFORM, actor, 'platform.operator.revoke', userId, { email: user.email });
  return { userId };
}
