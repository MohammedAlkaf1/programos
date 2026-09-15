import { PrivacyView } from '@/components/views/privacy-view';
import { pageState, pageTitle } from '@/lib/guard';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'privacy');

export default async function PrivacyPage({ params }: Props) {
  const { state } = await pageState(params);
  return <PrivacyView state={state} />;
}
