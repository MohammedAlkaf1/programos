'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Building2, MailCheck, Sparkles } from 'lucide-react';
import { Button, Checkbox, Field, Input, cx } from '@/components/ui';
import { PublicShell, Notice, publicCall } from './public-shell';
import { getDictionary, type Locale, type Dictionary } from '@/i18n/dictionary';
import { formatMoney } from '@/lib/plan-math';

type Plan = {
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  priceMonthly: number;
  currency: string;
  maxPrograms: number;
  maxMembers: number;
  maxEnrollments: number;
  features: string[];
};

export function SignupForm({ locale, plans }: { locale: Locale; plans: Plan[] }) {
  const t = getDictionary(locale);
  const [form, setForm] = useState({
    organizationAr: '',
    organizationEn: '',
    fullName: '',
    email: '',
    password: '',
  });
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? '');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const valid =
    form.organizationAr.trim().length >= 2 &&
    form.organizationEn.trim().length >= 2 &&
    form.fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.password.length >= 10 &&
    terms;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = (await publicCall('tenant.signup', { ...form, planCode, acceptTerms: true })) as
        | { activationUrl?: string }
        | null;
      setActivationUrl(result?.activationUrl ?? null);
      setDone(true);
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : 'server';
      setError(t.errors[code as keyof Dictionary['errors']] ?? t.errors.server);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <PublicShell locale={locale} title={t.signup.done}>
        <div className="flex flex-col items-center gap-4 rounded-xl border border-[var(--line-soft)] px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-positive-soft text-positive">
            <MailCheck size={22} />
          </span>
          <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
            {t.signup.doneHint}
          </p>
          {activationUrl ? (
            <div className="w-full rounded-xl border border-dashed border-copper-500/60 bg-copper-100/60 p-4 text-start">
              <p className="text-[12.5px] font-semibold text-copper-700">{t.signup.devLink}</p>
              <a
                href={activationUrl}
                dir="ltr"
                className="mt-1.5 block break-all font-mono text-[12px] text-navy-900 underline underline-offset-2"
              >
                {activationUrl}
              </a>
              <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-faint)]">{t.signup.devLinkHint}</p>
            </div>
          ) : null}
          <Link
            href={`/${locale}/login`}
            className="inline-flex h-10 items-center rounded-[10px] bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800"
          >
            {t.auth.backToLogin}
          </Link>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      locale={locale}
      title={t.signup.title}
      subtitle={t.signup.subtitle}
      wide
      footer={
        <>
          <span className="text-[var(--text-muted)]">{t.auth.haveAccount} </span>
          <Link href={`/${locale}/login`} className="font-medium text-copper-600 hover:underline">
            {t.auth.title}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {error ? <Notice tone="error">{error}</Notice> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.signup.organizationAr} required>
              <Input
                dir="rtl"
                value={form.organizationAr}
                onChange={(e) => set('organizationAr', e.target.value)}
              />
            </Field>
            <Field label={t.signup.organizationEn} required>
              <Input
                dir="ltr"
                value={form.organizationEn}
                onChange={(e) => set('organizationEn', e.target.value)}
              />
            </Field>
          </div>

          <Field label={t.signup.fullName} required>
            <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </Field>

          <Field label={t.auth.email} required>
            <Input
              type="email"
              dir="ltr"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="name@organization.sa"
            />
          </Field>

          <Field label={t.auth.password} required hint={t.auth.passwordHint}>
            <Input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          </Field>

          <Checkbox
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            label={t.signup.terms}
          />

          <Button type="submit" loading={pending} disabled={!valid} icon={<Building2 size={16} />}>
            {t.signup.submit}
          </Button>
        </div>

        {/* Plan picker */}
        <fieldset className="space-y-2">
          <legend className="mb-2 text-[13px] font-medium">{t.signup.plan}</legend>
          {plans.map((plan) => {
            const active = plan.code === planCode;
            const cap = (value: number) => (value < 0 ? t.billing.unlimited : String(value));
            return (
              <label
                key={plan.code}
                className={cx(
                  'block cursor-pointer rounded-xl border p-3.5 transition-all',
                  active
                    ? 'border-copper-600 bg-copper-100/50 shadow-[var(--shadow-subtle)]'
                    : 'border-[var(--line-soft)] hover:border-navy-400',
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold">
                      {locale === 'ar' ? plan.nameAr : plan.nameEn}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--text-muted)]">
                      {locale === 'ar' ? plan.descriptionAr : plan.descriptionEn}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="plan"
                    value={plan.code}
                    checked={active}
                    onChange={() => setPlanCode(plan.code)}
                    className="mt-1 size-4 shrink-0 accent-[var(--color-copper-600)]"
                  />
                </span>
                <span className="mt-2.5 block text-[15px] font-semibold tabular-nums">
                  {formatMoney(plan.priceMonthly, plan.currency, locale)}
                  <span className="ms-1 text-[11.5px] font-normal text-[var(--text-faint)]">
                    / {t.billing.perMonth}
                  </span>
                </span>
                <span className="mt-2 block text-[11.5px] text-[var(--text-faint)]">
                  {t.billing.programsUsed}: {cap(plan.maxPrograms)} · {t.billing.membersUsed}:{' '}
                  {cap(plan.maxMembers)}
                </span>
              </label>
            );
          })}
          <p className="flex items-center gap-1.5 pt-1 text-[11.5px] text-copper-700">
            <Sparkles size={13} />
            {t.signup.trialNote}
          </p>
        </fieldset>
      </form>
    </PublicShell>
  );
}
