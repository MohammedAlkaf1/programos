'use client';

// Defined outside this module so a server component can call it too.
import { cx } from '@/lib/cx';
export { cx };

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Inbox, Search } from 'lucide-react';



/* ─────────────────────────── Button ─────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
};

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium whitespace-nowrap transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985]';

const buttonVariants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-navy-900 text-white shadow-[var(--shadow-subtle)] hover:bg-navy-800 focus-visible:outline-navy-900',
  secondary:
    'bg-copper-600 text-white shadow-[var(--shadow-subtle)] hover:bg-copper-700 focus-visible:outline-copper-600',
  ghost:
    'border border-[var(--line-strong)] bg-[var(--surface-card)] text-[var(--text-strong)] hover:border-navy-400 hover:bg-[var(--surface-sunken)]',
  subtle: 'text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]',
  danger: 'bg-critical text-white hover:brightness-110',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        buttonBase,
        buttonVariants[variant],
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ─────────────────────────── Surfaces ─────────────────────────── */

export function Card({
  className,
  children,
  padded = true,
}: {
  className?: string;
  children: ReactNode;
  padded?: boolean;
}) {
  // `min-w-0` matters: a card is usually a grid or flex item, and without it the
  // item sizes to its widest content. A table inside would then stretch the page
  // instead of scrolling inside its own container on a narrow screen.
  return <div className={cx('surface min-w-0', padded && 'p-5', className)}>{children}</div>;
}

export function SectionHeader({
  title,
  hint,
  action,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {hint ? <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}

/* ─────────────────────────── Badges ─────────────────────────── */

export type Tone = 'neutral' | 'info' | 'positive' | 'caution' | 'critical' | 'accent';

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-sunken)] text-[var(--text-muted)] ring-[var(--line-soft)]',
  info: 'bg-info-soft text-info ring-info/20',
  positive: 'bg-positive-soft text-positive ring-positive/20',
  caution: 'bg-caution-soft text-caution ring-caution/25',
  critical: 'bg-critical-soft text-critical ring-critical/20',
  accent: 'bg-copper-100 text-copper-700 ring-copper-600/20',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium leading-none ring-1 ring-inset',
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTones: Record<string, Tone> = {
  Draft: 'neutral',
  Published: 'info',
  RegistrationOpen: 'positive',
  RegistrationClosed: 'caution',
  Active: 'accent',
  Completed: 'positive',
  Cancelled: 'critical',
  Archived: 'neutral',
  Submitted: 'info',
  UnderReview: 'accent',
  NeedsInfo: 'caution',
  Waitlisted: 'caution',
  Accepted: 'positive',
  Rejected: 'critical',
  Withdrawn: 'neutral',
  Expired: 'neutral',
  Enrolled: 'info',
  InProgress: 'accent',
  Suspended: 'caution',
  Present: 'positive',
  Absent: 'critical',
  Excused: 'caution',
  NotRecorded: 'neutral',
  Verified: 'positive',
  Returned: 'critical',
  New: 'info',
  IdentityVerified: 'accent',
  Scheduled: 'info',
};

export function statusTone(status: string): Tone {
  return statusTones[status] ?? 'neutral';
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge tone={statusTone(status)}>
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-current opacity-70"
      />
      {label}
    </Badge>
  );
}

/* ─────────────────────────── Form fields ─────────────────────────── */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      {label ? (
        <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-medium text-[var(--text-strong)]">
          {label}
          {required ? <span className="text-copper-600">*</span> : null}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="mt-1 block text-[12px] text-critical">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12px] text-[var(--text-faint)]">{hint}</span>
      ) : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx('field-input', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cx('field-input resize-y', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cx('field-input', className)} {...rest}>
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-[var(--text-faint)] end-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  },
);

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-2.5 text-[13px]', className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-[var(--line-strong)] accent-[var(--color-copper-600)]"
        {...rest}
      />
      <span className="leading-snug">{label}</span>
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cx('relative', className)}>
      <Search
        size={15}
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--text-faint)] start-3"
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field-input ps-9"
        type="search"
      />
    </div>
  );
}

/* ─────────────────────────── Modal ─────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Prefer a real field; falling back to the close button would greet the
    // reader with a focus ring on "dismiss".
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>('input,select,textarea');
    (firstField ?? panel)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div
        className="animate-fade absolute inset-0 bg-navy-950/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className={cx(
          // outline-none: the panel is focused for screen readers, but a ring
          // around the whole dialog is noise, not an affordance.
          'animate-pop relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl shadow-[var(--shadow-overlay)] outline-none sm:rounded-2xl',
          size === 'md' ? 'sm:max-w-lg' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-4xl',
        )}
        style={{ background: 'var(--surface-card)' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line-soft)] px-5 py-4">
          <div className="min-w-0">
            <h2 id={headingId} className="text-[15px] font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-me-1 shrink-0 rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]"
            aria-label="close"
          >
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line-soft)] px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ─────────────────────────── Table ─────────────────────────── */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0 max-w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cx(
        'border-b border-[var(--line-soft)] px-4 py-2.5 text-start text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cx('border-b border-[var(--line-soft)] px-4 py-3 align-middle', className)}>
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        'transition-colors last:[&>td]:border-b-0',
        onClick && 'cursor-pointer hover:bg-[var(--surface-sunken)]',
        className,
      )}
    >
      {children}
    </tr>
  );
}

/* ─────────────────────────── States ─────────────────────────── */

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-faint)]">
        {icon ?? <Inbox size={19} />}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {hint ? <p className="mt-1 text-[13px] text-[var(--text-muted)]">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Progress({
  value,
  tone = 'accent',
  className,
  label,
}: {
  value: number;
  tone?: 'accent' | 'navy' | 'positive' | 'caution';
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const bar = {
    accent: 'bg-copper-600',
    navy: 'bg-navy-700',
    positive: 'bg-positive',
    caution: 'bg-caution',
  }[tone];
  return (
    <div
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-500 ease-out', bar)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/**
 * A "used / total" pair. Always laid out left-to-right: in an RTL paragraph a
 * bare `3 / 1` renders with the numbers swapped around the slash, so readers
 * cannot tell which side is the limit.
 */
export function Fraction({
  used,
  total,
  className,
}: {
  used: ReactNode;
  total: ReactNode;
  className?: string;
}) {
  return (
    <span dir="ltr" className={cx('inline-block tabular-nums', className)}>
      {used}
      <span className="mx-0.5 text-[var(--text-faint)]">/</span>
      {total}
    </span>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-navy-100 font-semibold text-navy-700"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {letters || '؟'}
    </span>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: ReactNode; count?: number }>;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto rounded-[10px] bg-[var(--surface-sunken)] p-1"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(item.value)}
            className={cx(
              'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all',
              active
                ? 'bg-[var(--surface-card)] text-[var(--text-strong)] shadow-[var(--shadow-subtle)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cx(
                  'rounded-full px-1.5 py-px text-[11px] tabular-nums',
                  active ? 'bg-copper-100 text-copper-700' : 'bg-[var(--line-soft)]',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function DataList({ items }: { items: Array<{ label: ReactNode; value: ReactNode }> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <dt className="text-[12px] text-[var(--text-faint)]">{item.label}</dt>
          <dd className="mt-0.5 text-[13.5px] font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
