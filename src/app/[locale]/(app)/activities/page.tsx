import { ActivitiesView } from '@/components/views/activities-view';
import { pageState, pageTitle } from '@/lib/guard';
import { AccessDenied } from '@/components/shell/access-denied';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'activities');

export default async function ActivitiesPage({ params }: Props) {
  const { locale, state, permitted } = await pageState(params, ['Admin', 'Manager', 'Coordinator']);
  if (!permitted) return <AccessDenied locale={locale} role={state.actor.role} />;
  return <ActivitiesView state={state} />;
}
