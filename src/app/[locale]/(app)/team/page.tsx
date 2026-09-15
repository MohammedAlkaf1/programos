import { TeamView } from '@/components/views/team-view';
import { pageState, pageTitle } from '@/lib/guard';
import { AccessDenied } from '@/components/shell/access-denied';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'team');

export default async function TeamPage({ params }: Props) {
  const { locale, state, permitted } = await pageState(params, ['Admin']);
  if (!permitted) return <AccessDenied locale={locale} role={state.actor.role} />;
  return <TeamView state={state} />;
}
