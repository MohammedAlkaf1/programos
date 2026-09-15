'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getDictionary, type Locale } from '@/i18n/dictionary';
import { LocaleToggle } from '@/components/shell/locale-toggle';

/** The framing shared by every signed-out page: signup, invite, verify, reset. */
export function PublicShell({
  locale,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  locale: Locale;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const t = getDictionary(locale);
  return (
    <main className="flex min-h-dvh flex-col px-6 py-8 sm:px-10">
      <div className="flex items-center justify-between gap-4">
        <Link href={`/${locale}/login`} className="flex items-center gap-3">
          <span
            aria-hidden
            className="relative flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-copper-600"
          >
            <span className="absolute inset-[5px] rounded-[5px] border-[1.5px] border-white/85" />
            <span className="absolute size-1.5 rounded-full bg-white" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold tracking-tight">{t.brand}</span>
            <span className="block truncate text-[11.5px] text-[var(--text-faint)]">
              {t.brandTag}
            </span>
          </span>
        </Link>
        <LocaleToggle locale={locale} />
      </div>

      <div
        className={`animate-rise mx-auto flex w-full flex-1 flex-col justify-center py-10 ${
          wide ? 'max-w-4xl' : 'max-w-[28rem]'
        }`}
      >
        <h1 className="text-[1.75rem] font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
        <div className="mt-8">{children}</div>
        {footer ? <div className="mt-8 text-center text-[13px]">{footer}</div> : null}
      </div>

      <p className="text-center text-[12px] text-[var(--text-faint)]">
        © {new Date().getFullYear()} {t.brand}
      </p>
    </main>
  );
}

export function Notice({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const style =
    tone === 'error'
      ? 'bg-critical-soft text-critical'
      : tone === 'success'
        ? 'bg-positive-soft text-positive'
        : 'bg-info-soft text-info';
  return (
    <div role="alert" className={`animate-fade flex items-start gap-2.5 rounded-[10px] px-3.5 py-3 text-[13px] ${style}`}>
      {tone === 'success' ? (
        <CheckCircle2 size={16} className="mt-px shrink-0" />
      ) : (
        <AlertTriangle size={16} className="mt-px shrink-0" />
      )}
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

/** Shared caller for /api/public; returns the result or throws the error code. */
export async function publicCall(action: string, data: Record<string, unknown> = {}) {
  const response = await fetch('/api/public', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: unknown;
    error?: string;
  };
  if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'server');
  return payload.result;
}
