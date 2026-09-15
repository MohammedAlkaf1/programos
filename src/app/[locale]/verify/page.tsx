import { Suspense } from 'react';
import { VerifyEmail } from '@/components/views/account-forms';
import { getDictionary, isLocale, type Locale } from '@/i18n/dictionary';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getDictionary(isLocale(locale) ? locale : 'ar').auth.verifyTitle };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'ar';
  return (
    <Suspense>
      <VerifyEmail locale={locale} />
    </Suspense>
  );
}
