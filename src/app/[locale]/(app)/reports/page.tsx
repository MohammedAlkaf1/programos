import { ReportsView } from '@/components/views/reports-view';
import { pageState, pageTitle } from '@/lib/guard';
import { AccessDenied } from '@/components/shell/access-denied';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'reports');

export default async function ReportsPage({ params }: Props) {
  const { locale, state, permitted } = await pageState(params, ['Admin', 'Manager', 'Impact', 'Viewer']);
  if (!permitted) return <AccessDenied locale={locale} role={state.actor.role} />;
  return <ReportsView state={state} />;
}
