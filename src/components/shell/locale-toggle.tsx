'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';
import { getDictionary, locales, type Locale } from '@/i18n/dictionary';

export function LocaleToggle({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = getDictionary(locale);
  const next: Locale = locale === 'ar' ? 'en' : 'ar';

  function switchLocale() {
    document.cookie = `programos.locale=${next}; path=/; max-age=31536000; samesite=lax`;
    const rest = locales.reduce(
      (path, item) => (path.startsWith(`/${item}`) ? path.slice(item.length + 1) : path),
      pathname,
    );
    router.replace(`/${next}${rest || ''}`);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      title={t.switchLocale}
      className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[var(--line-strong)] px-3 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:border-navy-400 hover:text-[var(--text-strong)]"
    >
      <Languages size={15} />
      {!compact ? t.switchLocale : null}
    </button>
  );
}
