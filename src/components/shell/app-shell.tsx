'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { Avatar, Badge, Button, cx } from '@/components/ui';
import { LocaleToggle } from './locale-toggle';
import { ThemeToggle } from './theme-toggle';
import { navSections, visibleNav } from './nav';
import { useApp } from '@/components/app-provider';
import type { AppState } from '@/lib/types';

export function AppShell({ state, children }: { state: AppState; children: ReactNode }) {
  const { locale, t } = useApp();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const items = visibleNav(state.actor.role);
  const base = `/${locale}`;
  const unread = state.notifications.filter((item) => !item.read).length;

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {navSections.map((section) => {
        const sectionItems = items.filter((item) => item.section === section);
        if (!sectionItems.length) return null;
        return (
          <div key={section}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">
              {t.nav.sections[section]}
            </p>
            <ul className="space-y-0.5">
              {sectionItems.map((item) => {
                const href = `${base}${item.href}`;
                const active =
                  item.href === ''
                    ? pathname === base || pathname === `${base}/`
                    : pathname === href || pathname.startsWith(`${href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150',
                        active
                          ? 'bg-navy-800 text-ivory-500'
                          : 'text-navy-300 hover:bg-navy-800/60 hover:text-ivory-500',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cx(
                          'absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-copper-500 transition-opacity start-0',
                          active ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <Icon size={17} className={active ? 'text-copper-500' : ''} />
                      <span className="truncate">{t.nav[item.key] as string}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {state.actor.platformOperator ? (
        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">{t.operator.nav.operatorLabel}</p>
          <Link
            href={`${base}/operator`}
            className="group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium text-copper-500 transition-all duration-150 hover:bg-navy-800/60"
          >
            <ShieldCheck size={17} />
            <span className="truncate">{t.operator.title}</span>
          </Link>
        </div>
      ) : null}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[16.5rem] shrink-0 flex-col bg-navy-900 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/[0.07] px-5">
          <span
            aria-hidden
            className="relative flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-copper-600"
          >
            <span className="absolute inset-[4px] rounded-[5px] border-[1.5px] border-white/85" />
            <span className="absolute size-1 rounded-full bg-white" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-ivory-500">{t.brand}</span>
            <span className="block truncate text-[11px] text-navy-400">{t.brandTag}</span>
          </span>
        </div>
        {nav}
        <div className="border-t border-white/[0.07] p-3">
          <UserCard state={state} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-fade absolute inset-0 bg-navy-950/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="animate-fade absolute inset-y-0 flex w-[17rem] flex-col bg-navy-900 start-0">
            <div className="flex h-16 items-center justify-between px-5">
              <span className="text-[14px] font-semibold text-ivory-500">{t.brand}</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-navy-300 hover:text-white"
                aria-label={t.common.close}
              >
                <X size={18} />
              </button>
            </div>
            {nav}
            <div className="border-t border-white/[0.07] p-3">
              <UserCard state={state} />
            </div>
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-[var(--line-soft)] bg-[var(--surface-card)]/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ms-1 rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] lg:hidden"
            aria-label="menu"
          >
            <Menu size={19} />
          </button>

          <TenantSwitcher state={state} />

          <div className="ms-auto flex items-center gap-1.5">
            <NotificationsMenu state={state} unread={unread} />
            <ThemeToggle />
            <LocaleToggle locale={locale} compact />
          </div>
        </header>

        {state.actor.tenantStatus !== 'Active' ? (
          <div className="flex items-center gap-2.5 bg-caution-soft px-4 py-2.5 text-[13px] text-caution sm:px-6">
            <AlertTriangle size={15} />
            {t.tenant.suspended}
          </div>
        ) : null}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="animate-rise mx-auto w-full max-w-[80rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function UserCard({ state }: { state: AppState }) {
  const { locale, t } = useApp();
  return (
    <div className="flex items-center gap-3 rounded-[10px] px-2 py-2">
      <Avatar name={state.actor.name} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ivory-500">{state.actor.name}</p>
        <p className="truncate text-[11.5px] text-navy-400">{t.roles[state.actor.role]}</p>
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
        title={t.auth.signOut}
        className="rounded-lg p-2 text-navy-400 transition-colors hover:bg-navy-800 hover:text-copper-500"
        aria-label={t.auth.signOut}
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}

function TenantSwitcher({ state }: { state: AppState }) {
  const { locale, t } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false));

  const current = state.memberships.find((item) => item.tenantId === state.actor.tenantId);
  const label = current
    ? locale === 'ar'
      ? current.tenant.nameAr
      : current.tenant.nameEn
    : t.tenant.current;

  async function pick(tenantId: string) {
    if (tenantId === state.actor.tenantId) return setOpen(false);
    setPending(true);
    await fetch('/api/tenant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    });
    setPending(false);
    setOpen(false);
    router.replace(`/${locale}`);
    router.refresh();
  }

  if (state.memberships.length <= 1) {
    return (
      <div className="flex min-w-0 items-center gap-2.5 ps-1">
        <Building2 size={16} className="shrink-0 text-copper-600" />
        <span className="truncate text-[14px] font-medium">{label}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={pending}
        aria-expanded={open}
        className="flex min-w-0 items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[14px] font-medium transition-colors hover:bg-[var(--surface-sunken)]"
      >
        <Building2 size={16} className="shrink-0 text-copper-600" />
        <span className="truncate">{label}</span>
        <ChevronDown size={15} className="shrink-0 text-[var(--text-faint)]" />
      </button>
      {open ? (
        <div className="animate-pop absolute top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)] p-1 shadow-[var(--shadow-raised)] start-0">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            {t.tenant.switch}
          </p>
          {state.memberships.map((membership) => {
            const active = membership.tenantId === state.actor.tenantId;
            return (
              <button
                key={membership.id}
                type="button"
                onClick={() => pick(membership.tenantId)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-[13px] transition-colors hover:bg-[var(--surface-sunken)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {locale === 'ar' ? membership.tenant.nameAr : membership.tenant.nameEn}
                  </span>
                  <span className="block truncate text-[11.5px] text-[var(--text-faint)]">
                    {t.roles[membership.role]}
                  </span>
                </span>
                {active ? <Check size={15} className="shrink-0 text-copper-600" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function NotificationsMenu({ state, unread }: { state: AppState; unread: number }) {
  const { locale, t, run } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t.notification.title}
        className="relative rounded-[10px] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]"
      >
        <Bell size={17} />
        {unread ? (
          <span className="absolute top-1 flex size-4 items-center justify-center rounded-full bg-copper-600 text-[10px] font-semibold text-white end-1">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="animate-pop absolute top-full z-50 mt-1.5 w-[20rem] overflow-hidden rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)] shadow-[var(--shadow-raised)] end-0">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line-soft)] px-3.5 py-2.5">
            <p className="text-[13px] font-semibold">{t.notification.title}</p>
            {unread ? (
              <Button variant="subtle" size="sm" onClick={() => run('notification.read')}>
                {t.notification.markAll}
              </Button>
            ) : null}
          </div>
          <ul className="max-h-[22rem] overflow-y-auto">
            {state.notifications.length === 0 ? (
              <li className="px-3.5 py-8 text-center text-[13px] text-[var(--text-faint)]">
                {t.notification.empty}
              </li>
            ) : (
              state.notifications.slice(0, 20).map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2.5 border-b border-[var(--line-soft)] px-3.5 py-3 last:border-b-0"
                >
                  <span
                    aria-hidden
                    className={cx(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      item.read ? 'bg-[var(--line-strong)]' : 'bg-copper-600',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug">
                      {item.href ? (
                        <Link href={`/${locale}${item.href}`} className="hover:underline" onClick={() => run('notification.read', { id: item.id })}>
                          {locale === 'ar' ? item.titleAr : item.titleEn}
                        </Link>
                      ) : (
                        locale === 'ar' ? item.titleAr : item.titleEn
                      )}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">
                      {new Date(item.createdAt).toLocaleDateString(
                        locale === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB',
                        { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false },
                      )}
                    </p>
                  </div>
                  {!item.read ? <Badge tone="accent">{t.notification.unread}</Badge> : null}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, close]);
}
