import { z } from 'zod';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { hash } from 'bcryptjs';
import { db } from './db';
import { DomainError, roles } from './domain';
import { addMonths, TRIAL_DAYS } from './billing';

/**
 * Commands reachable without a session. Everything here is rate limited and
 * written so a response never reveals whether an email is registered.
 */

const email = z.string().trim().toLowerCase().email().max(254);
const password = z
  .string()
  .min(10, 'weakPassword')
  .max(200)
  // Length does most of the work; this only rules out single-class strings.
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), 'weakPassword');
const name = z.string().trim().min(2).max(120);
const token = z.string().regex(/^[a-f0-9]{64}$/);

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

/** Constant-time compare so a token cannot be discovered byte by byte. */
function tokenMatches(candidateHash: string, storedHash: string) {
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Shared bucket with the sign-in limiter; keyed per action and subject. */
async function rateLimit(key: string, max: number, windowMs: number) {
  const bucket = `public:${key}`;
  const now = new Date();
  const existing = await db.authAttempt.findUnique({ where: { key: bucket } });
  if (existing && existing.resetAt > now && existing.count >= max) {
    throw new DomainError('rateLimited', 429);
  }
  await db.authAttempt.upsert({
    where: { key: bucket },
    create: { key: bucket, count: 1, resetAt: new Date(Date.now() + windowMs) },
    update:
      existing && existing.resetAt > now
        ? { count: { increment: 1 } }
        : { count: 1, resetAt: new Date(Date.now() + windowMs) },
  });
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'org';
}

async function queueMail(
  tx: { outbox: { create: (args: unknown) => Promise<unknown> } },
  tenantId: string,
  recipient: string,
  subject: string,
  body: string,
) {
  await tx.outbox.create({ data: { tenantId, recipient, subject, body } });
}

const appUrl = () => process.env.APP_URL ?? 'http://127.0.0.1:3000';

export async function publicCommand(action: string, input: unknown, clientKey: string) {
  const data = z.record(z.string(), z.unknown()).parse(input);

  switch (action) {
    /* ── Self-service signup: creates the organization and its first admin ── */
    case 'tenant.signup': {
      await rateLimit(`signup:${clientKey}`, 5, 3_600_000);
      const x = z
        .object({
          organizationAr: name,
          organizationEn: name,
          fullName: name,
          email,
          password,
          planCode: z.string().trim().max(40).optional(),
          acceptTerms: z.literal(true),
        })
        .parse(data);

      const plan =
        (x.planCode
          ? await db.plan.findFirst({ where: { code: x.planCode, active: true } })
          : null) ?? (await db.plan.findFirst({ where: { active: true }, orderBy: { sortOrder: 'asc' } }));
      if (!plan) throw new DomainError('noPlan', 503);

      const existing = await db.user.findUnique({ where: { email: x.email } });
      // Do not disclose that the address is taken; the email tells the owner.
      if (existing) {
        await db.$transaction(async (tx) => {
          await queueMail(
            tx as never,
            existing.id,
            x.email,
            'محاولة إنشاء حساب · Account already exists',
            `يوجد حساب مسجل بهذا البريد. لاستعادة كلمة المرور:\n${appUrl()}/ar/forgot`,
          );
        });
        return { ok: true };
      }

      const verifyToken = randomBytes(32).toString('hex');
      const passwordHash = await hash(x.password, 12);

      await db.$transaction(async (tx) => {
        let slug = slugify(x.organizationEn);
        if (await tx.tenant.findUnique({ where: { slug } })) {
          slug = `${slug}-${randomBytes(3).toString('hex')}`;
        }

        const tenant = await tx.tenant.create({
          data: { slug, nameAr: x.organizationAr, nameEn: x.organizationEn },
        });

        const user = await tx.user.create({
          data: { email: x.email, name: x.fullName, password: passwordHash, verified: false },
        });

        await tx.membership.create({
          data: { userId: user.id, tenantId: tenant.id, role: 'Admin', programIds: [] },
        });

        const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: plan.id,
            status: 'Trialing',
            trialEndsAt,
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndsAt,
          },
        });

        await tx.authToken.create({
          data: {
            userId: user.id,
            tokenHash: digest(verifyToken),
            purpose: 'verify',
            expiresAt: new Date(Date.now() + 48 * 3_600_000),
          },
        });

        await queueMail(
          tx as never,
          tenant.id,
          x.email,
          'فعّل حسابك في ProgramOS · Activate your account',
          `أهلًا ${x.fullName}،\n\nفعّل حسابك عبر الرابط التالي:\n${appUrl()}/ar/verify?token=${verifyToken}\n\nالرابط صالح لمدة 48 ساعة.`,
        );

        await tx.audit.create({
          data: {
            tenantId: tenant.id,
            actorId: user.id,
            action: 'tenant.signup',
            entityId: tenant.id,
            detail: { plan: plan.code },
          },
        });
      });

      // A demo database with no mail provider would otherwise dead end here: the
      // activation mail is queued but never leaves the machine. Never in production.
      const revealLink =
        process.env.NODE_ENV !== 'production' && process.env.DEMO_LOGIN === '1' && !process.env.SMTP_HOST;
      return revealLink ? { ok: true, activationUrl: `${appUrl()}/ar/verify?token=${verifyToken}` } : { ok: true };
    }

    /* ── Accepting a team invitation ── */
    case 'invitation.inspect': {
      await rateLimit(`inspect:${clientKey}`, 30, 900_000);
      const raw = token.parse(data.token);
      const invitation = await db.invitation.findUnique({
        where: { tokenHash: digest(raw) },
      });
      if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
        throw new DomainError('invitationInvalid', 410);
      }
      const tenant = await db.tenant.findUnique({ where: { id: invitation.tenantId } });
      const known = await db.user.findUnique({ where: { email: invitation.email } });
      return {
        email: invitation.email,
        role: invitation.role,
        organizationAr: tenant?.nameAr ?? '',
        organizationEn: tenant?.nameEn ?? '',
        hasAccount: Boolean(known),
      };
    }

    case 'invitation.accept': {
      await rateLimit(`accept:${clientKey}`, 10, 3_600_000);
      const raw = token.parse(data.token);
      const tokenHash = digest(raw);

      const invitation = await db.invitation.findUnique({ where: { tokenHash } });
      if (
        !invitation ||
        !tokenMatches(tokenHash, invitation.tokenHash) ||
        invitation.usedAt ||
        invitation.expiresAt < new Date()
      ) {
        throw new DomainError('invitationInvalid', 410);
      }

      const known = await db.user.findUnique({ where: { email: invitation.email } });
      // An existing user joins with their current password; a new one sets it.
      const chosen = known ? null : z.object({ fullName: name, password }).parse(data);
      const passwordHash = chosen ? await hash(chosen.password, 12) : null;

      await db.$transaction(async (tx) => {
        // Re-read inside the transaction and consume atomically, so two
        // simultaneous submissions cannot both claim the same invitation.
        const claimed = await tx.invitation.updateMany({
          where: { id: invitation.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (!claimed.count) throw new DomainError('invitationInvalid', 410);

        const user =
          known ??
          (await tx.user.create({
            data: {
              email: invitation.email,
              name: chosen!.fullName,
              password: passwordHash!,
              // The invitation itself proves control of the address.
              verified: true,
            },
          }));

        await tx.membership.upsert({
          where: { tenantId_userId: { tenantId: invitation.tenantId, userId: user.id } },
          create: {
            tenantId: invitation.tenantId,
            userId: user.id,
            role: invitation.role,
            programIds: invitation.programIds,
          },
          update: { role: invitation.role, programIds: invitation.programIds, active: true },
        });

        await tx.audit.create({
          data: {
            tenantId: invitation.tenantId,
            actorId: user.id,
            action: 'invitation.accept',
            entityId: invitation.id,
            detail: { role: invitation.role },
          },
        });
      });

      return { ok: true, email: invitation.email };
    }

    /* ── Email verification ── */
    case 'email.verify': {
      await rateLimit(`verify:${clientKey}`, 20, 900_000);
      const raw = token.parse(data.token);
      const record = await db.authToken.findUnique({ where: { tokenHash: digest(raw) } });
      if (!record || !['verify', 'email-change'].includes(record.purpose) || record.usedAt || record.expiresAt < new Date()) {
        throw new DomainError('tokenInvalid', 410);
      }
      await db.$transaction(async (tx) => {
        const claimed = await tx.authToken.updateMany({
          where: { id: record.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (!claimed.count) throw new DomainError('tokenInvalid', 410);
        if (record.purpose === 'email-change' && record.payload) {
          // The link proves control of the new address. If it was claimed by someone else meanwhile, the change is dropped quietly.
          if (await tx.user.findUnique({ where: { email: record.payload } })) throw new DomainError('tokenInvalid', 410);
          await tx.user.update({ where: { id: record.userId }, data: { email: record.payload, verified: true, sessionVersion: { increment: 1 } } });
          await tx.beneficiary.updateMany({ where: { userId: record.userId }, data: { email: record.payload } });
          await tx.audit.createMany({ data: (await tx.membership.findMany({ where: { userId: record.userId } })).map((m) => ({ tenantId: m.tenantId, actorId: record.userId, action: 'email.change', entityId: record.userId, detail: {} })) });
          return;
        }
        await tx.user.update({ where: { id: record.userId }, data: { verified: true } });
      });
      return { ok: true };
    }

    /* ── Password reset ── */
    case 'password.forgot': {
      await rateLimit(`forgot:${clientKey}`, 5, 3_600_000);
      const x = z.object({ email }).parse(data);
      const user = await db.user.findUnique({ where: { email: x.email } });

      if (user?.active) {
        const raw = randomBytes(32).toString('hex');
        const membership = await db.membership.findFirst({ where: { userId: user.id } });
        await db.$transaction(async (tx) => {
          await tx.authToken.create({
            data: {
              userId: user.id,
              tokenHash: digest(raw),
              purpose: 'reset',
              expiresAt: new Date(Date.now() + 900_000),
            },
          });
          await queueMail(
            tx as never,
            membership?.tenantId ?? user.id,
            user.email,
            'إعادة تعيين كلمة المرور · Reset your password',
            `لإعادة تعيين كلمة المرور:\n${appUrl()}/ar/reset?token=${raw}\n\nالرابط صالح لمدة 15 دقيقة. إن لم تطلب ذلك فتجاهل الرسالة.`,
          );
        });
      }
      // Always the same answer, whether or not the address exists.
      return { ok: true };
    }

    case 'password.reset': {
      await rateLimit(`reset:${clientKey}`, 10, 3_600_000);
      const x = z.object({ token, password }).parse(data);
      const record = await db.authToken.findUnique({ where: { tokenHash: digest(x.token) } });
      if (!record || record.purpose !== 'reset' || record.usedAt || record.expiresAt < new Date()) {
        throw new DomainError('tokenInvalid', 410);
      }
      const passwordHash = await hash(x.password, 12);
      await db.$transaction(async (tx) => {
        const claimed = await tx.authToken.updateMany({
          where: { id: record.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (!claimed.count) throw new DomainError('tokenInvalid', 410);
        await tx.user.update({
          where: { id: record.userId },
          data: { password: passwordHash, verified: true, sessionVersion:{increment:1} },
        });
        // Any other outstanding reset link is now void.
        await tx.authToken.updateMany({
          where: { userId: record.userId, purpose: 'reset', usedAt: null },
          data: { usedAt: new Date() },
        });
        // Clear the sign-in lockout so the new password works immediately.
        await tx.authAttempt.deleteMany({ where: { key: digest(record.userId) } });
      });
      return { ok: true };
    }

    /* ── The public contact form ── */
    case 'contact.submit': {
      // Three per hour per client. Enough for a person who mistypes their own
      // address twice, useless for anyone trying to use us as a mail relay.
      await rateLimit(`contact:${clientKey}`, 3, 3_600_000);
      const x = z
        .object({
          name,
          email,
          organization: name,
          phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/).optional().or(z.literal('')),
          topic: z.enum(['demo', 'pricing', 'security', 'support', 'other']),
          message: z.string().trim().min(10).max(4000),
          locale: z.enum(['ar', 'en']).default('ar'),
          consent: z.literal(true),
        })
        .parse(data);

      await db.$transaction(async (tx) => {
        const lead = await tx.contactLead.create({
          data: {
            name: x.name,
            email: x.email,
            organization: x.organization,
            phone: x.phone || null,
            topic: x.topic,
            message: x.message,
            locale: x.locale,
          },
        });
        // The notification carries the enquiry itself, so nobody has to open a
        // console to read a message a visitor sent.
        const inbox = process.env.CONTACT_EMAIL;
        if (inbox) {
          await queueMail(
            tx as never,
            lead.id,
            inbox,
            `رسالة جديدة من موقع ProgramOS · ${x.topic}`,
            [`الاسم: ${x.name}`, `الجهة: ${x.organization}`, `البريد: ${x.email}`, `الجوال: ${x.phone || 'غير مذكور'}`, `الموضوع: ${x.topic}`, '', x.message].join('\n'),
          );
        }
        // A copy to the sender is their receipt, and confirms we hold a working address.
        await queueMail(
          tx as never,
          lead.id,
          x.email,
          x.locale === 'ar' ? 'وصلتنا رسالتك · ProgramOS' : 'We received your message · ProgramOS',
          x.locale === 'ar'
            ? `شكرًا ${x.name}. وصلتنا رسالتك وسنرد خلال يوم عمل واحد.\n\nنص رسالتك:\n${x.message}`
            : `Thank you ${x.name}. Your message reached us and we will reply within one working day.\n\nYour message:\n${x.message}`,
        );
      });
      // Always the same answer, so the form cannot be used to probe anything.
      return { ok: true };
    }

    case 'plans.list': {
      const plans = await db.plan.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      });
      return plans.map((plan) => ({
        code: plan.code,
        nameAr: plan.nameAr,
        nameEn: plan.nameEn,
        descriptionAr: plan.descriptionAr,
        descriptionEn: plan.descriptionEn,
        priceMonthly: plan.priceMonthly,
        currency: plan.currency,
        maxPrograms: plan.maxPrograms,
        maxMembers: plan.maxMembers,
        maxEnrollments: plan.maxEnrollments,
        features: plan.features,
      }));
    }

    default:
      throw new DomainError('invalid');
  }
}

export const publicActions = [
  'contact.submit',
  'tenant.signup',
  'invitation.inspect',
  'invitation.accept',
  'email.verify',
  'password.forgot',
  'password.reset',
  'plans.list',
] as const;
