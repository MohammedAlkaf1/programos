'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cx } from '@/components/ui';
import { useApp } from '@/components/app-provider';
import { formatNumber, formatPercent, formatSigned } from '@/lib/format';

/* ───────────────────────────────────────────────────────────────
   Magnitude is always the single copper hue — never a cycled set
   of category colors. Identity is carried by the row label, and
   every bar is direct-labeled, so color is never load-bearing.
   ─────────────────────────────────────────────────────────────── */

export type BarDatum = { key: string; label: string; value: number; note?: string };

export function BarList({
  data,
  total,
  unit = 'count',
  emptyLabel,
  max: explicitMax,
}: {
  data: BarDatum[];
  total?: number;
  unit?: 'count' | 'percent';
  emptyLabel: string;
  max?: number;
}) {
  const { locale } = useApp();
  const [hovered, setHovered] = useState<string | null>(null);

  const max = explicitMax ?? Math.max(1, ...data.map((item) => item.value));
  const sum = total ?? data.reduce((carry, item) => carry + item.value, 0);

  if (!data.length || data.every((item) => item.value === 0)) {
    return <p className="py-8 text-center text-[13px] text-[var(--text-faint)]">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {data.map((item) => {
        const width = (item.value / max) * 100;
        const share = sum ? (item.value / sum) * 100 : 0;
        const active = hovered === item.key;
        return (
          <li
            key={item.key}
            onMouseEnter={() => setHovered(item.key)}
            onMouseLeave={() => setHovered(null)}
            className="group relative"
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[12.5px] text-[var(--text-muted)]">{item.label}</span>
              <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-[var(--text-strong)]">
                {unit === 'percent'
                  ? formatPercent(item.value, locale)
                  : formatNumber(item.value, locale)}
              </span>
            </div>
            {/* 8px track, 4px rounded data-end, anchored to the inline start */}
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: 'var(--mark-track)' }}
            >
              <div
                className="h-full rounded-full transition-[width,opacity] duration-500 ease-out"
                style={{
                  width: `${Math.max(item.value > 0 ? 2 : 0, width)}%`,
                  background: 'var(--mark-magnitude)',
                  opacity: hovered && !active ? 0.45 : 1,
                }}
              />
            </div>
            {active && (item.note || unit === 'count') ? (
              <div className="pointer-events-none absolute -top-1 z-20 -translate-y-full rounded-lg border border-[var(--line-soft)] bg-[var(--surface-card)] px-2.5 py-1.5 text-[11.5px] shadow-[var(--shadow-raised)] start-0">
                <span className="font-medium">{item.label}</span>
                <span className="mx-1.5 text-[var(--text-faint)]">·</span>
                <span className="tabular-nums">
                  {formatNumber(item.value, locale)}
                  {sum ? ` (${formatPercent(share, locale)})` : ''}
                </span>
                {item.note ? (
                  <span className="block text-[var(--text-faint)]">{item.note}</span>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────────────────────────────────────────────────────────
   Diverging change. The green/red pair cannot clear ΔE 8 under
   deuteranopia, so it never travels alone: every row carries an
   arrow glyph and a signed number.
   ─────────────────────────────────────────────────────────────── */

export function ChangeValue({
  value,
  direction,
  unit,
  digits = 1,
}: {
  value: number | null;
  /** 'Higher' means an increase is an improvement. */
  direction: 'Higher' | 'Lower';
  unit?: string;
  digits?: number;
}) {
  const { locale } = useApp();
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-[13px] text-[var(--text-faint)]">—</span>;
  }

  const improved = direction === 'Higher' ? value > 0 : value < 0;
  const flat = value === 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const color = flat ? 'var(--mark-flat)' : improved ? 'var(--mark-up)' : 'var(--mark-down)';

  return (
    <span className="inline-flex items-center gap-1 text-[13.5px] font-semibold tabular-nums" style={{ color }}>
      <Icon size={15} aria-hidden />
      {formatSigned(value, locale, digits)}
      {unit ? <span className="text-[11.5px] font-normal opacity-80">{unit}</span> : null}
    </span>
  );
}

/** Baseline → endline on a shared axis, with both ends direct-labeled. */
export function ChangeBar({
  baseline,
  endline,
  direction,
}: {
  baseline: number;
  endline: number;
  direction: 'Higher' | 'Lower';
}) {
  const span = Math.max(Math.abs(baseline), Math.abs(endline), 1);
  const from = (Math.abs(baseline) / span) * 100;
  const to = (Math.abs(endline) / span) * 100;
  const improved = direction === 'Higher' ? endline > baseline : endline < baseline;

  return (
    <div className="relative h-2 w-full rounded-full" style={{ background: 'var(--mark-track)' }}>
      <div
        className="absolute inset-y-0 rounded-full opacity-45 start-0"
        style={{ width: `${from}%`, background: 'var(--mark-flat)' }}
      />
      <div
        className="absolute inset-y-0 rounded-full transition-[width] duration-500 ease-out start-0"
        style={{
          width: `${to}%`,
          background: improved ? 'var(--mark-up)' : 'var(--mark-down)',
          /* 2px surface ring keeps the overlapping marks separable */
          boxShadow: '0 0 0 2px var(--surface-card)',
        }}
      />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Stat tile — a single headline number is not a chart.
   ─────────────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  sub,
  icon,
  accent = false,
  progress,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
  progress?: number;
}) {
  return (
    <div
      className={cx(
        'surface relative overflow-hidden p-4 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-medium text-[var(--text-muted)]">{label}</p>
        {icon ? (
          <span
            className={cx(
              'flex size-8 shrink-0 items-center justify-center rounded-[9px]',
              accent ? 'bg-copper-100 text-copper-700' : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2.5 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-[12px] text-[var(--text-faint)]">{sub}</p> : null}
      {progress !== undefined ? (
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--mark-track)' }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              background: 'var(--mark-magnitude)',
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Compact funnel: ordered stages, single hue, each step direct-labeled. */
export function Funnel({ stages, emptyLabel }: { stages: BarDatum[]; emptyLabel: string }) {
  const { locale } = useApp();
  const max = Math.max(1, ...stages.map((stage) => stage.value));
  if (stages.every((stage) => stage.value === 0)) {
    return <p className="py-8 text-center text-[13px] text-[var(--text-faint)]">{emptyLabel}</p>;
  }
  return (
    <ol className="space-y-1.5">
      {stages.map((stage) => {
        const width = (stage.value / max) * 100;
        return (
          <li key={stage.key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-[12.5px] text-[var(--text-muted)] sm:w-32">
              {stage.label}
            </span>
            <span className="relative flex h-6 min-w-0 flex-1 items-center">
              {/* One flat hue at full strength: length is the only magnitude
                  encoding. A per-stage opacity ramp would fight it, making a
                  long bar look weaker than a short one. */}
              <span
                className="h-6 rounded-[4px] transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.max(stage.value > 0 ? 1.5 : 0, width)}%`,
                  background: 'var(--mark-magnitude)',
                }}
              />
              <span className="ms-2 text-[12.5px] font-semibold tabular-nums">
                {formatNumber(stage.value, locale)}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
