'use client';

import { useMemo, useState } from 'react';
import {InitiativePanel} from './initiative-panel';
import {
  Plus,
  FolderKanban,
  Users2,
  CalendarRange,
  Trash2,
  ArrowRightLeft,
  Target,
  CalendarCheck,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataList,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Progress,
  SearchInput,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  Fraction,
  cx,
} from '@/components/ui';
import { useApp } from '@/components/app-provider';
import { formatDate, formatNumber, formatPercent, toLocalInput } from '@/lib/format';
import { transitions, publishBlockers, type PublishBlocker } from '@/lib/domain';
import type { AppState, FormField, ProgramState, RubricCriterion } from '@/lib/types';

type Draft = {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  capacity: string;
  startsAt: string;
  endsAt: string;
  registrationStart: string;
  registrationEnd: string;
  completionThreshold: string;
  requireEndline: boolean;
  privacyAr: string;
  privacyEn: string;
  initiativeId: string;
  form: FormField[];
  rubric: RubricCriterion[];
};

function emptyDraft(): Draft {
  const now = new Date();
  const day = 86_400_000;
  const iso = (offset: number) => toLocalInput(new Date(now.getTime() + offset * day));
  return {
    nameAr: '',
    nameEn: '',
    descriptionAr: '',
    descriptionEn: '',
    capacity: '25',
    startsAt: iso(21),
    endsAt: iso(60),
    registrationStart: iso(1),
    registrationEnd: iso(14),
    completionThreshold: '80',
    requireEndline: false,
    privacyAr: 'تُستخدم بياناتك لأغراض إدارة البرنامج وقياس أثره فقط.',
    privacyEn: 'Your data is used solely to administer this program and measure its impact.',
    initiativeId: '',
    form: [
      { id: 'motivation', labelAr: 'دافع الالتحاق', labelEn: 'Motivation', type: 'textarea', required: true },
    ],
    rubric: [{ nameAr: 'الجدية والالتزام', nameEn: 'Commitment', weight: 100 }],
  };
}

