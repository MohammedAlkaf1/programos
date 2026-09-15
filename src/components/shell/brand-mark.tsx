import { getDictionary, type Locale } from '@/i18n/dictionary';

/**
 * The ProgramOS mark: the Arabic letter ب (the first letter of برنامج) drawn
 * as a rail that rises to the left, with the traveller resting at its end and
 * the letter's dot below. The same geometry lives in public/brand/*.svg and
 * src/app/icon.svg; change all three together.
 */
const RAIL = 'M50 24C50 35 45 42 32 42C21 42 14.5 37 14.5 30C14.5 25 16 21 18 18';

export function BrandIcon({
  size = 36,
  variant = 'navy',
  className,
}: {
  size?: number;
  /** navy: copper rail on a navy tile. copper: ivory rail on a copper tile. mono: current text colour, no tile. */
  variant?: 'navy' | 'copper' | 'mono';
  className?: string;
}) {
  const palette =
    variant === 'navy'
      ? { tile: '#283543', rail: '#C16325', traveller: '#EEEBDF', dot: '#C16325' }
      : variant === 'copper'
        ? { tile: '#C16325', rail: '#EEEBDF', traveller: '#283543', dot: '#EEEBDF' }
        : { tile: null, rail: 'currentColor', traveller: 'currentColor', dot: 'currentColor' };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      focusable="false"
      className={className}
    >
      {palette.tile ? <rect width="64" height="64" rx="16" fill={palette.tile} /> : null}
      <path d={RAIL} fill="none" stroke={palette.rail} strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="18" cy="18" r="4.6" fill={palette.traveller} />
      <circle cx="32" cy="52.5" r="3.6" fill={palette.dot} />
    </svg>
  );
}

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
      <BrandIcon size={36} variant={tone === 'light' ? 'copper' : 'navy'} className="shrink-0 rounded-[10px]" />
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
