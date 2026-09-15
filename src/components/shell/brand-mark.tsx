import { getDictionary, type Locale } from '@/i18n/dictionary';

export function BrandMark({
  locale,
  tone = 'dark',
  compact = false,
}: {
  locale: Locale;
  tone?: 'light' | 'dark';
  compact?: boolean;
}) {
  const t = getDictionary(locale);
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="relative flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-copper-600"
      >
        <span className="absolute inset-[5px] rounded-[5px] border-[1.5px] border-white/85" />
        <span className="absolute size-1.5 rounded-full bg-white" />
      </span>
      {!compact ? (
        <span className="min-w-0">
          <span
            className={`block truncate text-[15px] font-semibold tracking-tight ${
              tone === 'light' ? 'text-ivory-500' : 'text-[var(--text-strong)]'
            }`}
          >
            {t.brand}
          </span>
          <span
            className={`block truncate text-[11.5px] ${
              tone === 'light' ? 'text-navy-300' : 'text-[var(--text-faint)]'
            }`}
          >
            {t.brandTag}
          </span>
        </span>
      ) : null}
    </div>
  );
}
