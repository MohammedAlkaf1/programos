'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Building2, Bug, DatabaseBackup, Inbox, LayoutDashboard, LogOut, Menu, Receipt, ArrowLeft, ArrowRight, X, type LucideIcon } from 'lucide-react';
import { Avatar, cx } from '@/components/ui';
import { BrandIcon } from './brand-mark';
import { LocaleToggle } from './locale-toggle';
import { ThemeToggle } from './theme-toggle';
import { useApp } from '@/components/app-provider';
import type { Dictionary } from '@/i18n/dictionary';

type Item = { href: string; key: keyof Dictionary['operator']['nav']; icon: LucideIcon };

const ITEMS: Item[] = [
  { href: '', key: 'overview', icon: LayoutDashboard },
  { href: '/tenants', key: 'tenants', icon: Building2 },
  { href: '/invoices', key: 'invoices', icon: Receipt },
  { href: '/leads', key: 'leads', icon: Inbox },
  { href: '/backups', key: 'backups', icon: DatabaseBackup },
  { href: '/errors', key: 'errors', icon: Bug },
];

export function OperatorShell({ operator, badges, children }: { operator: { name: string; email: string }; badges: Partial<Record<Item['key'], number>>; children: ReactNode }) {
  const { locale, t } = useApp();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const base = `/${locale}/operator`;
  const Back = locale === 'ar' ? ArrowLeft : ArrowRight;

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">{t.operator.nav.operatorLabel}</p>
      {ITEMS.map((item) => {
        const href = `${base}${item.href}`;
        const active = item.href === '' ? pathname === base || pathname === `${base}/` : pathname.startsWith(href);
        const Icon = item.icon;
        const badge = badges[item.key];
        return (
          <Link
            key={item.key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150',
              active ? 'bg-navy-800 text-ivory-500' : 'text-navy-300 hover:bg-navy-800/60 hover:text-ivory-500',
            )}
          >
            <span aria-hidden className={cx('absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-copper-500 transition-opacity start-0', active ? 'opacity-100' : 'opacity-0')} />
            <Icon size={17} className={active ? 'text-copper-500' : ''} />
            <span className="flex-1 truncate">{t.operator.nav[item.key]}</span>
            {badge ? <span className="rounded-full bg-copper-600 px-2 py-0.5 text-[11px] font-semibold text-white">{badge}</span> : null}
          </Link>
        );
      })}
      <div className="mt-auto pt-4">
        <Link href={`/${locale}`} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] text-navy-300 hover:bg-navy-800/60 hover:text-ivory-500">
          <Back size={16} />
          {t.operator.nav.backToApp}
        </Link>
      </div>
    </nav>
  );

  const user = (
    <div className="flex items-center gap-3 rounded-[10px] px-2 py-2">
      <Avatar name={operator.name} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ivory-500">{operator.name}</p>
        <p className="truncate text-[11.5px] text-navy-400">{operator.email}</p>
      </div>
      <button type="button" onClick={() => signOut({ callbackUrl: `/${locale}/login` })} title={t.auth.signOut} aria-label={t.auth.signOut} className="rounded-lg p-2 text-navy-400 transition-colors hover:bg-navy-800 hover:text-copper-500">
        <LogOut size={16} />
      </button>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[16.5rem] shrink-0 flex-col bg-navy-900 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/[0.07] px-5">
          <BrandIcon size={34} variant="copper" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ivory-500">{t.brand}</p>
            <p className="truncate text-[11px] text-navy-400">{t.operator.title}</p>
          </div>
        </div>
        {nav}
        <div className="border-t border-white/[0.07] p-3">{user}</div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button type="button" aria-label={t.common.close} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="relative flex h-full w-[16.5rem] flex-col bg-navy-900">
            <div className="flex h-16 items-center justify-between border-b border-white/[0.07] px-4">
              <BrandIcon size={30} variant="copper" />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-navy-300 hover:bg-navy-800" aria-label={t.common.close}>
                <X size={18} />
              </button>
            </div>
            {nav}
            <div className="border-t border-white/[0.07] p-3">{user}</div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[var(--line-soft)] bg-[var(--surface-page)]/85 px-4 backdrop-blur-md sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] lg:hidden" aria-label={t.nav.sections.admin}>
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">{t.operator.title}</p>
            <p className="hidden truncate text-[12px] text-[var(--text-faint)] sm:block">{t.operator.subtitle}</p>
          </div>
          <ThemeToggle />
          <LocaleToggle locale={locale} compact />
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="animate-rise mx-auto w-full max-w-[80rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
