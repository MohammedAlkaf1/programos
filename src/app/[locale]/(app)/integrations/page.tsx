import { IntegrationsView } from '@/components/views/integrations-view';
import { pageState, pageTitle } from '@/lib/guard';
import { AccessDenied } from '@/components/shell/access-denied';
import { getIntegrationState } from '@/lib/integration-state';
import { loadActor } from '@/lib/session-state';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'integrations');

export default async function IntegrationsPage({ params }: Props) {
  const { locale, state, permitted } = await pageState(params, ['Admin']);
  if (!permitted) return <AccessDenied locale={locale} role={state.actor.role} />;
  const integrations = await getIntegrationState(await loadActor());
  return <IntegrationsView state={state} data={integrations} />;
}
