import { AppShell } from '@/components/shell/app-shell';
import { requireState } from '@/lib/session-state';
import { isLocale, type Locale } from '@/i18n/dictionary';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'ar';
  const state = await requireState(locale);

  return <AppShell state={state}>{children}</AppShell>;
}