export function ProgramsView({ state }: { state: AppState }) {
  const { locale, t, run, busy } = useApp();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ProgramState | null>(null);

  const canManage = ['Admin', 'Manager'].includes(state.actor.role);
  const name = (item: { nameAr: string; nameEn: string }) =>
    locale === 'ar' ? item.nameAr : item.nameEn;

  const enrolledByProgram = useMemo(() => {
    const map = new Map<string, number>();
    for (const application of state.applications) {
      if (application.enrollment && !['Withdrawn', 'Cancelled'].includes(application.enrollment.status)) {
        map.set(application.programId, (map.get(application.programId) ?? 0) + 1);
      }
    }
    return map;
  }, [state.applications]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.programs.filter((program) => {
      if (statusFilter !== 'all' && program.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        program.nameAr.toLowerCase().includes(needle) || program.nameEn.toLowerCase().includes(needle)
      );
    });
  }, [state.programs, query, statusFilter]);

  const statusOptions = useMemo(
    () => [...new Set(state.programs.map((program) => program.status))],
    [state.programs],
  );

  return (
    <>
      <PageHeader
        title={t.program.title}
        subtitle={t.program.subtitle}
        action={
          canManage ? (
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              {t.program.create}
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t.common.searchPlaceholder}
          className="min-w-[14rem] flex-1 sm:max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-auto min-w-[10rem]"
          aria-label={t.common.status}
        >
          <option value="all">{t.common.all}</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {t.statuses[status as keyof typeof t.statuses] ?? status}
            </option>
          ))}
        </Select>
        <InitiativePanel state={state} />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={state.programs.length ? t.common.empty : t.program.noPrograms}
            hint={state.programs.length ? t.common.emptyHint : t.program.createFirst}
            icon={<FolderKanban size={19} />}
            action={
              canManage && !state.programs.length ? (
                <Button icon={<Plus size={16} />} onClick={() => setCreating(true)} size="sm">
                  {t.program.create}
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((program) => {
            const filled = enrolledByProgram.get(program.id) ?? 0;
            const usage = program.capacity ? (filled / program.capacity) * 100 : 0;
            return (
              <button
                key={program.id}
                type="button"
                onClick={() => setSelected(program)}
                className="surface group flex flex-col p-4 text-start transition-all duration-200 hover:-translate-y-px hover:border-copper-600/35 hover:shadow-[var(--shadow-raised)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="line-clamp-2 text-[14.5px] font-semibold leading-snug">
                    {name(program)}
                  </h3>
                  <StatusBadge
                    status={program.status}
                    label={t.statuses[program.status as keyof typeof t.statuses] ?? program.status}
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                  {locale === 'ar' ? program.descriptionAr : program.descriptionEn}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <dt className="flex items-center gap-1.5 text-[var(--text-faint)]">
                      <CalendarRange size={13} />
                      {t.program.period}
                    </dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {formatDate(program.startsAt, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-[var(--text-faint)]">
                      <Users2 size={13} />
                      {t.program.seats}
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      <Fraction
                        used={formatNumber(filled, locale)}
                        total={formatNumber(program.capacity, locale)}
                      />
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto pt-4">
                  <Progress value={usage} label={t.dash.capacity} />
                  <p className="mt-1.5 text-[11.5px] text-[var(--text-faint)]">
                    {formatPercent(usage, locale)} · {formatNumber(filled, locale)}{' '}
                    {t.program.seatsUsed}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {creating ? (
        <CreateProgramModal
          state={state}
          onClose={() => setCreating(false)}
          onSubmit={async (payload) => {
            const result = await run('program.create', payload);
            if (result) setCreating(false);
          }}
          busy={busy}
        />
      ) : null}

      {selected ? (
        <ProgramDetail
          state={state}
          program={state.programs.find((item) => item.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

/* ─────────────────────────── Create ─────────────────────────── */

function CreateProgramModal({
  state,
  onClose,
  onSubmit,
  busy,
}: {
  state: AppState;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const { t } = useApp();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState<'basics' | 'form' | 'rubric'>('basics');

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const weightTotal = draft.rubric.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const valid =
    draft.nameAr.trim() &&
    draft.nameEn.trim() &&
    draft.descriptionAr.trim() &&
    draft.descriptionEn.trim() &&
    draft.privacyAr.trim() &&
    draft.privacyEn.trim() &&
    draft.rubric.length > 0 &&
    weightTotal === 100 &&
    draft.form.every((field) => field.id && field.labelAr && field.labelEn);

  function submit() {
    void onSubmit({
      nameAr: draft.nameAr.trim(),
      nameEn: draft.nameEn.trim(),
      descriptionAr: draft.descriptionAr.trim(),
      descriptionEn: draft.descriptionEn.trim(),
      capacity: Number(draft.capacity),
      startsAt: new Date(draft.startsAt).toISOString(),
      endsAt: new Date(draft.endsAt).toISOString(),
      registrationStart: new Date(draft.registrationStart).toISOString(),
      registrationEnd: new Date(draft.registrationEnd).toISOString(),
      completionThreshold: Number(draft.completionThreshold),
      requireEndline: draft.requireEndline,
      privacyAr: draft.privacyAr.trim(),
      privacyEn: draft.privacyEn.trim(),
      ...(draft.initiativeId ? { initiativeId: draft.initiativeId } : {}),
      form: draft.form,
      rubric: draft.rubric.map((item) => ({ ...item, weight: Number(item.weight) })),
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.program.create}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={submit} disabled={!valid} loading={busy}>
            {t.common.create}
          </Button>
        </>
      }
    >
      <Tabs
        value={step}
        onChange={setStep}
        items={[
          { value: 'basics', label: t.program.detailTabs.overview },
          { value: 'form', label: t.program.form, count: draft.form.length },
          { value: 'rubric', label: t.program.rubric, count: draft.rubric.length },
        ]}
      />

      <div className="mt-5">
        {step === 'basics' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.program.nameAr} required>
              <Input value={draft.nameAr} onChange={(e) => set('nameAr', e.target.value)} dir="rtl" />
            </Field>
            <Field label={t.program.nameEn} required>
              <Input value={draft.nameEn} onChange={(e) => set('nameEn', e.target.value)} dir="ltr" />
            </Field>
            <Field label={t.program.descAr} required className="sm:col-span-2">
              <Textarea
                value={draft.descriptionAr}
                onChange={(e) => set('descriptionAr', e.target.value)}
                dir="rtl"
              />
            </Field>
            <Field label={t.program.descEn} required className="sm:col-span-2">
              <Textarea
                value={draft.descriptionEn}
                onChange={(e) => set('descriptionEn', e.target.value)}
                dir="ltr"
              />
            </Field>

            <Field label={t.program.capacity} required>
              <Input
                type="number"
                min={1}
                value={draft.capacity}
                onChange={(e) => set('capacity', e.target.value)}
              />
            </Field>
            <Field label={t.program.threshold} required>
              <Input
                type="number"
                min={1}
                max={100}
                value={draft.completionThreshold}
                onChange={(e) => set('completionThreshold', e.target.value)}
              />
            </Field>

            <Field label={t.program.regStart} required>
              <Input
                type="datetime-local"
                value={draft.registrationStart}
                onChange={(e) => set('registrationStart', e.target.value)}
              />
            </Field>
            <Field label={t.program.regEnd} required>
              <Input
                type="datetime-local"
                value={draft.registrationEnd}
                onChange={(e) => set('registrationEnd', e.target.value)}
              />
            </Field>
            <Field label={t.program.starts} required>
              <Input
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
              />
            </Field>
            <Field label={t.program.ends} required>
              <Input
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => set('endsAt', e.target.value)}
              />
            </Field>

            {state.initiatives.length ? (
              <Field label={t.program.initiative} className="sm:col-span-2">
                <Select
                  value={draft.initiativeId}
                  onChange={(e) => set('initiativeId', e.target.value)}
                >
                  <option value="">{t.common.none}</option>
                  {state.initiatives.map((initiative) => (
                    <option key={initiative.id} value={initiative.id}>
                      {initiative.nameAr} · {initiative.nameEn}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label={t.program.privacyAr} required className="sm:col-span-2">
              <Textarea
                rows={2}
                value={draft.privacyAr}
                onChange={(e) => set('privacyAr', e.target.value)}
                dir="rtl"
              />
            </Field>
            <Field label={t.program.privacyEn} required className="sm:col-span-2">
              <Textarea
                rows={2}
                value={draft.privacyEn}
                onChange={(e) => set('privacyEn', e.target.value)}
                dir="ltr"
              />
            </Field>

            <div className="sm:col-span-2">
              <Checkbox
                checked={draft.requireEndline}
                onChange={(e) => set('requireEndline', e.target.checked)}
                label={t.program.requireEndline}
              />
            </div>
          </div>
        ) : null}

        {step === 'form' ? (
          <FormBuilder fields={draft.form} onChange={(fields) => set('form', fields)} />
        ) : null}

        {step === 'rubric' ? (
          <RubricBuilder
            rubric={draft.rubric}
            total={weightTotal}
            onChange={(rubric) => set('rubric', rubric)}
          />
        ) : null}
      </div>
    </Modal>
  );
}

function FormBuilder({
  fields,
  onChange,
}: {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}) {
  const { t } = useApp();

  function update(index: number, patch: Partial<FormField>) {
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  }

  return (
    <div>
      <p className="mb-3 text-[12.5px] text-[var(--text-muted)]">{t.program.formHint}</p>
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={index} className="rounded-xl border border-[var(--line-soft)] p-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.program.fieldKey} required>
                <Input
                  value={field.id}
                  dir="ltr"
                  onChange={(e) =>
                    update(index, { id: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })
                  }
                  placeholder="fieldKey"
                />
              </Field>
              <Field label={t.program.fieldType}>
                <Select
                  value={field.type}
                  onChange={(e) => update(index, { type: e.target.value as FormField['type'] })}
                >
                  <option value="text">text</option>
                  <option value="textarea">textarea</option>
                  <option value="number">number</option>
                  <option value="date">date</option>
                  <option value="select">select</option>
                  <option value="multiselect">اختيار متعدد · Multiple choice</option>
                  <option value="attachment">مرفق · Attachment</option>
                </Select>
              </Field>
              <Field label={t.program.fieldLabelAr} required>
                <Input value={field.labelAr} dir="rtl" onChange={(e) => update(index, { labelAr: e.target.value })} />
              </Field>
              <Field label={t.program.fieldLabelEn} required>
                <Input value={field.labelEn} dir="ltr" onChange={(e) => update(index, { labelEn: e.target.value })} />
              </Field>
              {['select','multiselect'].includes(field.type) ? (
                <Field label={t.program.fieldOptions} className="sm:col-span-2">
                  <Input
                    value={(field.options ?? []).join(', ')}
                    onChange={(e) =>
                      update(index, {
                        options: e.target.value
                          .split(',')
                          .map((option) => option.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Checkbox
                checked={field.required}
                onChange={(e) => update(index, { required: e.target.checked })}
                label={t.common.required}
              />
              <Button
                variant="subtle"
                size="sm"
                icon={<Trash2 size={14} />}
                onClick={() => onChange(fields.filter((_, i) => i !== index))}
              >
                {t.common.cancel}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        icon={<Plus size={15} />}
        disabled={fields.length >= 30}
        onClick={() =>
          onChange([
            ...fields,
            { id: `field${fields.length + 1}`, labelAr: '', labelEn: '', type: 'text', required: false },
          ])
        }
      >
        {t.program.addField}
      </Button>
    </div>
  );
}

function RubricBuilder({
  rubric,
  total,
  onChange,
}: {
  rubric: RubricCriterion[];
  total: number;
  onChange: (rubric: RubricCriterion[]) => void;
}) {
  const { locale, t } = useApp();

  function update(index: number, patch: Partial<RubricCriterion>) {
    onChange(rubric.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-[var(--text-muted)]">{t.program.rubricHint}</p>
        <Badge tone={total === 100 ? 'positive' : 'critical'}>
          {t.program.totalWeight}: {formatNumber(total, locale)}
        </Badge>
      </div>
      <div className="space-y-3">
        {rubric.map((item, index) => (
          <div
            key={index}
            className="grid items-end gap-3 rounded-xl border border-[var(--line-soft)] p-3.5 sm:grid-cols-[1fr_1fr_6rem_auto]"
          >
            <Field label={t.impact.nameAr} required>
              <Input value={item.nameAr} dir="rtl" onChange={(e) => update(index, { nameAr: e.target.value })} />
            </Field>
            <Field label={t.impact.nameEn} required>
              <Input value={item.nameEn} dir="ltr" onChange={(e) => update(index, { nameEn: e.target.value })} />
            </Field>
            <Field label={t.program.weight} required>
              <Input
                type="number"
                min={1}
                max={100}
                value={item.weight}
                onChange={(e) => update(index, { weight: Number(e.target.value) })}
              />
            </Field>
            <Button
              variant="subtle"
              size="sm"
              icon={<Trash2 size={14} />}
              disabled={rubric.length <= 1}
              onClick={() => onChange(rubric.filter((_, i) => i !== index))}
              aria-label={t.common.cancel}
            />
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        icon={<Plus size={15} />}
        disabled={rubric.length >= 10}
        onClick={() => onChange([...rubric, { nameAr: '', nameEn: '', weight: 0 }])}
      >
        {t.program.addCriterion}
      </Button>
    </div>
  );
}

/* ─────────────────────────── Detail ─────────────────────────── */

function ProgramDetail({
  state,
  program,
  onClose,
}: {
  state: AppState;
  program: ProgramState;
  onClose: () => void;
}) {
  const { locale, t, run, busy } = useApp();
  const [tab, setTab] = useState<'overview' | 'applications' | 'activities' | 'indicators'>(
    'overview',
  );
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [edit, setEdit] = useState({
    nameAr: program.nameAr,
    nameEn: program.nameEn,
    capacity: String(program.capacity),
    registrationEnd: program.registrationEnd.slice(0, 10),
    endsAt: program.endsAt.slice(0, 10),
    reason: '',
  });

  const canManage = ['Admin', 'Manager'].includes(state.actor.role);
  const canEdit = canManage && !['Completed', 'Archived', 'Cancelled'].includes(program.status);
  const name = (item: { nameAr: string; nameEn: string }) =>
    locale === 'ar' ? item.nameAr : item.nameEn;

  const applications = state.applications.filter((item) => item.programId === program.id);
  const enrolled = applications.filter(
    (item) => item.enrollment && !['Withdrawn', 'Cancelled'].includes(item.enrollment.status),
  ).length;
  const nextStates = transitions[program.status] ?? [];
  const indicators = state.indicators.filter((item) => item.programId === program.id);
  // FR-008: the same gate the server applies, shown before the manager tries to publish
  const blockers = publishBlockers(program, program.ownerActive);
  const readiness: { key: PublishBlocker; label: string }[] = [
    { key: 'form', label: t.program.readyForm },
    { key: 'rubric', label: t.program.readyRubric },
    { key: 'privacy', label: t.program.readyPrivacy },
    { key: 'owner', label: t.program.readyOwner },
  ];
  const publishBlocked = target === 'Published' && blockers.length > 0;

  async function transition() {
    if (!target) return;
    const result = await run('program.transition', {
      programId: program.id,
      to: target,
      version: program.version,
      ...(target === 'Cancelled' ? { reason } : {}),
    });
    if (result) {
      setTarget('');
      setReason('');
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={name(program)}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={program.status}
            label={t.statuses[program.status as keyof typeof t.statuses] ?? program.status}
          />
          <span className="text-[12px] text-[var(--text-faint)]">
            {formatDate(program.startsAt, locale)} · {formatDate(program.endsAt, locale)}
          </span>
        </span>
      }
      size="xl"
    >
      {preview ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-copper-200 bg-copper-100 px-4 py-3 text-[13px] text-copper-700">
            <span className="flex items-center gap-2 font-semibold">
              <Eye size={15} />
              {t.program.previewNote}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPreview(false)}>
              {t.program.previewBack}
            </Button>
          </div>
          <ProgramPreview program={program} />
        </div>
      ) : (
      <>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: t.program.detailTabs.overview },
          { value: 'applications', label: t.program.detailTabs.applications, count: applications.length },
          { value: 'activities', label: t.program.detailTabs.activities, count: program.activities.length },
          { value: 'indicators', label: t.program.detailTabs.indicators, count: indicators.length },
        ]}
      />

      <div className="mt-5 space-y-5">
        {tab === 'overview' ? (
          <>
            <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
              {locale === 'ar' ? program.descriptionAr : program.descriptionEn}
            </p>

            <DataList
              items={[
                {
                  label: t.program.seats,
                  value: (
                    <Fraction
                      used={formatNumber(enrolled, locale)}
                      total={formatNumber(program.capacity, locale)}
                    />
                  ),
                },
                {
                  label: t.program.registration,
                  value: `${formatDate(program.registrationStart, locale)} · ${formatDate(program.registrationEnd, locale)}`,
                },
                {
                  label: t.program.threshold,
                  value: formatPercent(program.completionThreshold, locale),
                },
                {
                  label: t.program.requireEndline,
                  value: program.requireEndline ? t.common.yes : t.common.no,
                },
              ]}
            />

            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                {t.program.rubric}
              </p>
              <ul className="space-y-1.5">
                {program.rubric.map((criterion, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate">{name(criterion)}</span>
                    <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                      {formatNumber(criterion.weight, locale)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {canEdit ? (
              <div className="rounded-xl border border-[var(--line-soft)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold">{t.program.edit}</p>
                  <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                    {t.common.edit}
                  </Button>
                </div>
                {editing ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label={t.program.nameAr} required>
                      <Input value={edit.nameAr} onChange={(e) => setEdit((c) => ({ ...c, nameAr: e.target.value }))} />
                    </Field>
                    <Field label={t.program.nameEn} required>
                      <Input value={edit.nameEn} onChange={(e) => setEdit((c) => ({ ...c, nameEn: e.target.value }))} />
                    </Field>
                    <Field label={t.program.capacity} required>
                      <Input type="number" min={1} value={edit.capacity} onChange={(e) => setEdit((c) => ({ ...c, capacity: e.target.value }))} />
                    </Field>
                    <Field label={t.program.regEnd} required>
                      <Input type="date" value={edit.registrationEnd} onChange={(e) => setEdit((c) => ({ ...c, registrationEnd: e.target.value }))} />
                    </Field>
                    <Field label={t.program.ends} required>
                      <Input type="date" value={edit.endsAt} onChange={(e) => setEdit((c) => ({ ...c, endsAt: e.target.value }))} />
                    </Field>
                    <Field label={t.common.reason} required hint={t.program.editHint}>
                      <Input value={edit.reason} onChange={(e) => setEdit((c) => ({ ...c, reason: e.target.value }))} />
                    </Field>
                    <div className="flex justify-end sm:col-span-2">
                      <Button
                        loading={busy}
                        disabled={edit.reason.trim().length < 3 || edit.nameAr.trim().length < 3 || edit.nameEn.trim().length < 3}
                        onClick={async () => {
                          const result = await run('program.update', {
                            programId: program.id,
                            version: program.version,
                            nameAr: edit.nameAr.trim(),
                            nameEn: edit.nameEn.trim(),
                            capacity: Number(edit.capacity),
                            registrationEnd: new Date(`${edit.registrationEnd}T23:59:00`).toISOString(),
                            endsAt: new Date(`${edit.endsAt}T23:59:00`).toISOString(),
                            reason: edit.reason.trim(),
                          });
                          if (result) setEditing(false);
                        }}
                      >
                        {t.common.save}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {canManage ? (
              <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-[13px] font-semibold">
                    <ClipboardCheck size={15} className="text-copper-600" />
                    {t.program.readiness}
                  </p>
                  <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => setPreview(true)}>
                    {t.program.preview}
                  </Button>
                </div>
                {program.status === 'Draft' ? (
                  <>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {readiness.map((item) => {
                        const ok = !blockers.includes(item.key);
                        return (
                          <li key={item.key} className="flex items-center gap-2 text-[13px]">
                            {ok ? (
                              <CheckCircle2 size={15} className="shrink-0 text-positive" aria-hidden />
                            ) : (
                              <XCircle size={15} className="shrink-0 text-critical" aria-hidden />
                            )}
                            <span className={ok ? '' : 'text-[var(--text-strong)]'}>{item.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className={cx('mt-3 text-[12.5px]', blockers.length ? 'text-critical' : 'text-positive')}>
                      {blockers.length ? t.program.readinessBlocked : t.program.readinessOk}
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}

            {canManage && nextStates.length ? (
              <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] p-4">
                <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
                  <ArrowRightLeft size={15} className="text-copper-600" />
                  {t.program.transition}
                </p>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Select
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    aria-label={t.program.transitionTo}
                  >
                    <option value="">{t.program.transitionTo}</option>
                    {nextStates.map((status) => (
                      <option key={status} value={status}>
                        {t.statuses[status as keyof typeof t.statuses] ?? status}
                      </option>
                    ))}
                  </Select>
                  <Button
                    onClick={transition}
                    disabled={!target || (target === 'Cancelled' && reason.trim().length < 3) || publishBlocked}
                    loading={busy}
                  >
                    {t.common.confirm}
                  </Button>
                  {publishBlocked ? (
                    <p className="text-[12.5px] text-critical sm:col-span-2">{t.program.readinessBlocked}</p>
                  ) : null}
                  {target === 'Cancelled' ? (
                    <div className="sm:col-span-2">
                      <Field label={t.common.reason} required>
                        <Textarea
                          rows={2}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === 'applications' ? (
          applications.length === 0 ? (
            <EmptyState title={t.application.noApplications} hint={t.common.emptyHint} />
          ) : (
            <ul className="divide-y divide-[var(--line-soft)]">
              {applications.map((application) => (
                <li key={application.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {application.beneficiary.name}
                    </span>
                    <span className="block text-[11.5px] text-[var(--text-faint)]">
                      {formatDate(application.submittedAt ?? application.createdAt, locale)}
                    </span>
                  </span>
                  <StatusBadge
                    status={application.status}
                    label={
                      t.statuses[application.status as keyof typeof t.statuses] ?? application.status
                    }
                  />
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === 'activities' ? (
          program.activities.length === 0 ? (
            <EmptyState
              title={t.activity.noActivities}
              hint={t.common.emptyHint}
              icon={<CalendarCheck size={19} />}
            />
          ) : (
            <ul className="divide-y divide-[var(--line-soft)]">
              {program.activities.map((activity) => (
                <li key={activity.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{name(activity)}</span>
                    <span className="block text-[11.5px] text-[var(--text-faint)]">
                      {formatDate(activity.startsAt, locale)} · {activity.location}
                    </span>
                  </span>
                  {activity.required ? <Badge tone="accent">{t.common.required}</Badge> : null}
                  <StatusBadge
                    status={activity.status}
                    label={t.statuses[activity.status as keyof typeof t.statuses] ?? activity.status}
                  />
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === 'indicators' ? (
          indicators.length === 0 ? (
            <EmptyState
              title={t.impact.noIndicators}
              hint={t.common.emptyHint}
              icon={<Target size={19} />}
            />
          ) : (
            <ul className="divide-y divide-[var(--line-soft)]">
              {indicators.map((indicator) => (
                <li key={indicator.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{name(indicator)}</span>
                  <span className="shrink-0 text-[12px] text-[var(--text-muted)]">
                    {t.impact.target}: {formatNumber(indicator.target, locale, 1)} {indicator.unit}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
      </>
      )}
    </Modal>
  );
}

/* ─────────────────────────── Preview (FR-008) ─────────────────────────── */

/**
 * The program page as an applicant would see it. Every control is inside a
 * disabled fieldset, so the preview can never create a draft or send an
 * application, whatever state the program is in.
 */
function ProgramPreview({ program }: { program: ProgramState }) {
  const { locale, t } = useApp();
  const name = (item: { nameAr: string; nameEn: string }) => (locale === 'ar' ? item.nameAr : item.nameEn);
  const label = (field: FormField) => (locale === 'ar' ? field.labelAr : field.labelEn);
  return (
    <div className="mx-auto max-w-2xl space-y-5" data-testid="program-preview">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={program.status}
            label={
              program.status === 'Draft'
                ? t.program.previewDraftBadge
                : t.statuses[program.status as keyof typeof t.statuses] ?? program.status
            }
          />
          <span className="text-[12px] text-[var(--text-faint)]">
            {formatDate(program.startsAt, locale)} · {formatDate(program.endsAt, locale)}
          </span>
        </div>
        <h3 className="text-[1.35rem] leading-tight">{name(program)}</h3>
        <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          {locale === 'ar' ? program.descriptionAr : program.descriptionEn}
        </p>
      </div>

      <DataList
        items={[
          { label: t.program.registration, value: `${formatDate(program.registrationStart, locale)} · ${formatDate(program.registrationEnd, locale)}` },
          { label: t.program.seats, value: formatNumber(program.capacity, locale) },
        ]}
      />

      <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] p-4">
        <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          {locale === 'ar' ? t.program.privacyAr : t.program.privacyEn}
        </p>
        <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
          {(locale === 'ar' ? program.privacyAr : program.privacyEn) || t.common.none}
        </p>
      </div>

      <fieldset disabled className="space-y-4 opacity-90">
        <legend className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          {t.program.form}
        </legend>
        {program.form.length === 0 ? (
          <p className="text-[13px] text-critical">{t.program.readyForm}</p>
        ) : null}
        {program.form.map((field) => (
          <Field key={field.id} label={label(field)} required={field.required}>
            {field.type === 'attachment' ? (
              <div className="rounded-[10px] border border-dashed border-[var(--line-strong)] px-3 py-3 text-[13px] text-[var(--text-muted)]">
                {t.program.previewAttachment}
              </div>
            ) : field.type === 'multiselect' ? (
              <div className="space-y-2">
                {(field.options ?? []).map((option) => (
                  <Checkbox key={option} label={option} readOnly checked={false} />
                ))}
              </div>
            ) : field.type === 'textarea' ? (
              <Textarea rows={3} value="" readOnly />
            ) : field.type === 'select' ? (
              <Select value="" onChange={() => undefined}>
                <option value="">{t.common.none}</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            ) : (
              <Input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} value="" readOnly />
            )}
          </Field>
        ))}
        <Checkbox label={t.program.previewConsent} readOnly checked={false} />
        <div className="flex justify-end">
          <Button disabled>{t.program.apply}</Button>
        </div>
      </fieldset>
    </div>
  );
}
