import { DashboardView } from '@/components/views/dashboard-view';
import { requireState } from '@/lib/session-state';
import { getDictionary, isLocale, type Locale } from '@/i18n/dictionary';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getDictionary(isLocale(locale) ? locale : 'ar').nav.overview };
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'ar';
  const state = await requireState(locale);
  return <DashboardView state={state} />;
}
