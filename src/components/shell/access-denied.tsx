import Link from 'next/link';
import { Lock } from 'lucide-react';
import { getDictionary, type Locale } from '@/i18n/dictionary';
import type { Role } from '@/lib/domain';

export function AccessDenied({ locale, role }: { locale: Locale; role: Role }) {
  const t = getDictionary(locale);
  return (
    <div className="surface flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-faint)]">
        <Lock size={21} />
      </span>
      <div>
        <p className="text-[15px] font-semibold">{t.common.noAccess}</p>
        <p className="mt-1.5 text-[13px] text-[var(--text-muted)]">
          {t.common.role}: {t.roles[role]}
        </p>
      </div>
      <Link
        href={`/${locale}`}
        className="inline-flex h-10 items-center rounded-[10px] bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800"
      >
        {t.nav.overview}
      </Link>
    </div>
  );
}
