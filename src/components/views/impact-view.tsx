'use client';

import { useMemo, useState } from 'react';
import { Target, Plus, ShieldCheck, Undo2, Info } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  SectionHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
  cx,
} from '@/components/ui';
import { ChangeBar, ChangeValue } from '@/components/charts';
import { useApp } from '@/components/app-provider';
import { formatNumber, formatPercent } from '@/lib/format';
import type { AppState, IndicatorResult, MeasurementState, ProgramState } from '@/lib/types';

export function ImpactView({ state }: { state: AppState }) {
  const { locale, t } = useApp();
  const [creating, setCreating] = useState(false);
  const [recording, setRecording] = useState<IndicatorResult | null>(null);

  const name = (item: { nameAr: string; nameEn: string }) =>
    locale === 'ar' ? item.nameAr : item.nameEn;

  const canDefine = ['Admin', 'Manager', 'Impact'].includes(state.actor.role);
  const canRecord = ['Admin', 'Manager', 'Coordinator', 'Impact'].includes(state.actor.role);
  const canVerify = ['Admin', 'Impact'].includes(state.actor.role);
  const isViewer = state.actor.role === 'Viewer';

  /** Every measurement in scope, keyed for lookup by indicator. */
  const measurements = useMemo(() => {
    const map = new Map<string, MeasurementState[]>();
    for (const application of state.applications) {
      for (const measurement of application.enrollment?.measurements ?? []) {
        const list = map.get(measurement.indicatorId) ?? [];
        list.push(measurement);
        map.set(measurement.indicatorId, list);
      }
    }
    return map;
  }, [state.applications]);

  const pending = useMemo(
    () =>
      [...measurements.values()]
        .flat()
        .filter((measurement) => measurement.status === 'Draft'),
    [measurements],
  );

  const programOf = (programId: string) => state.programs.find((item) => item.id === programId);

  return (
    <>
      <PageHeader
        title={t.impact.title}
        subtitle={t.impact.subtitle}
        action={
          canDefine ? (
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              {t.impact.create}
            </Button>
          ) : null
        }
      />

      {isViewer ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-info-soft px-4 py-3 text-[12.5px] text-info">
          <Info size={15} className="mt-px shrink-0" />
          {t.impact.suppressedHint}
        </div>
      ) : null}

      {state.indicators.length === 0 ? (
        <Card>
          <EmptyState
            title={t.impact.noIndicators}
            hint={t.common.emptyHint}
            icon={<Target size={19} />}
            action={
              canDefine ? (
                <Button size="sm" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
                  {t.impact.create}
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {state.indicators.map((indicator) => {
            const program = programOf(indicator.programId);
            const rows = measurements.get(indicator.id) ?? [];
            const verified = rows.filter((row) => row.status === 'Verified');
            const baselineAvg = average(verified.filter((row) => row.period === 'Baseline'));
            const endlineAvg = average(verified.filter((row) => row.period === 'Endline'));
            const suppressed = indicator.change === null && indicator.pairs > 0;

            return (
              <Card key={indicator.id}>
                <SectionHeader
                  title={name(indicator)}
                  hint={program ? name(program) : undefined}
                  action={
                    canRecord ? (
                      <Button size="sm" variant="ghost" onClick={() => setRecording(indicator)}>
                        {t.impact.record}
                      </Button>
                    ) : null
                  }
                />

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div>
                    <p className="text-[11.5px] text-[var(--text-faint)]">{t.impact.change}</p>
                    <div className="mt-0.5">
                      {suppressed ? (
                        <Badge tone="neutral">{t.impact.suppressed}</Badge>
                      ) : (
                        <ChangeValue
                          value={indicator.change}
                          direction={indicator.direction}
                          unit={indicator.unit}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11.5px] text-[var(--text-faint)]">{t.impact.pairs}</p>
                    <p className="mt-0.5 text-[13.5px] font-semibold tabular-nums">
                      {formatNumber(indicator.pairs, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11.5px] text-[var(--text-faint)]">{t.impact.coverage}</p>
                    <p className="mt-0.5 text-[13.5px] font-semibold tabular-nums">
                      {indicator.coverage === null
                        ? '…'
                        : formatPercent(indicator.coverage, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11.5px] text-[var(--text-faint)]">{t.impact.target}</p>
                    <p className="mt-0.5 text-[13.5px] font-semibold tabular-nums">
                      {formatNumber(indicator.target, locale, 1)} {indicator.unit}
                    </p>
                  </div>
                </div>

                {baselineAvg !== null && endlineAvg !== null ? (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-baseline justify-between text-[11.5px]">
                      <span className="text-[var(--text-faint)]">
                        {t.impact.baseline}: {formatNumber(baselineAvg, locale, 1)}
                      </span>
                      <span className="text-[var(--text-faint)]">
                        {t.impact.endline}: {formatNumber(endlineAvg, locale, 1)}
                      </span>
                    </div>
                    <ChangeBar
                      baseline={baselineAvg}
                      endline={endlineAvg}
                      direction={indicator.direction}
                    />
                  </div>
                ) : null}

                <p className="mt-3 text-[11.5px] text-[var(--text-faint)]">
                  {t.impact.direction}:{' '}
                  {indicator.direction === 'Higher' ? t.impact.higher : t.impact.lower}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Verification queue */}
      {canVerify && pending.length ? (
        <Card className="mt-4" padded={false}>
          <div className="px-5 pt-5">
            <SectionHeader
              title={t.impact.pendingVerification}
              hint={`${formatNumber(pending.length, locale)}`}
            />
          </div>
          <Table className="mt-3">
            <thead>
              <tr>
                <Th>{t.impact.title}</Th>
                <Th>{t.impact.baseline}/{t.impact.endline}</Th>
                <Th>{t.impact.value}</Th>
                <Th>{t.impact.source}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {pending.map((measurement) => {
                const indicator = state.indicators.find(
                  (item) => item.id === measurement.indicatorId,
                );
                return (
                  <VerifyRow
                    key={measurement.id}
                    measurement={measurement}
                    label={indicator ? name(indicator) : '…'}
                    unit={indicator?.unit ?? ''}
                  />
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {creating ? <CreateIndicatorModal state={state} onClose={() => setCreating(false)} /> : null}
      {recording ? (
        <RecordMeasurementModal
          state={state}
          indicator={recording}
          onClose={() => setRecording(null)}
        />
      ) : null}
    </>
  );
}

function average(rows: MeasurementState[]) {
  if (!rows.length) return null;
  return rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
}

function VerifyRow({
  measurement,
  label,
  unit,
}: {
  measurement: MeasurementState;
  label: string;
  unit: string;
}) {
  const { locale, t, run, busy } = useApp();
  return (
    <Tr>
      <Td className="text-[13px]">{label}</Td>
      <Td>
        <Badge tone={measurement.period === 'Baseline' ? 'neutral' : 'accent'}>
          {measurement.period === 'Baseline' ? t.impact.baseline : t.impact.endline}
        </Badge>
      </Td>
      <Td className="tabular-nums">
        {formatNumber(measurement.value, locale, 1)} {unit}
      </Td>
      <Td className="max-w-[16rem] truncate text-[12.5px] text-[var(--text-muted)]">
        {measurement.source}
      </Td>
      <Td>
        <span className="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon={<Undo2 size={14} />}
            loading={busy}
            onClick={() => run('measurement.verify', { id: measurement.id, to: 'Returned' })}
          >
            {t.impact.return}
          </Button>
          <Button
            size="sm"
            icon={<ShieldCheck size={14} />}
            loading={busy}
            onClick={() => run('measurement.verify', { id: measurement.id, to: 'Verified' })}
          >
            {t.impact.verify}
          </Button>
        </span>
      </Td>
    </Tr>
  );
}

function CreateIndicatorModal({ state, onClose }: { state: AppState; onClose: () => void }) {
  const { locale, t, run, busy } = useApp();
  const eligible = state.programs.filter(
    (program) => !['Archived', 'Completed', 'Cancelled'].includes(program.status),
  );
  const [draft, setDraft] = useState({
    programId: eligible[0]?.id ?? '',
    nameAr: '',
    nameEn: '',
    unit: '',
    target: '0',
    direction: 'Higher' as 'Higher' | 'Lower',
    aggregation: 'average' as 'average' | 'sum' | 'count' | 'percentage',
    source: '',
    period: '',
  });

  const valid =
    draft.programId && draft.nameAr.trim() && draft.nameEn.trim() && draft.unit.trim() && draft.source.trim();

  return (
    <Modal
      open
      onClose={onClose}
      title={t.impact.create}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            loading={busy}
            disabled={!valid}
            onClick={async () => {
              const result = await run('indicator.create', {
                programId: draft.programId,
                nameAr: draft.nameAr.trim(),
                nameEn: draft.nameEn.trim(),
                unit: draft.unit.trim(),
                target: Number(draft.target),
                direction: draft.direction,
                aggregation: draft.aggregation,
                source: draft.source.trim(),
                period: draft.period.trim(),
              });
              if (result) onClose();
            }}
          >
            {t.common.create}
          </Button>
        </>
      }
    >
      {eligible.length === 0 ? (
        <p className="text-[13px] text-[var(--text-faint)]">{t.program.noPrograms}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.common.program} required className="sm:col-span-2">
            <Select
              value={draft.programId}
              onChange={(event) => setDraft((c) => ({ ...c, programId: event.target.value }))}
            >
              {eligible.map((program) => (
                <option key={program.id} value={program.id}>
                  {locale === 'ar' ? program.nameAr : program.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.impact.nameAr} required>
            <Input
              dir="rtl"
              value={draft.nameAr}
              onChange={(event) => setDraft((c) => ({ ...c, nameAr: event.target.value }))}
            />
          </Field>
          <Field label={t.impact.nameEn} required>
            <Input
              dir="ltr"
              value={draft.nameEn}
              onChange={(event) => setDraft((c) => ({ ...c, nameEn: event.target.value }))}
            />
          </Field>
          <Field label={t.impact.unit} required>
            <Input
              value={draft.unit}
              onChange={(event) => setDraft((c) => ({ ...c, unit: event.target.value }))}
              placeholder={locale === 'ar' ? 'درجة' : 'points'}
            />
          </Field>
          <Field label={t.impact.target} required>
            <Input
              type="number"
              value={draft.target}
              onChange={(event) => setDraft((c) => ({ ...c, target: event.target.value }))}
            />
          </Field>
          <Field label={t.impact.direction} className="sm:col-span-2">
            <Select
              value={draft.direction}
              onChange={(event) =>
                setDraft((c) => ({ ...c, direction: event.target.value as 'Higher' | 'Lower' }))
              }
            >
              <option value="Higher">{t.impact.higher}</option>
              <option value="Lower">{t.impact.lower}</option>
            </Select>
          </Field>
        </div>
      )}
    </Modal>
  );
}

function RecordMeasurementModal({
  state,
  indicator,
  onClose,
}: {
  state: AppState;
  indicator: IndicatorResult;
  onClose: () => void;
}) {
  const { locale, t, run, busy } = useApp();
  const participants = state.applications.filter(
    (item) => item.programId === indicator.programId && item.enrollment,
  );
  const [draft, setDraft] = useState({
    enrollmentId: participants[0]?.enrollment?.id ?? '',
    period: 'Baseline' as 'Baseline' | 'Endline',
    value: '',
    source: '',
    measuredAt: new Date().toISOString().slice(0, 10),
    reason: '',
  });
  const existing = participants
    .find((item) => item.enrollment?.id === draft.enrollmentId)
    ?.enrollment?.measurements.find((m) => m.indicatorId === indicator.id && m.period === draft.period);
  const correcting = !!existing && (String(existing.value) !== draft.value.trim() || existing.source !== draft.source.trim());

  const valid =
    draft.enrollmentId &&
    draft.value.trim() !== '' &&
    draft.source.trim().length >= 3 &&
    !!draft.measuredAt &&
    (!correcting || draft.reason.trim().length >= 3);

  return (
    <Modal
      open
      onClose={onClose}
      title={t.impact.record}
      description={locale === 'ar' ? indicator.nameAr : indicator.nameEn}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            loading={busy}
            disabled={!valid}
            onClick={async () => {
              const result = await run('measurement.save', {
                indicatorId: indicator.id,
                enrollmentId: draft.enrollmentId,
                period: draft.period,
                value: Number(draft.value),
                source: draft.source.trim(),
                measuredAt: new Date(`${draft.measuredAt}T12:00:00`).toISOString(),
                ...(correcting ? { reason: draft.reason.trim() } : {}),
              });
              if (result) onClose();
            }}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      {participants.length === 0 ? (
        <p className="text-[13px] text-[var(--text-faint)]">{t.activity.participants}: 0</p>
      ) : (
        <div className="grid gap-4">
          <Field label={t.activity.participants} required>
            <Select
              value={draft.enrollmentId}
              onChange={(event) => setDraft((c) => ({ ...c, enrollmentId: event.target.value }))}
            >
              {participants.map((item) => (
                <option key={item.id} value={item.enrollment!.id}>
                  {item.beneficiary.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.program.period} required>
            <Select
              value={draft.period}
              onChange={(event) =>
                setDraft((c) => ({ ...c, period: event.target.value as 'Baseline' | 'Endline' }))
              }
            >
              <option value="Baseline">{t.impact.baseline}</option>
              <option value="Endline">{t.impact.endline}</option>
            </Select>
          </Field>
          <Field label={`${t.impact.value} (${indicator.unit})`} required>
            <Input
              type="number"
              step="any"
              value={draft.value}
              onChange={(event) => setDraft((c) => ({ ...c, value: event.target.value }))}
            />
          </Field>
          <Field label={t.impact.source} required>
            <Input
              value={draft.source}
              onChange={(event) => setDraft((c) => ({ ...c, source: event.target.value }))}
            />
          </Field>
          <Field label={t.impact.measuredAt} required>
            <Input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={draft.measuredAt}
              onChange={(event) => setDraft((c) => ({ ...c, measuredAt: event.target.value }))}
            />
          </Field>
          {existing ? (
            <Field label={t.impact.correctionReason} required={correcting} hint={`${t.impact.correctionHint} (${t.impact.revisionNo} ${existing.revision})`}>
              <Input
                value={draft.reason}
                onChange={(event) => setDraft((c) => ({ ...c, reason: event.target.value }))}
              />
            </Field>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
