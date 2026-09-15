'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Avatar, Badge, Button, Card, EmptyState, Field, PageHeader, SearchInput, StatusBadge, Textarea, cx } from '@/components/ui';
import { formatDateTime, formatPercent } from '@/lib/format';
import type { AppState } from '@/lib/types';

/**
 * One profile per person inside the workspace, with every participation the
 * viewer is allowed to see. The list scrolls on its own so the profile stays
 * in view, and the first person is opened straight away instead of an empty
 * pane asking to be clicked.
 */
export function BeneficiariesView({ state }: { state: AppState }) {
  const { locale, t, run, busy } = useApp();
  const ar = locale === 'ar';
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');

  const people = useMemo(
    () => [...new Map(state.applications.map((a) => [a.beneficiaryId, a.beneficiary])).values()].sort((a, b) => a.name.localeCompare(b.name, locale)),
    [state.applications, locale],
  );
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? people.filter((p) => (p.name + ' ' + p.email).toLowerCase().includes(needle)) : people;
  }, [people, query]);
  useEffect(() => {
    if (!selected && shown[0]) setSelected(shown[0].id);
  }, [shown, selected]);

  const person = people.find((p) => p.id === selected);
  const applications = state.applications.filter((a) => a.beneficiaryId === selected);
  const manage = ['Admin', 'Manager'].includes(state.actor.role);
  const staff = ['Admin', 'Manager', 'Coordinator'].includes(state.actor.role);
  const consent = (applicationId: string) => state.consents.find((c) => c.applicationId === applicationId);
  const needsReason = reason.trim().length < 3;

  return (
    <>
      <PageHeader
        title={t.nav.beneficiaries}
        subtitle={ar ? 'ملف المستفيد وسجل مشاركاته في البرامج المصرح بها' : 'Beneficiary profiles and authorized program history'}
      />
      <div className="mb-4 max-w-xs">
        <SearchInput value={query} onChange={setQuery} placeholder={t.common.searchPlaceholder} />
      </div>

      {people.length === 0 ? (
        <Card>
          <EmptyState title={t.common.empty} hint={t.common.emptyHint} icon={<Users size={19} />} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr] lg:items-start">
          <Card padded={false} className="lg:sticky lg:top-20">
            <p className="border-b border-[var(--line-soft)] px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              {shown.length} {ar ? 'مستفيد' : 'people'}
            </p>
            <ul className="max-h-[68vh] overflow-y-auto p-1.5">
              {shown.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(p.id)}
                    aria-current={p.id === selected}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-[var(--surface-sunken)]',
                      p.id === selected && 'bg-copper-100 hover:bg-copper-100',
                    )}
                  >
                    <Avatar name={p.name} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{p.name}</span>
                      <span dir="ltr" className="block truncate text-[11.5px] text-[var(--text-faint)]">{p.email}</span>
                    </span>
                    {p.status && p.status !== 'Active' ? (
                      <Badge tone="neutral">{t.statuses[p.status as keyof typeof t.statuses] ?? p.status}</Badge>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            {person ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line-soft)] pb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={person.name} size={44} />
                    <div>
                      <h2 className="text-[17px] font-semibold">{person.name}</h2>
                      <p dir="ltr" className="text-[13px] text-[var(--text-muted)]">{person.email}</p>
                    </div>
                  </div>
                  <span className="text-[12.5px] text-[var(--text-muted)]">
                    {applications.length} {ar ? 'مشاركة' : 'participations'}
                  </span>
                </div>

                {staff ? (
                  <div className="mt-4 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] p-4">
                    <Field label={ar ? 'سبب الإجراء أو نص الملاحظة' : 'Action reason or note'} hint={ar ? 'مطلوب قبل أي إجراء على الملف أو المشاركة' : 'Required before any action on the profile or a participation'}>
                      <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Field>
                    {state.actor.role === 'Admin' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {person.status !== 'Anonymized' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={needsReason}
                            loading={busy}
                            onClick={() => run('beneficiary.status', { id: person.id, status: person.status === 'Archived' ? 'Active' : 'Archived', reason })}
                          >
                            {person.status === 'Archived' ? (ar ? 'إعادة تفعيل الملف' : 'Reactivate profile') : (ar ? 'أرشفة الملف' : 'Archive profile')}
                          </Button>
                        ) : null}
                        {[true, false].map((legalHold) => (
                          <Button
                            key={String(legalHold)}
                            variant="ghost"
                            size="sm"
                            disabled={needsReason}
                            onClick={() => run('beneficiary.hold', { id: person.id, legalHold, reason })}
                          >
                            {legalHold ? (ar ? 'حجز قانوني للبيانات' : 'Place legal hold') : (ar ? 'رفع الحجز القانوني' : 'Release legal hold')}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 space-y-4">
                  {applications.map((app) => {
                    const program = state.programs.find((p) => p.id === app.programId);
                    const enr = app.enrollment;
                    const c = consent(app.id);
                    const required = (program?.activities ?? []).filter((a) => a.required && a.status !== 'Cancelled');
                    const record = (activityId: string) => enr?.attendance.find((r) => r.activityId === activityId);
                    const counted = required.filter((a) => record(a.id)?.status !== 'Excused');
                    const present = counted.filter((a) => record(a.id)?.status === 'Present').length;
                    const unrecorded = counted.filter((a) => !record(a.id) || record(a.id)?.status === 'NotRecorded').length;
                    const transitions = manage
                      ? ['Completed', 'Suspended', 'InProgress', 'Withdrawn', 'Cancelled']
                      : state.actor.role === 'Beneficiary' ? ['Withdrawn'] : [];
                    return (
                      <section key={app.id} className="rounded-xl border border-[var(--line-soft)] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-[15px] font-semibold">{ar ? program?.nameAr : program?.nameEn}</h3>
                            <p dir="ltr" className="mt-1 text-[12px] text-[var(--text-faint)]">
                              {app.reference || app.id.slice(0, 8).toUpperCase()} · {formatDateTime(app.createdAt, locale)}
                            </p>
                          </div>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={app.status} label={t.statuses[app.status as keyof typeof t.statuses] ?? app.status} />
                            {c ? (
                              <Badge tone={c.withdrawnAt ? 'neutral' : 'positive'}>
                                {t.privacy.consents}: {c.withdrawnAt ? t.privacy.consentWithdrawn : t.privacy.consentActive}
                              </Badge>
                            ) : null}
                          </span>
                        </div>

                        {enr ? (
                          <div className="mt-3 space-y-3 text-[13.5px]">
                            <p>
                              <span className="text-[var(--text-muted)]">{ar ? 'حالة المشاركة' : 'Enrollment status'}: </span>
                              <span className="font-medium">{t.statuses[enr.status as keyof typeof t.statuses] ?? enr.status}</span>
                            </p>
                            {program && counted.length ? (
                              <p className="text-[13px] text-[var(--text-muted)]">
                                {t.activity.rate}: {formatPercent((present / counted.length) * 100, locale)} ({present}/{counted.length}) · {t.program.threshold.replace(' (%)', '')}: {program.completionThreshold}%
                                {unrecorded ? ` · ${t.statuses.NotRecorded}: ${unrecorded}` : ''}
                                {program.requireEndline ? ` · ${t.program.requireEndline}` : ''}
                              </p>
                            ) : null}
                            {['Enrolled', 'InProgress', 'Suspended'].includes(enr.status) ? (
                              <div className="flex flex-wrap gap-2">
                                {transitions
                                  .filter((to) => to !== enr.status && (to !== 'InProgress' || enr.status === 'Suspended') && (to !== 'Completed' || enr.status === 'InProgress'))
                                  .map((to) => (
                                    <Button
                                      key={to}
                                      variant="ghost"
                                      size="sm"
                                      disabled={(staff || state.actor.role === 'Beneficiary') && needsReason}
                                      loading={busy}
                                      onClick={() => run('enrollment.transition', { id: app.id, to, reason })}
                                    >
                                      {t.statuses[to as keyof typeof t.statuses] ?? to}
                                    </Button>
                                  ))}
                              </div>
                            ) : null}
                            {program?.activities.length ? (
                              <ul className="divide-y divide-[var(--line-soft)] rounded-lg border border-[var(--line-soft)] text-[13px]">
                                {program.activities.map((activity) => {
                                  const entry = record(activity.id);
                                  const status = activity.status === 'Cancelled' ? t.statuses.Cancelled : (t.statuses[(entry?.status ?? 'NotRecorded') as keyof typeof t.statuses] ?? entry?.status);
                                  return (
                                    <li key={activity.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                      <span>{ar ? activity.nameAr : activity.nameEn}</span>
                                      <span className="text-[12px] text-[var(--text-muted)]">{formatDateTime(activity.startsAt, locale)} · {status}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}

                        {state.actor.role === 'Beneficiary' && ['Enrolled', 'InProgress', 'Suspended'].includes(enr?.status ?? '') ? (
                          <div className="mt-3">
                            <Field label={t.common.reason}>
                              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                            </Field>
                          </div>
                        ) : null}

                        {(manage && app.status === 'Withdrawn') || staff ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {manage && app.status === 'Withdrawn' ? (
                              <Button variant="ghost" size="sm" disabled={needsReason} onClick={() => run('application.reopen', { id: app.id, reason })}>
                                {ar ? 'إعادة فتح الطلب' : 'Reopen application'}
                              </Button>
                            ) : null}
                            {staff ? (
                              <Button variant="ghost" size="sm" disabled={needsReason} onClick={() => run('beneficiary.note', { programId: app.programId, beneficiaryId: person.id, body: reason })}>
                                {ar ? 'حفظ ملاحظة تشغيلية' : 'Save operational note'}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                        {staff ? (
                          <>
                            <p className="mt-2 text-[11.5px] text-[var(--text-faint)]">
                              {ar ? 'الملاحظات للفريق فقط. لا تدخل معلومات صحية أو حساسة.' : 'Notes are for staff only. Do not enter health or sensitive information.'}
                            </p>
                            {state.notes
                              .filter((n) => n.beneficiaryId === person.id && n.programId === app.programId)
                              .map((n) => (
                                <p key={n.id} className="mt-2 rounded-lg bg-[var(--surface-sunken)] p-3 text-[13px]">
                                  {n.body}
                                  <span className="mt-1 block text-[11.5px] text-[var(--text-faint)]">{formatDateTime(n.createdAt, locale)}</span>
                                </p>
                              ))}
                          </>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState title={ar ? 'اختر مستفيدًا لعرض ملفه' : 'Select a beneficiary to view their profile'} hint="" icon={<Users size={19} />} />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
