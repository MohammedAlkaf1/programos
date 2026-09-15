'use client';

import { useMemo, useState } from 'react';
import { Download, Printer, FileDown, Camera } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SectionHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
  Fraction,
} from '@/components/ui';
import { BarList, ChangeValue } from '@/components/charts';
import { useApp } from '@/components/app-provider';
import { formatDateTime, formatNumber, formatPercent, relativeDays } from '@/lib/format';
import type { AppState, KpiState, IndicatorResult } from '@/lib/types';

const FUNNEL = ['Submitted', 'UnderReview', 'Accepted', 'Rejected', 'Withdrawn'] as const;
const EXPORTS = ['programs', 'applications', 'attendance', 'impact'] as const;
const EXPORT_ROLES: Record<(typeof EXPORTS)[number], string[]> = {
  programs: ['Admin', 'Manager', 'Impact', 'Viewer'],
  applications: ['Admin', 'Manager', 'Coordinator'],
  attendance: ['Admin', 'Manager', 'Coordinator'],
  impact: ['Admin', 'Manager', 'Impact', 'Viewer'],
};

type SnapshotData = {
  formulaVersion?: string;
  generatedAt?: string;
  cutoffAt?: string;
  filters?: { programId?: string | null };
  recordCount?: number;
  missing?: number;
  totals?: AppState['totals'];
  kpis?: Record<string, KpiState>;
  indicators?: IndicatorResult[];
};

