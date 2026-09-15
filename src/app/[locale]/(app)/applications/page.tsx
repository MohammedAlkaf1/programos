import { ApplicationsView } from '@/components/views/applications-view';
import { pageState, pageTitle } from '@/lib/guard';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'applications');

export default async function ApplicationsPage({ params }: Props) {
  const { state } = await pageState(params);
  return <ApplicationsView state={state} />;
}
