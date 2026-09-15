import { BillingView } from '@/components/views/billing-view';
import { AccessDenied } from '@/components/shell/access-denied';
import { pageState, pageTitle } from '@/lib/guard';
import { billingStateFor } from '@/lib/billing';
import { db } from '@/lib/db';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'billing');

export default async function BillingPage({ params }: Props) {
  const { locale, state, permitted } = await pageState(params, ['Admin']);
  if (!permitted) return <AccessDenied locale={locale} role={state.actor.role} />;

  const [billing, plans, invoices] = await Promise.all([
    billingStateFor(state.actor.tenantId),
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    db.invoice.findMany({
      where: { tenantId: state.actor.tenantId },
      orderBy: { issuedAt: 'desc' },
      take: 50,
    }),
  ]);

  return (
    <BillingView
      billing={billing}
      suspended={state.actor.tenantStatus !== 'Active'}
      plans={plans.map((plan) => ({
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
      }))}
      invoices={invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        dueAt: invoice.dueAt.toISOString(),
        paidAt: invoice.paidAt?.toISOString() ?? null,
        periodStart: invoice.periodStart.toISOString(),
        periodEnd: invoice.periodEnd.toISOString(),
      }))}
    />
  );
}
