import { ImpactView } from '@/components/views/impact-view';
import { pageState, pageTitle } from '@/lib/guard';
import { AccessDenied } from '@/components/shell/access-denied';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'impact');

export default async function ImpactPage({ params }: Props) {
  const { locale, state, permitted } = await pageState(params, ['Admin', 'Manager', 'Coordinator', 'Impact', 'Viewer']);
  if (!permitted) return <AccessDenied locale={locale} role={state.actor.role} />;
  return <ImpactView state={state} />;
}
