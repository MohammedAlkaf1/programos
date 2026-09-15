'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Check,
  Landmark,
  AlertTriangle,
  Ban,
  RotateCcw,
  Receipt,
  FileDown,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Progress,
  SectionHeader,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
  Fraction,
  cx,
} from '@/components/ui';
import { useApp } from '@/components/app-provider';
import { formatDate, formatNumber } from '@/lib/format';
import { formatMoney, remaining, type BillingState } from '@/lib/plan-math';

export type PlanOption = {
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

export type InvoiceRow = {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  dueAt: string;
  paidAt: string | null;
  periodStart: string;
  periodEnd: string;
};

export function BillingView({
  billing,
  plans,
  invoices,
  suspended,
}: {
  billing: BillingState | null;
  plans: PlanOption[];
  invoices: InvoiceRow[];
  suspended: boolean;
}) {
  const { locale, t, run, busy } = useApp();
  const [choosing, setChoosing] = useState(false);
  const search = useSearchParams();
  const router = useRouter();
  const [paymentOutcome, setPaymentOutcome] = useState<string | null>(null);
  // Back from the payment gateway: look the payment up at the source and settle it,
  // so the subscription is active even before the webhook arrives.
  useEffect(() => {
    const id = search.get('payment');
    if (!id) return;
    let cancelled = false;
    (async () => {
      const result = (await run('billing.confirmPayment', { id })) as { status?: string } | null;
      if (cancelled) return;
      setPaymentOutcome(result?.status ?? 'pending');
      router.replace(`/${locale}/billing`);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [instructions, setInstructions] = useState<{ reference: string; invoice: InvoiceRow } | null>(
    null,
  );

  if (!billing) {
    return (
      <>
        <PageHeader title={t.billing.title} subtitle={t.billing.subtitle} />
        <Card>
          <EmptyState
            title={t.common.empty}
            hint={t.common.emptyHint}
            icon={<CreditCard size={19} />}
          />
        </Card>
      </>
    );
  }

  const planName = locale === 'ar' ? billing.planNameAr : billing.planNameEn;
  const trialing = billing.status === 'Trialing';

  const meters = [
    {
      key: 'programs',
      label: t.billing.programsUsed,
      used: billing.usage.programs,
      limit: billing.limits.maxPrograms,
    },
    {
      key: 'members',
      label: t.billing.membersUsed,
      used: billing.usage.members,
      limit: billing.limits.maxMembers,
    },
    {
      key: 'enrollments',
      label: t.billing.enrollmentsUsed,
      used: billing.usage.enrollments,
      limit: billing.limits.maxEnrollments,
    },
  ];

  return (
    <>
      {paymentOutcome ? (
        <div
          role="status"
          className={cx(
            'mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-[13.5px]',
            paymentOutcome === 'paid'
              ? 'border-positive/30 bg-positive-soft text-positive'
              : paymentOutcome === 'failed' || paymentOutcome === 'mismatch'
                ? 'border-critical/30 bg-critical-soft text-critical'
                : 'border-caution/30 bg-caution-soft text-caution',
          )}
        >
          {paymentOutcome === 'paid' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <span>
            {paymentOutcome === 'paid'
              ? t.billing.paymentConfirmed
              : paymentOutcome === 'failed'
                ? t.billing.paymentFailed
                : paymentOutcome === 'mismatch'
                  ? t.errors.paymentMismatch
                  : t.billing.paymentPending}
          </span>
        </div>
      ) : null}
      <PageHeader
        title={t.billing.title}
        subtitle={t.billing.subtitle}
        action={
          <Button icon={<CreditCard size={16} />} onClick={() => setChoosing(true)}>
            {t.billing.changePlan}
          </Button>
        }
      />

      {suspended ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-critical-soft px-4 py-3.5 text-[13px] text-critical">
          <AlertTriangle size={17} className="mt-px shrink-0" />
          <span>
            <strong className="block font-semibold">{t.billing.suspendedTitle}</strong>
            <span className="mt-0.5 block leading-relaxed">{t.billing.suspendedBody}</span>
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        {/* Current plan */}
        <Card>
          <SectionHeader
            title={t.billing.currentPlan}
            action={
              <StatusBadge
                status={billing.status}
                label={t.statuses[billing.status as keyof typeof t.statuses] ?? billing.status}
              />
            }
          />
          <p className="mt-4 text-2xl font-semibold tracking-tight">{planName}</p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-copper-700">
            {formatMoney(billing.priceMonthly, billing.currency, locale)}
            <span className="ms-1 text-[12px] font-normal text-[var(--text-faint)]">
              / {t.billing.perMonth}
            </span>
          </p>

          <dl className="mt-5 space-y-2 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">
                {trialing ? t.billing.trialEndsIn : t.billing.renewsOn}
              </dt>
              <dd className="font-medium tabular-nums">
                {trialing
                  ? `${formatNumber(Math.max(0, billing.daysLeft ?? 0), locale)} ${t.billing.days}`
                  : formatDate(billing.currentPeriodEnd, locale)}
              </dd>
            </div>
            {billing.limits.features.length ? (
              <div className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-[var(--text-muted)]">{t.billing.features}</dt>
                <dd className="flex flex-wrap justify-end gap-1.5">
                  {billing.limits.features.map((feature) => (
                    <Badge key={feature} tone="accent">
                      {t.billing.featureLabels[feature as keyof typeof t.billing.featureLabels] ?? feature}
                    </Badge>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>

          {billing.cancelAtPeriodEnd ? (
            <div className="mt-5 rounded-[10px] bg-caution-soft px-3.5 py-3 text-[12.5px] text-caution">
              {t.billing.willCancel}
            </div>
          ) : null}

          <div className="mt-5">
            <Button
              variant="ghost"
              size="sm"
              loading={busy}
              icon={billing.cancelAtPeriodEnd ? <RotateCcw size={14} /> : <Ban size={14} />}
              onClick={() =>
                run('billing.cancel', {
                  cancel: !billing.cancelAtPeriodEnd,
                  version: billing.version,
                })
              }
            >
              {billing.cancelAtPeriodEnd ? t.billing.resumeRenewal : t.billing.cancelAtEnd}
            </Button>
          </div>
        </Card>

        {/* Usage meters */}
        <Card>
          <SectionHeader title={t.billing.usage} />
          <ul className="mt-5 space-y-5">
            {meters.map((meter) => {
              const uncapped = meter.limit < 0;
              const percent = uncapped ? 0 : Math.min(100, (meter.used / meter.limit) * 100);
              const left = remaining(meter.used, meter.limit);
              const tone = percent >= 100 ? 'caution' : percent >= 80 ? 'accent' : 'navy';
              return (
                <li key={meter.key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-[var(--text-muted)]">{meter.label}</span>
                    <span className="text-[13px] font-semibold">
                      {uncapped ? (
                        <>
                          {formatNumber(meter.used, locale)}{' '}
                          <span className="font-normal text-[var(--text-faint)]">
                            / {t.billing.unlimited}
                          </span>
                        </>
                      ) : (
                        <Fraction
                          used={formatNumber(meter.used, locale)}
                          total={formatNumber(meter.limit, locale)}
                        />
                      )}
                    </span>
                  </div>
                  {uncapped ? (
                    <div className="h-1.5 w-full rounded-full bg-[var(--surface-sunken)]" />
                  ) : (
                    <Progress value={percent} tone={tone} label={meter.label} />
                  )}
                  {left !== null ? (
                    <p
                      className={cx(
                        'mt-1 text-[11.5px]',
                        left === 0 ? 'text-caution' : 'text-[var(--text-faint)]',
                      )}
                    >
                      {formatNumber(left, locale)} {t.billing.remaining}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Invoices */}
      <Card className="mt-4" padded={false}>
        <div className="px-5 pt-5">
          <SectionHeader title={t.billing.invoices} />
        </div>
        {invoices.length === 0 ? (
          <EmptyState
            title={t.billing.noInvoices}
            hint={t.common.emptyHint}
            icon={<Receipt size={19} />}
          />
        ) : (
          <Table className="mt-3">
            <thead>
              <tr>
                <Th>{t.billing.invoiceNumber}</Th>
                <Th>{t.program.period}</Th>
                <Th>{t.billing.amount}</Th>
                <Th>{t.common.status}</Th>
                <Th>{t.billing.dueAt}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const overdue =
                  invoice.status === 'Open' && new Date(invoice.dueAt) < new Date();
                return (
                  <Tr key={invoice.id}>
                    <Td>
                      <span dir="ltr" className="font-mono text-[12.5px]">
                        {invoice.number}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-[var(--text-muted)]">
                      {formatDate(invoice.periodStart, locale)} –{' '}
                      {formatDate(invoice.periodEnd, locale)}
                    </Td>
                    <Td className="whitespace-nowrap font-medium tabular-nums">
                      {formatMoney(invoice.amount, invoice.currency, locale)}
                      <span className="block text-[11px] text-[var(--text-faint)]">{t.billing.vatIncluded}</span>
                    </Td>
                    <Td>
                      <StatusBadge
                        status={invoice.status}
                        label={
                          t.statuses[invoice.status as keyof typeof t.statuses] ?? invoice.status
                        }
                      />
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className={cx('text-[12.5px] tabular-nums', overdue && 'text-critical')}>
                        {formatDate(invoice.dueAt, locale)}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex justify-end">
                        <a
                          href={`/api/invoices/${invoice.id}/pdf?locale=${locale}`}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--line-strong)] px-3 text-[13px] font-medium text-[var(--text-strong)] hover:bg-[var(--surface-sunken)]"
                        >
                          <FileDown size={14} />
                          {t.billing.pdf}
                        </a>
                        {invoice.status === 'Open' ? (
                          <Button
                            size="sm"
                            variant={overdue ? 'secondary' : 'ghost'}
                            loading={busy}
                            icon={<Landmark size={14} />}
                            onClick={async () => {
                              const result = (await run('billing.checkout', { id: invoice.id })) as
                                | { kind: string; reference?: string; url?: string }
                                | null;
                              if (!result) return;
                              if (result.kind === 'redirect' && result.url) {
                                window.location.href = result.url;
                              } else if (result.reference) {
                                setInstructions({ reference: result.reference, invoice });
                              }
                            }}
                          >
                            {t.billing.payNow}
                          </Button>
                        ) : invoice.paidAt ? (
                          <span className="text-[12px] text-[var(--text-faint)]">
                            {formatDate(invoice.paidAt, locale)}
                          </span>
                        ) : null}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {choosing ? (
        <Modal
          open
          onClose={() => setChoosing(false)}
          title={t.billing.choosePlan}
          size="xl"
          footer={
            <Button variant="ghost" onClick={() => setChoosing(false)}>
              {t.common.close}
            </Button>
          }
        >
          <div className="grid gap-3 md:grid-cols-3">
            {plans.map((plan) => {
              const current = plan.code === billing.planCode;
              const cap = (value: number) =>
                value < 0 ? t.billing.unlimited : formatNumber(value, locale);
              return (
                <div
                  key={plan.code}
                  className={cx(
                    'flex flex-col rounded-xl border p-4',
                    current ? 'border-copper-600 bg-copper-100/40' : 'border-[var(--line-soft)]',
                  )}
                >
                  <h3 className="text-[14.5px] font-semibold">
                    {locale === 'ar' ? plan.nameAr : plan.nameEn}
                  </h3>
                  <p className="mt-1 text-[12px] leading-snug text-[var(--text-muted)]">
                    {locale === 'ar' ? plan.descriptionAr : plan.descriptionEn}
                  </p>
                  <p className="mt-3 text-xl font-semibold tabular-nums">
                    {formatMoney(plan.priceMonthly, plan.currency, locale)}
                    <span className="ms-1 text-[11.5px] font-normal text-[var(--text-faint)]">
                      / {t.billing.perMonth}
                    </span>
                  </p>
                  <ul className="mt-3 flex-1 space-y-1.5 text-[12px] text-[var(--text-muted)]">
                    <li>
                      {t.billing.programsUsed}: {cap(plan.maxPrograms)}
                    </li>
                    <li>
                      {t.billing.membersUsed}: {cap(plan.maxMembers)}
                    </li>
                    <li>
                      {t.billing.enrollmentsUsed}: {cap(plan.maxEnrollments)}
                    </li>
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-1.5 text-positive">
                        <Check size={13} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    {current ? (
                      <Badge tone="accent">{t.billing.current}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        loading={busy}
                        onClick={async () => {
                          const result = await run('billing.changePlan', {
                            planCode: plan.code,
                            version: billing.version,
                          });
                          if (result) setChoosing(false);
                        }}
                      >
                        {t.billing.select}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      ) : null}

      {instructions ? (
        <Modal
          open
          onClose={() => setInstructions(null)}
          title={t.billing.transferTitle}
          description={instructions.invoice.number}
          footer={
            <Button variant="ghost" onClick={() => setInstructions(null)}>
              {t.common.close}
            </Button>
          }
        >
          <div className="space-y-4">
            <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
              {t.billing.transferBody}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[10px] bg-[var(--surface-sunken)] px-4 py-3">
                <p className="text-[11.5px] text-[var(--text-faint)]">{t.billing.amount}</p>
                <p className="mt-0.5 text-[16px] font-semibold tabular-nums">
                  {formatMoney(
                    instructions.invoice.amount,
                    instructions.invoice.currency,
                    locale,
                  )}
                </p>
              </div>
              <div className="rounded-[10px] bg-[var(--surface-sunken)] px-4 py-3">
                <p className="text-[11.5px] text-[var(--text-faint)]">{t.billing.reference}</p>
                <p dir="ltr" className="mt-0.5 font-mono text-[16px] font-semibold">
                  {instructions.reference}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
