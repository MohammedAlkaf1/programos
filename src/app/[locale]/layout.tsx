import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AppProvider } from '@/components/app-provider';
import { dir, getDictionary, isLocale, locales } from '@/i18n/dictionary';
import '../globals.css';

// One family for both languages: it carries Arabic and Latin with matching weights,
// so a mixed line keeps one rhythm instead of two system fonts fighting.
const plex = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plex',
  display: 'swap',
});


export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#141c24' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'ar');
  return {
    title: { default: t.brand, template: `%s · ${t.brand}` },
    description: t.brandTag,
    robots: { index: false, follow: false },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // The theme is resolved on the server from a cookie, so the right palette is
  // in the first byte of HTML — no script, no flash, no hydration mismatch.
  // With no cookie the attribute is omitted and globals.css falls back to the
  // visitor's prefers-color-scheme.
  const stored = (await cookies()).get('programos.theme')?.value;
  const theme = stored === 'dark' || stored === 'light' ? stored : undefined;

  return (
    <html
      lang={locale}
      dir={dir(locale)}
      data-theme={theme}
      className={plex.variable}
    >
      <body>
        <AppProvider locale={locale}>{children}</AppProvider>
      </body>
    </html>
  );
}
