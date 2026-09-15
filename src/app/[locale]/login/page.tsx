import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { sessionIsUsable } from '@/lib/session-state';
import { getDictionary, isLocale, type Locale } from '@/i18n/dictionary';
import { LoginForm } from '@/components/views/login-form';
import { BrandMark } from '@/components/shell/brand-mark';
import { LocaleToggle } from '@/components/shell/locale-toggle';
import { DEMO_ACCOUNTS, demoLoginEnabled } from '@/lib/demo';
import { ClearStaleSession } from '@/components/views/clear-stale-session';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'ar';
  const t = getDictionary(locale);

  // Only leave the sign-in page for a session that still resolves to a usable
  // account. Trusting the cookie alone makes this page and the dashboard
  // redirect at each other forever once the account behind it goes away.
  const session = await auth();
  const staleSession = Boolean(session?.user?.id) && !(await sessionIsUsable());
  if (session?.user?.id && !staleSession) redirect(`/${locale}`);

  const demo = demoLoginEnabled()
    ? DEMO_ACCOUNTS.map((account) => ({ email: account.email, role: account.role }))
    : [];

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 82% 12%, rgba(229,138,60,0.30), transparent 46%), radial-gradient(circle at 8% 88%, rgba(58,74,98,0.85), transparent 52%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(238,235,223,0.6) 1px, transparent 1px), linear-gradient(to right, rgba(238,235,223,0.6) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        <div
          aria-hidden
          className="absolute -bottom-24 size-[26rem] rotate-12 rounded-[3rem] border border-copper-500/25 end-[-6rem]"
        />

        <div className="relative">
          <BrandMark locale={locale} tone="light" />
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-[2.6rem] font-semibold leading-[1.18] tracking-tight text-ivory-500">
            {t.auth.heroTitle}
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-navy-300">{t.auth.heroBody}</p>
          <ul className="mt-9 space-y-3.5">
            {t.auth.heroPoints.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[14px] text-ivory-500/90">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-copper-500" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12.5px] text-navy-400">
          {t.brand} · {t.brandTag}
        </p>
      </section>

      {/* Form panel */}
      <section className="flex flex-col px-6 py-8 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-4">
          <div className="lg:hidden">
            <BrandMark locale={locale} tone="dark" />
          </div>
          <div className="ms-auto">
            <LocaleToggle locale={locale} />
          </div>
        </div>

        <div className="animate-rise mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-10">
          <h2 className="text-[1.75rem] font-semibold tracking-tight">{t.auth.title}</h2>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">{t.auth.subtitle}</p>
          {staleSession ? <ClearStaleSession /> : null}
          <LoginForm locale={locale} demo={demo} />
        </div>

        <p className="text-center text-[12px] text-[var(--text-faint)]">
          © {new Date().getFullYear()} {t.brand}
        </p>
      </section>
    </main>
  );
}
