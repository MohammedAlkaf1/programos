import { OperatorBackups } from '@/components/views/operator-views';
import { loadOperatorState } from '@/lib/operator-state';
import { getDictionary, isLocale } from '@/i18n/dictionary';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getDictionary(isLocale(locale) ? locale : 'ar').operator.nav.backups };
}

export default async function Page() {
  const state = await loadOperatorState();
  return <OperatorBackups state={state} />;
}
