import { ProgramsView } from '@/components/views/programs-view';
import { pageState, pageTitle } from '@/lib/guard';

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, 'programs');

export default async function ProgramsPage({ params }: Props) {
  const { state } = await pageState(params);
  return <ProgramsView state={state} />;
}
