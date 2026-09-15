import { AssistantView } from '@/components/views/assistant-view';
import { pageState, pageTitle } from '@/lib/guard';
import { AccessDenied } from '@/components/shell/access-denied';
import { getAssistantState } from '@/lib/integration-state';
import { loadActor } from '@/lib/session-state';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'assistant');

export default async function AssistantPage({ params }: Props) {
  const { locale, state, permitted } = await pageState(params, ['Admin', 'Manager', 'Impact']);
  if (!permitted) return <AccessDenied locale={locale} role={state.actor.role} />;
  const assistant = await getAssistantState(await loadActor());
  return <AssistantView state={state} data={assistant} />;
}
