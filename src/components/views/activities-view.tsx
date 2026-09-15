'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, Plus, MapPin, Clock } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Progress,
  SectionHeader,
  Select,
  StatusBadge,
  Avatar,
  Fraction,
  cx,
} from '@/components/ui';
import { useApp } from '@/components/app-provider';
import { formatDateTime, formatNumber, formatPercent, toLocalInput } from '@/lib/format';
import type { ActivityState, AppState, ProgramState } from '@/lib/types';

const ATTENDANCE_STATES = ['Present', 'Absent', 'Excused'] as const;

export function ActivitiesView({ state }: { state: AppState }) {
  const { locale, t } = useApp();
  const name = (item: { nameAr: string; nameEn: string }) =>
    locale === 'ar' ? item.nameAr : item.nameEn;

  const eligible = state.programs.filter((program) =>
    ['Active', 'RegistrationClosed', 'Completed'].includes(program.status),
  );

  // Prefer a program attendance can actually be recorded against, so the screen
  // does not open on a completed cohort where every control is disabled.
  const [programId, setProgramId] = useState(
    () => eligible.find((program) => program.status === 'Active')?.id ?? eligible[0]?.id ?? '',
  );
  const [activityId, setActivityId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const program = state.programs.find((item) => item.id === programId);
  const activities = useMemo(
    () =>
      (program?.activities ?? [])
        .slice()
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [program],
  );
  const activity = activities.find((item) => item.id === activityId) ?? null;

  const canCreate =
    ['Admin', 'Manager', 'Coordinator'].includes(state.actor.role) &&
    program !== undefined &&
    ['Active', 'RegistrationClosed'].includes(program.status);

  if (eligible.length === 0) {
    return (
      <>
        <PageHeader title={t.activity.title} subtitle={t.activity.subtitle} />
        <Card>
          <EmptyState
            title={t.activity.noActivities}
            hint={t.program.createFirst}
            icon={<CalendarCheck size={19} />}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t.activity.title}
        subtitle={t.activity.subtitle}
        action={
          canCreate ? (
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              {t.activity.create}
            </Button>
          ) : null
        }
      />

      <div className="mb-4 max-w-sm">
        <Select
          value={programId}
          onChange={(event) => {
            setProgramId(event.target.value);
            setActivityId(null);
          }}
          aria-label={t.common.program}
        >
          {eligible.map((item) => (
            <option key={item.id} value={item.id}>
              {name(item)}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card padded={false} className="h-fit">
          <div className="px-5 pt-5">
            <SectionHeader title={t.activity.title} hint={`${activities.length}`} />
          </div>
          {activities.length === 0 ? (
            <EmptyState title={t.activity.noActivities} hint={t.common.emptyHint} />
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line-soft)]">
              {activities.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setActivityId(item.id)}
                    className={cx(
                      'flex w-full items-start gap-3 px-5 py-3 text-start transition-colors',
                      activityId === item.id
                        ? 'bg-copper-100/70'
                        : 'hover:bg-[var(--surface-sunken)]',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{name(item)}</span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-[var(--text-faint)]">
                        {formatDateTime(item.startsAt, locale)}
                      </span>
                    </span>
                    {item.required ? <Badge tone="accent">{t.common.required}</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padded={false}>
          {!activity || !program ? (
            <EmptyState
              title={t.activity.selectActivity}
              hint={t.common.emptyHint}
              icon={<CalendarCheck size={19} />}
            />
          ) : (
            <AttendanceBoard state={state} program={program} activity={activity} />
          )}
        </Card>
      </div>

      {creating && program ? (
        <CreateActivityModal program={program} onClose={() => setCreating(false)} />
      ) : null}
    </>
  );
}

function AttendanceBoard({
  state,
  program,
  activity,
}: {
  state: AppState;
  program: ProgramState;
  activity: ActivityState;
}) {
  const { locale, t, run, busy } = useApp();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const participants = state.applications.filter(
    (item) =>
      item.programId === program.id &&
      item.enrollment &&
      ['Enrolled', 'InProgress', 'Suspended'].includes(item.enrollment.status),
  );

  const recorded = participants.filter((item) => {
    const entry = item.enrollment?.attendance.find((a) => a.activityId === activity.id);
    return entry && entry.status !== 'NotRecorded';
  }).length;

  const present = participants.filter(
    (item) =>
      item.enrollment?.attendance.find((a) => a.activityId === activity.id)?.status === 'Present',
  ).length;

  const canRecord =
    ['Admin', 'Manager', 'Coordinator'].includes(state.actor.role) &&
    program.status === 'Active' &&
    activity.status !== 'Cancelled';
  const canCancel =
    ['Admin', 'Manager', 'Coordinator'].includes(state.actor.role) &&
    ['Active', 'RegistrationClosed'].includes(program.status) &&
    activity.status === 'Scheduled';
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const rate = participants.length ? (present / participants.length) * 100 : 0;

  async function record(enrollmentId: string, status: (typeof ATTENDANCE_STATES)[number]) {
    setPendingId(enrollmentId);
    const note = notes[enrollmentId]?.trim();
    await run('attendance.save', {
      activityId: activity.id,
      enrollmentId,
      status,
      reason: note && note.length >= 3 ? note : `${t.activity.attendance}: ${t.statuses[status]}`,
    });
    setPendingId(null);
  }

  return (
    <>
      <div className="border-b border-[var(--line-soft)] px-5 py-4">
        <SectionHeader
          title={locale === 'ar' ? activity.nameAr : activity.nameEn}
          hint={
            <span className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} />
                {formatDateTime(activity.startsAt, locale)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} />
                {activity.location}
              </span>
            </span>
          }
          action={
            <span className="flex items-center gap-2">
              <StatusBadge
                status={activity.status}
                label={t.statuses[activity.status as keyof typeof t.statuses] ?? activity.status}
              />
              {canCancel ? (
                <Button size="sm" variant="ghost" onClick={() => setCancelling((v) => !v)}>
                  {t.activity.cancel}
                </Button>
              ) : null}
            </span>
          }
        />
        {cancelling ? (
          <div className="mt-3 grid gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] p-3 sm:grid-cols-[1fr_auto]">
            <Field label={t.common.reason} required hint={t.activity.cancelHint}>
              <Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button
                variant="danger"
                loading={busy}
                disabled={cancelReason.trim().length < 3}
                onClick={async () => {
                  const result = await run('activity.cancel', { id: activity.id, reason: cancelReason.trim() });
                  if (result) setCancelling(false);
                }}
              >
                {t.common.confirm}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
              <span className="text-[var(--text-muted)]">{t.activity.rate}</span>
              <span className="font-semibold tabular-nums">{formatPercent(rate, locale)}</span>
            </div>
            <Progress value={rate} label={t.activity.rate} />
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
              <span className="text-[var(--text-muted)]">{t.activity.attendance}</span>
              <span className="font-semibold">
                <Fraction
                  used={formatNumber(recorded, locale)}
                  total={formatNumber(participants.length, locale)}
                />
              </span>
            </div>
            <Progress
              value={participants.length ? (recorded / participants.length) * 100 : 0}
              tone="navy"
              label={t.activity.attendance}
            />
          </div>
        </div>
      </div>

      {participants.length === 0 ? (
        <EmptyState title={t.activity.participants} hint={t.common.emptyHint} />
      ) : (
        <ul className="divide-y divide-[var(--line-soft)]">
          {participants.map((item) => {
            const enrollment = item.enrollment!;
            const entry = enrollment.attendance.find((a) => a.activityId === activity.id);
            const status = entry?.status ?? 'NotRecorded';
            return (
              <li key={item.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={item.beneficiary.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {item.beneficiary.name}
                    </span>
                    <span className="block text-[11.5px] text-[var(--text-faint)]">
                      {t.statuses[enrollment.status as keyof typeof t.statuses] ?? enrollment.status}
                    </span>
                  </span>

                  {canRecord ? (
                    <span className="flex gap-1">
                      {ATTENDANCE_STATES.map((value) => (
                        <button
                          key={value}
                          type="button"
                          disabled={busy && pendingId === enrollment.id}
                          onClick={() => record(enrollment.id, value)}
                          className={cx(
                            'h-8 rounded-lg px-3 text-[12.5px] font-medium transition-all disabled:opacity-50',
                            status === value
                              ? value === 'Present'
                                ? 'bg-positive text-white'
                                : value === 'Absent'
                                  ? 'bg-critical text-white'
                                  : 'bg-caution text-white'
                              : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:bg-[var(--line-soft)]',
                          )}
                        >
                          {t.statuses[value]}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <StatusBadge status={status} label={t.statuses[status]} />
                  )}
                </div>

                {canRecord ? (
                  <Input
                    value={notes[enrollment.id] ?? ''}
                    onChange={(event) =>
                      setNotes((current) => ({ ...current, [enrollment.id]: event.target.value }))
                    }
                    placeholder={`${t.activity.note} (${t.common.optional})`}
                    className="mt-2.5 h-8 text-[12.5px]"
                  />
                ) : entry?.reason ? (
                  <p className="mt-1.5 text-[12px] text-[var(--text-faint)]">{entry.reason}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function CreateActivityModal({
  program,
  onClose,
}: {
  program: ProgramState;
  onClose: () => void;
}) {
  const { locale, t, run, busy } = useApp();
  const clamp = (value: Date) => {
    const start = new Date(program.startsAt);
    const end = new Date(program.endsAt);
    return value < start ? start : value > end ? end : value;
  };

  const [draft, setDraft] = useState(() => {
    const start = clamp(new Date(Date.now() + 86_400_000));
    const end = clamp(new Date(start.getTime() + 2 * 3_600_000));
    return {
      nameAr: '',
      nameEn: '',
      location: '',
      startsAt: toLocalInput(start),
      endsAt: toLocalInput(end),
      required: true,
    };
  });

  const valid =
    draft.nameAr.trim() && draft.nameEn.trim() && draft.location.trim() && draft.startsAt && draft.endsAt;

  return (
    <Modal
      open
      onClose={onClose}
      title={t.activity.create}
      description={locale === 'ar' ? program.nameAr : program.nameEn}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            loading={busy}
            disabled={!valid}
            onClick={async () => {
              const result = await run('activity.create', {
                programId: program.id,
                nameAr: draft.nameAr.trim(),
                nameEn: draft.nameEn.trim(),
                location: draft.location.trim(),
                startsAt: new Date(draft.startsAt).toISOString(),
                endsAt: new Date(draft.endsAt).toISOString(),
                required: draft.required,
              });
              if (result) onClose();
            }}
          >
            {t.common.create}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.activity.nameAr} required>
          <Input
            dir="rtl"
            value={draft.nameAr}
            onChange={(event) => setDraft((c) => ({ ...c, nameAr: event.target.value }))}
          />
        </Field>
        <Field label={t.activity.nameEn} required>
          <Input
            dir="ltr"
            value={draft.nameEn}
            onChange={(event) => setDraft((c) => ({ ...c, nameEn: event.target.value }))}
          />
        </Field>
        <Field label={t.activity.location} required className="sm:col-span-2">
          <Input
            value={draft.location}
            onChange={(event) => setDraft((c) => ({ ...c, location: event.target.value }))}
          />
        </Field>
        <Field label={t.activity.starts} required>
          <Input
            type="datetime-local"
            value={draft.startsAt}
            onChange={(event) => setDraft((c) => ({ ...c, startsAt: event.target.value }))}
          />
        </Field>
        <Field label={t.activity.ends} required>
          <Input
            type="datetime-local"
            value={draft.endsAt}
            onChange={(event) => setDraft((c) => ({ ...c, endsAt: event.target.value }))}
          />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            checked={draft.required}
            onChange={(event) => setDraft((c) => ({ ...c, required: event.target.checked }))}
            label={t.activity.requiredActivity}
          />
        </div>
      </div>
    </Modal>
  );
}