export function ReportsView({ state }: { state: AppState }) {
  const { locale, t, run, busy } = useApp();
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [scope, setScope] = useState('all');
  const [title, setTitle] = useState('');
  const [cutoff, setCutoff] = useState('');
  const name = (item: { nameAr: string; nameEn: string }) =>
    locale === 'ar' ? item.nameAr : item.nameEn;
  const programName = (id: string | null | undefined) => {
    const program = state.programs.find((item) => item.id === id);
    return program ? name(program) : t.report.allPrograms;
  };

  const performance = useMemo(
    () =>
      state.programs.map((program) => {
        const applications = state.applications.filter((item) => item.programId === program.id);
        const enrolled = applications.filter(
          (item) =>
            item.enrollment && !['Withdrawn', 'Cancelled'].includes(item.enrollment.status),
        );
        const required = program.activities.filter(
          (activity) => activity.required && activity.status !== 'Cancelled',
        );
        let slots = 0;
        let present = 0;
        for (const item of enrolled) {
          for (const activity of required) {
            const entry = item.enrollment?.attendance.find((a) => a.activityId === activity.id);
            if (entry?.status === 'Excused') continue;
            slots += 1;
            if (entry?.status === 'Present') present += 1;
          }
        }
        return { program, kpi: state.kpis[program.id], attendance: slots ? (present / slots) * 100 : null };
      }),
    [state.programs, state.applications, state.kpis],
  );

  const funnel = useMemo(
    () =>
      FUNNEL.map((stage) => ({
        key: stage,
        label: t.statuses[stage],
        value: state.applications.filter((item) => item.status === stage).length,
      })),
    [state.applications, t],
  );

  const selected = state.snapshots.find((s) => s.id === snapshot);
  const selectedData = (selected?.data ?? null) as SnapshotData | null;

  async function requestExport(type: (typeof EXPORTS)[number]) {
    const result = (await run('export.request', {
      type,
      locale,
      ...(scope !== 'all' ? { programId: scope } : {}),
    })) as { href?: string } | null;
    if (result?.href) window.location.assign(result.href);
  }

  return (
    <>
      <PageHeader
        title={t.report.title}
        subtitle={`${t.report.subtitle} · ${t.common.asOf} ${formatDateTime(state.asOf, locale)}`}
        action={
          <Button variant="ghost" icon={<Printer size={15} />} onClick={() => window.print()}>
            {t.report.print}
          </Button>
        }
      />

      <div className="grid gap-4">
        <Card>
          <SectionHeader title={t.report.exports} hint={t.report.exportsHint} />
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(12rem,auto)_1fr]">
            <Field label={t.report.scope}>
              <Select value={scope} onChange={(event) => setScope(event.target.value)}>
                <option value="all">{t.report.allPrograms}</option>
                {state.programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {name(program)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap items-end gap-2">
              {EXPORTS.filter((type) => EXPORT_ROLES[type].includes(state.actor.role)).map((type) => (
                <Button
                  key={type}
                  variant="ghost"
                  icon={<FileDown size={14} />}
                  loading={busy}
                  onClick={() => requestExport(type)}
                >
                  {t.report.exportTypes[type]}
                </Button>
              ))}
            </div>
          </div>
          {state.exports.length ? (
            <Table className="mt-4">
              <thead>
                <tr>
                  <Th>{t.common.date}</Th>
                  <Th>{t.report.scope}</Th>
                  <Th>{t.common.status}</Th>
                  <Th>{t.report.records}</Th>
                  <Th>{t.common.expires}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {state.exports.map((job) => {
                  const minutes = Math.max(0, Math.round((new Date(job.expiresAt).getTime() - Date.now()) / 60000));
                  const live = job.status === 'Ready' && minutes > 0;
                  return (
                    <Tr key={job.id}>
                      <Td className="whitespace-nowrap text-[12.5px]">{formatDateTime(job.createdAt, locale)}</Td>
                      <Td className="text-[12.5px]">
                        {job.type === 'subject'
                          ? t.privacy.types.Copy
                          : `${t.report.exportTypes[job.type as (typeof EXPORTS)[number]] ?? job.type} · ${programName(job.filters?.programId)}`}
                      </Td>
                      <Td>
                        <StatusBadge
                          status={live ? job.status : job.status === 'Ready' ? 'Expired' : job.status}
                          label={t.statuses[(live ? job.status : job.status === 'Ready' ? 'Expired' : job.status) as keyof typeof t.statuses] ?? job.status}
                        />
                      </Td>
                      <Td className="tabular-nums">{formatNumber(job.rows, locale)}</Td>
                      <Td className="tabular-nums text-[12.5px]">{live ? `${minutes} ${locale === 'ar' ? 'دقيقة' : 'min'}` : '…'}</Td>
                      <Td>
                        {live ? (
                          <a className="inline-flex items-center gap-1 text-[12.5px] font-medium text-copper-700 hover:underline" href={`/api/export?job=${job.id}`}>
                            <Download size={13} /> {t.common.download}
                          </a>
                        ) : null}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          ) : null}
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <SectionHeader title={t.report.kpis} hint={t.report.definitions.acceptanceRate} />
          </div>
          {performance.length === 0 ? (
            <EmptyState title={t.program.noPrograms} hint={t.common.emptyHint} />
          ) : (
            <Table className="mt-3">
              <thead>
                <tr>
                  <Th>{t.common.program}</Th>
                  <Th>{t.dash.kpiApplications}</Th>
                  <Th>{t.report.pendingDecision}</Th>
                  <Th>{t.report.acceptanceRate}</Th>
                  <Th>{t.report.decisionHours}</Th>
                  <Th>{t.dash.kpiEnrolled}</Th>
                  <Th>{t.report.fill}</Th>
                  <Th>{t.dash.kpiCompletionRate}</Th>
                  <Th>{t.activity.rate}</Th>
                </tr>
              </thead>
              <tbody>
                {performance.map(({ program, kpi, attendance }) => (
                  <Tr key={program.id}>
                    <Td className="max-w-[16rem]">
                      <span className="block truncate text-[13.5px] font-medium">{name(program)}</span>
                      <span className="block text-[11.5px] text-[var(--text-faint)]">
                        {t.statuses[program.status as keyof typeof t.statuses] ?? program.status}
                      </span>
                    </Td>
                    <Td className="tabular-nums">{formatNumber(kpi?.submitted ?? 0, locale)}</Td>
                    <Td className="tabular-nums">{formatNumber(kpi?.pending ?? 0, locale)}</Td>
                    <Td className="tabular-nums">{formatPercent(kpi?.acceptanceRate, locale, 1)}</Td>
                    <Td className="tabular-nums">{kpi?.decisionHours === null || kpi?.decisionHours === undefined ? t.common.notApplicable : formatNumber(kpi.decisionHours, locale, 1)}</Td>
                    <Td>
                      <Fraction used={formatNumber(kpi?.occupied ?? 0, locale)} total={formatNumber(program.capacity, locale)} />
                    </Td>
                    <Td className="tabular-nums">{formatPercent(kpi?.fill, locale)}</Td>
                    <Td className="tabular-nums">{formatPercent(kpi?.completionRate, locale)}</Td>
                    <Td className="tabular-nums">{formatPercent(attendance, locale)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
          <p className="px-5 pb-4 pt-3 text-[11.5px] text-[var(--text-faint)]">
            {t.common.notApplicable}: {t.common.notApplicableHint}. {t.report.definitions.completionRate}.
          </p>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionHeader title={t.report.applicationFunnel} hint={t.dash.pipelineHint} />
            <div className="mt-5">
              <BarList data={funnel} emptyLabel={t.common.empty} />
            </div>
          </Card>

          <Card padded={false}>
            <div className="px-5 pt-5">
              <SectionHeader title={t.report.impactReport} hint={t.report.definitions.change} />
            </div>
            {state.indicators.length === 0 ? (
              <EmptyState title={t.impact.noIndicators} hint={t.common.emptyHint} />
            ) : (
              <ul className="mt-3 divide-y divide-[var(--line-soft)]">
                {state.indicators.map((indicator) => (
                  <li key={indicator.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]">{name(indicator)}</span>
                      <span className="block text-[11.5px] text-[var(--text-faint)]">
                        {t.impact.pairs}: {formatNumber(indicator.pairs, locale)} · {t.impact.coverage}: {formatPercent(indicator.coverage, locale)}
                        {indicator.achievement?.percent !== null && indicator.achievement?.percent !== undefined
                          ? ` · ${t.impact.achievement}: ${formatPercent(indicator.achievement.percent, locale)}`
                          : indicator.achievement?.gap !== null && indicator.achievement?.gap !== undefined
                            ? ` · ${t.impact.gap}: ${formatNumber(indicator.achievement.gap, locale, 1)} ${indicator.unit}`
                            : ''}
                      </span>
                    </span>
                    <ChangeValue value={indicator.change} direction={indicator.direction} unit={indicator.unit} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {['Admin', 'Manager', 'Impact', 'Viewer'].includes(state.actor.role) ? (
          <Card>
            <SectionHeader title={t.report.savedReports} />
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <Field label={t.report.snapshotTitle} required>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </Field>
              <Field label={t.report.scope}>
                <Select value={scope} onChange={(event) => setScope(event.target.value)}>
                  <option value="all">{t.report.allPrograms}</option>
                  {state.programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {name(program)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.report.cutoff}>
                <Input type="date" value={cutoff} onChange={(event) => setCutoff(event.target.value)} />
              </Field>
              <div className="flex items-end">
                <Button
                  icon={<Camera size={15} />}
                  loading={busy}
                  disabled={title.trim().length < 3}
                  onClick={async () => {
                    const result = await run('report.snapshot', {
                      title: title.trim(),
                      ...(scope !== 'all' ? { programId: scope } : {}),
                      ...(cutoff ? { cutoffAt: new Date(`${cutoff}T23:59:59`).toISOString() } : {}),
                    });
                    if (result) setTitle('');
                  }}
                >
                  {t.report.saveSnapshot}
                </Button>
              </div>
            </div>

            <div className="mt-5">
              <Select aria-label={t.report.savedReports} value={snapshot ?? ''} onChange={(event) => setSnapshot(event.target.value || null)}>
                <option value="">{t.report.selectSaved}</option>
                {state.snapshots.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {formatDateTime(item.createdAt, locale)}
                  </option>
                ))}
              </Select>
            </div>

            {selected && selectedData ? (
              <div className="mt-4 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] p-4">
                <div className="flex flex-wrap gap-2 text-[12px] text-[var(--text-muted)]">
                  <Badge tone="neutral">{t.report.formulaVersion} {selectedData.formulaVersion ?? '1'}</Badge>
                  <Badge tone="neutral">{t.report.cutoff}: {formatDateTime(selectedData.cutoffAt ?? selectedData.generatedAt, locale)}</Badge>
                  <Badge tone="neutral">{t.report.scope}: {programName(selectedData.filters?.programId)}</Badge>
                  <Badge tone="neutral">{t.report.records}: {formatNumber(selectedData.recordCount ?? selectedData.totals?.applications ?? 0, locale)}</Badge>
                  {selectedData.missing ? <Badge tone="caution">{t.report.missing}: {formatNumber(selectedData.missing, locale)}</Badge> : null}
                  {relativeDays(selected.createdAt) !== null ? <Badge tone="neutral">{t.report.generatedAt}: {formatDateTime(selected.createdAt, locale)}</Badge> : null}
                </div>
                {selectedData.kpis ? (
                  <Table className="mt-3">
                    <thead>
                      <tr>
                        <Th>{t.common.program}</Th>
                        <Th>{t.dash.kpiApplications}</Th>
                        <Th>{t.report.acceptanceRate}</Th>
                        <Th>{t.report.decisionHours}</Th>
                        <Th>{t.report.fill}</Th>
                        <Th>{t.dash.kpiCompletionRate}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedData.kpis).map(([programId, kpi]) => (
                        <Tr key={programId}>
                          <Td className="text-[13px]">{programName(programId)}</Td>
                          <Td className="tabular-nums">{formatNumber(kpi.submitted, locale)}</Td>
                          <Td className="tabular-nums">{formatPercent(kpi.acceptanceRate, locale, 1)}</Td>
                          <Td className="tabular-nums">{kpi.decisionHours === null ? t.common.notApplicable : formatNumber(kpi.decisionHours, locale, 1)}</Td>
                          <Td className="tabular-nums">{formatPercent(kpi.fill, locale)}</Td>
                          <Td className="tabular-nums">{formatPercent(kpi.completionRate, locale)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                ) : null}
                <ul className="mt-3 space-y-1.5 text-[13px]">
                  {(selectedData.indicators ?? []).map((indicator) => (
                    <li key={indicator.id} className="flex items-center justify-between gap-3">
                      <span className="truncate">{name(indicator)}</span>
                      <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                        {indicator.change === null || indicator.change === undefined ? t.common.notApplicable : `${formatNumber(indicator.change, locale, 2)} ${indicator.unit}`} · {t.impact.pairs} {formatNumber(indicator.pairs, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </>
  );
}
