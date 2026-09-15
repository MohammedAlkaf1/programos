import { redirect } from 'next/navigation';
import { OperatorShell } from '@/components/shell/operator-shell';
import { operatorActor } from '@/lib/operator-access';
import { loadOperatorState } from '@/lib/operator-state';
import { DomainError } from '@/lib/domain';
import { getDictionary, isLocale, type Locale } from '@/i18n/dictionary';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getDictionary(isLocale(locale) ? locale : 'ar').operator.title };
}

export default async function OperatorLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'ar';
  let operator: Awaited<ReturnType<typeof operatorActor>>;
  try {
    operator = await operatorActor();
  } catch (error) {
    if (error instanceof DomainError && error.code === 'mfaRequired') redirect(`/${locale}/security`);
    if (error instanceof DomainError && error.status === 401) redirect(`/${locale}/login`);
    // Signed in, not an operator: back to the ordinary application.
    redirect(`/${locale}`);
  }
  const state = await loadOperatorState();
  return (
    <OperatorShell
      operator={{ name: operator.name, email: operator.email }}
      badges={{ invoices: state.totals.pastDueInvoices || undefined, leads: state.totals.newLeads || undefined, errors: state.totals.unresolvedErrors || undefined }}
    >
      {children}
    </OperatorShell>
  );
}
