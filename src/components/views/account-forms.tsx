'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { KeyRound, MailCheck, UserPlus, Loader2 } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import { PublicShell, Notice, publicCall } from './public-shell';
import { getDictionary, type Locale, type Dictionary } from '@/i18n/dictionary';

const message = (t: Dictionary, failure: unknown) => {
  const code = failure instanceof Error ? failure.message : 'server';
  return t.errors[code as keyof Dictionary['errors']] ?? t.errors.server;
};

/* ─────────────────────────── Accept an invitation ─────────────────────────── */

type Invitation = {
  email: string;
  role: string;
  organizationAr: string;
  organizationEn: string;
  hasAccount: boolean;
};

export function AcceptInvitation({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const token = useSearchParams().get('invitation') ?? '';
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const inspected = useRef(false);

  useEffect(() => {
    if (inspected.current) return;
    inspected.current = true;

    if (!token) {
      setError(t.invite.invalid);
      setLoading(false);
      return;
    }
    publicCall('invitation.inspect', { token })
      .then((result) => setInvitation(result as Invitation))
      .catch((failure) => setError(message(t, failure)))
      .finally(() => setLoading(false));
  }, [token, t]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (invitation && !invitation.hasAccount && password !== confirm) {
      setError(t.auth.mismatch);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await publicCall('invitation.accept', {
        token,
        ...(invitation?.hasAccount ? {} : { fullName, password }),
      });
      setDone(true);
    } catch (failure) {
      setError(message(t, failure));
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <PublicShell locale={locale} title={t.invite.title}>
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-[var(--text-muted)]">
          <Loader2 size={16} className="animate-spin" />
          {t.common.loading}
        </div>
      </PublicShell>
    );
  }

  if (done) {
    return (
      <PublicShell locale={locale} title={t.invite.title}>
        <div className="space-y-5">
          <Notice tone="success">{t.invite.accepted}</Notice>
          <Link
            href={`/${locale}/login`}
            className="inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800"
          >
            {t.auth.title}
          </Link>
        </div>
      </PublicShell>
    );
  }

  if (!invitation) {
    return (
      <PublicShell
        locale={locale}
        title={t.invite.title}
        footer={
          <Link href={`/${locale}/login`} className="font-medium text-copper-600 hover:underline">
            {t.auth.backToLogin}
          </Link>
        }
      >
        <Notice tone="error">{error ?? t.invite.invalid}</Notice>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      locale={locale}
      title={t.invite.title}
      subtitle={
        <>
          {t.invite.joining}{' '}
          <strong className="font-semibold text-[var(--text-strong)]">
            {locale === 'ar' ? invitation.organizationAr : invitation.organizationEn}
          </strong>{' '}
          {t.invite.asRole}{' '}
          <strong className="font-semibold text-copper-700">
            {t.roles[invitation.role as keyof typeof t.roles] ?? invitation.role}
          </strong>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <Notice tone="error">{error}</Notice> : null}

        <Field label={t.auth.email}>
          <Input value={invitation.email} dir="ltr" disabled />
        </Field>

        {invitation.hasAccount ? (
          <Notice tone="info">{t.invite.existing}</Notice>
        ) : (
          <>
            <Field label={t.signup.fullName} required>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label={t.auth.password} required hint={t.auth.passwordHint}>
              <Input
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label={t.auth.confirmPassword} required>
              <Input
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          </>
        )}

        <Button
          type="submit"
          loading={pending}
          icon={<UserPlus size={16} />}
          className="w-full"
          disabled={
            !invitation.hasAccount && (fullName.trim().length < 2 || password.length < 10)
          }
        >
          {t.invite.accept}
        </Button>
      </form>
    </PublicShell>
  );
}

/* ─────────────────────────── Email verification ─────────────────────────── */

export function VerifyEmail({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [error, setError] = useState<string | null>(null);
  // Verification consumes the token, so it must fire exactly once. Without
  // this guard React's double-invoked effect spends the token on the first
  // call and then reports the second call's "already used" as a failure.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) {
      setError(t.errors.tokenInvalid);
      setState('failed');
      return;
    }
    publicCall('email.verify', { token })
      .then(() => setState('done'))
      .catch((failure) => {
        setError(message(t, failure));
        setState('failed');
      });
  }, [token, t]);

  return (
    <PublicShell
      locale={locale}
      title={t.auth.verifyTitle}
      footer={
        <Link href={`/${locale}/login`} className="font-medium text-copper-600 hover:underline">
          {t.auth.backToLogin}
        </Link>
      }
    >
      {state === 'working' ? (
        <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-[var(--text-muted)]">
          <Loader2 size={16} className="animate-spin" />
          {t.auth.verifying}
        </div>
      ) : state === 'done' ? (
        <div className="space-y-5">
          <Notice tone="success">{t.auth.verified}</Notice>
          <Link
            href={`/${locale}/login`}
            className="inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800"
          >
            {t.auth.title}
          </Link>
        </div>
      ) : (
        <Notice tone="error">{error}</Notice>
      )}
    </PublicShell>
  );
}

/* ─────────────────────────── Forgot password ─────────────────────────── */

export function ForgotPassword({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await publicCall('password.forgot', { email });
      setSent(true);
    } catch (failure) {
      setError(message(t, failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <PublicShell
      locale={locale}
      title={t.auth.forgotTitle}
      subtitle={t.auth.forgotSubtitle}
      footer={
        <Link href={`/${locale}/login`} className="font-medium text-copper-600 hover:underline">
          {t.auth.backToLogin}
        </Link>
      }
    >
      {sent ? (
        <Notice tone="success">{t.auth.forgotSent}</Notice>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field label={t.auth.email} required>
            <Input
              type="email"
              dir="ltr"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.sa"
            />
          </Field>
          <Button
            type="submit"
            loading={pending}
            className="w-full"
            icon={<MailCheck size={16} />}
            disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
          >
            {t.common.submit}
          </Button>
        </form>
      )}
    </PublicShell>
  );
}

/* ─────────────────────────── Reset password ─────────────────────────── */

export function ResetPassword({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError(t.auth.mismatch);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await publicCall('password.reset', { token, password });
      setDone(true);
    } catch (failure) {
      setError(message(t, failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <PublicShell
      locale={locale}
      title={t.auth.resetTitle}
      subtitle={t.auth.resetSubtitle}
      footer={
        <Link href={`/${locale}/login`} className="font-medium text-copper-600 hover:underline">
          {t.auth.backToLogin}
        </Link>
      }
    >
      {done ? (
        <div className="space-y-5">
          <Notice tone="success">{t.common.success}</Notice>
          <Link
            href={`/${locale}/login`}
            className="inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800"
          >
            {t.auth.title}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field label={t.auth.newPassword} required hint={t.auth.passwordHint}>
            <Input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label={t.auth.confirmPassword} required>
            <Input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Button
            type="submit"
            loading={pending}
            className="w-full"
            icon={<KeyRound size={16} />}
            disabled={password.length < 10 || !token}
          >
            {t.common.save}
          </Button>
        </form>
      )}
    </PublicShell>
  );
}
