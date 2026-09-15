'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, LogIn, AlertTriangle } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import { getDictionary, type Locale } from '@/i18n/dictionary';

type DemoAccount = { email: string; role: string };

export function LoginForm({ locale, demo }: { locale: Locale; demo: DemoAccount[] }) {
  const t = getDictionary(locale);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code,setCode]=useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [demoCode, setDemoCode] = useState('');
  const search = useSearchParams();
  const ticket = search.get('ticket');
  const ssoError = search.get('sso');

  // A ticket in the address means single sign on already proved the identity;
  // redeem it once and land the person inside, without a second prompt.
  useEffect(() => {
    if (!ticket) return;
    let cancelled = false;
    setPending(true);
    signIn('sso', { ticket, redirect: false })
      .then((result) => {
        if (cancelled) return;
        if (result?.error) setError(t.auth.ssoFailed);
        else {
          router.replace(`/${locale}`);
          router.refresh();
        }
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticket, locale, router, t]);

  useEffect(() => {
    if (ssoError) setError(t.auth.ssoFailed);
  }, [ssoError, t]);

  // Demo accounts share one two step secret; keep the current code at hand so a
  // click on an account fills everything the sign in needs. The server answers
  // only while the database is marked as seeded demo data.
  useEffect(() => {
    if (!demo.length) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/demo/otp', { cache: 'no-store' });
        if (!response.ok) return;
        const body = (await response.json()) as { code?: string };
        if (!cancelled && body.code) setDemoCode(body.code);
      } catch {
        /* the field can still be typed by hand */
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [demo.length]);

  // Once a demo account is chosen, follow the rotating code until the person types their own
  useEffect(() => {
    if (demoCode && email.endsWith('@programos.sa')) setCode(demoCode);
  }, [demoCode, email]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await signIn('credentials', { email, password, code, redirect: false });
      if (result?.error) {
        setError(t.auth.failed);
        return;
      }
      router.replace(`/${locale}`);
      router.refresh();
    } catch {
      setError(t.errors.network);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {error ? (
          <div
            role="alert"
            className="animate-fade flex items-start gap-2.5 rounded-[10px] bg-critical-soft px-3.5 py-3 text-[13px] text-critical"
          >
            <AlertTriangle size={16} className="mt-px shrink-0" />
            {error}
          </div>
        ) : null}

        <Field label={t.auth.email} required>
          <Input
            type="email"
            autoComplete="email"
            dir="ltr"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@organization.sa"
          />
        </Field>

        <Field label={t.auth.password} required>
          {/* dir=ltr so the reveal button sits after the text, not over its start */}
          <div className="relative" dir="ltr">
            <Input
              type={reveal ? 'text' : 'password'}
              autoComplete="current-password"
              dir="ltr"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pe-10"
            />
            <button
              type="button"
              onClick={() => setReveal((value) => !value)}
              className="absolute top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--text-faint)] transition-colors hover:text-[var(--text-strong)] end-1.5"
              aria-label={reveal ? 'hide password' : 'show password'}
              tabIndex={-1}
            >
              {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <Field label={locale==='ar'?'رمز تطبيق التحقق إذا كان مفعّلًا':'Authenticator code if enabled'}><Input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} maxLength={6}/></Field>
        <Button type="submit" loading={pending} icon={<LogIn size={16} />} className="w-full">
          {pending ? t.auth.submitting : t.auth.submit}
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[12.5px]">
          <Link href={`/${locale}/forgot`} className="text-[var(--text-muted)] hover:text-copper-600 hover:underline">
            {t.auth.forgotLink}
          </Link>
          <span className="text-[var(--text-faint)]">
            {t.auth.noAccount}{' '}
            <Link href={`/${locale}/register`} className="font-medium text-copper-600 hover:underline">
              {t.auth.signUpLink}
            </Link>
          </span>
        </div>
      </form>

      {demo.length ? (
        <div className="mt-9 rounded-xl border border-dashed border-[var(--line-strong)] p-4">
          <p className="text-[12.5px] font-medium">{t.auth.demo}</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">{t.auth.demoHint}</p>
          <div className="mt-3 grid gap-1.5">
            {demo.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword('Demo@12345');
                  if (demoCode) setCode(demoCode);
                  setError(null);
                }}
                className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-start text-[12.5px] transition-colors hover:bg-[var(--surface-sunken)]"
              >
                <span dir="ltr" className="truncate font-mono text-[11.5px] text-[var(--text-muted)]">
                  {account.email}
                </span>
                <span className="shrink-0 rounded-full bg-copper-100 px-2 py-0.5 text-[11px] font-medium text-copper-700">
                  {t.roles[account.role as keyof typeof t.roles] ?? account.role}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[var(--text-faint)]">
            <span dir="ltr" className="font-mono">
              Demo@12345
            </span>
            {demoCode ? (
              <span className="flex items-center gap-2" title={t.auth.demoCodeHint}>
                {t.auth.demoCode}
                <span dir="ltr" className="rounded-md bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[12px] tracking-widest text-[var(--text-strong)]" data-testid="demo-otp">
                  {demoCode}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
