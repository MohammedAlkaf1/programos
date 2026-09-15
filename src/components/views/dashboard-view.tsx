'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  FileText,
  GraduationCap,
  Target,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import { Badge, Card, EmptyState, SectionHeader, StatusBadge, cx } from '@/components/ui';
import { BarList, ChangeValue, Funnel, StatTile } from '@/components/charts';
import { useApp } from '@/components/app-provider';
import { formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format';
import type { AppState } from '@/lib/types';

const PIPELINE_STAGES = [
  'Submitted',
  'UnderReview',
  'NeedsInfo',
  'Waitlisted',
  'Accepted',
  'Rejected',
] as const;

export function DashboardView({ state }: { state: AppState }) {
  const { locale, t } = useApp();
  const base = `/${locale}`;
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  const name = (item: { nameAr: string; nameEn: string }) =>
    locale === 'ar' ? item.nameAr : item.nameEn;

  const pipeline = useMemo(
    () =>
      PIPELINE_STAGES.map((stage) => ({
        key: stage,
        label: t.statuses[stage],
        value: state.applications.filter((item) => item.status === stage).length,
      })),
    [state.applications, t],
  );

  const programStatuses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const program of state.programs) {
      counts.set(program.status, (counts.get(program.status) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([status, value]) => ({
        key: status,
        label: t.statuses[status as keyof typeof t.statuses] ?? status,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [state.programs, t]);

  const seatUsage = useMemo(
    () =>
      state.programs
        .filter((program) => !['Draft', 'Archived', 'Cancelled'].includes(program.status))
        .map((program) => {
          const filled = state.applications.filter(
            (item) =>
              item.programId === program.id &&
              item.enrollment &&
              !['Withdrawn', 'Cancelled'].includes(item.enrollment.status),
          ).length;
          return {
            key: program.id,
            label: name(program),
            value: program.capacity ? (filled / program.capacity) * 100 : 0,
            note: `${formatNumber(filled, locale)} / ${formatNumber(program.capacity, locale)} ${t.program.seats}`,
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    [state.programs, state.applications, locale, t],
  );

  const completionRate = state.totals.enrolled
    ? (state.totals.completed / state.totals.enrolled) * 100
    : 0;

  const pendingDecision = state.applications.filter((item) =>
    ['Submitted', 'UnderReview', 'NeedsInfo', 'Waitlisted'].includes(item.status),
  ).length;

  const upcoming = useMemo(
    () =>
      state.programs
        .flatMap((program) =>
          program.activities
            .filter(
              (activity) =>
                activity.status !== 'Cancelled' && new Date(activity.startsAt) >= new Date(),
            )
            .map((activity) => ({ activity, program })),
        )
        .sort((a, b) => a.activity.startsAt.localeCompare(b.activity.startsAt))
        .slice(0, 5),
    [state.programs],
  );

  const attention = useMemo(() => {
    const items: Array<{ key: string; label: string; count: number; href: string }> = [];
    const awaitingEvaluation = state.applications.filter(
      (item) => item.status === 'UnderReview' && item.evaluations.length === 0,
    ).length;
    if (awaitingEvaluation)
      items.push({
        key: 'review',
        label: t.dash.reviewQueue,
        count: awaitingEvaluation,
        href: `${base}/applications`,
      });

    const overdue = state.applications.filter(
      (item) => item.status === 'NeedsInfo' && item.infoDue && new Date(item.infoDue) < new Date(),
    ).length;
    if (overdue)
      items.push({
        key: 'info',
        label: t.dash.infoOverdue,
        count: overdue,
        href: `${base}/applications`,
      });

    const unverified = state.applications.reduce(
      (carry, item) =>
        carry + (item.enrollment?.measurements.filter((m) => m.status === 'Draft').length ?? 0),
      0,
    );
    if (unverified)
      items.push({
        key: 'measure',
        label: t.dash.unverified,
        count: unverified,
        href: `${base}/impact`,
      });

    const privacyDue = state.privacy.filter(
      (item) =>
        !['Rejected'].includes(item.status) &&
        new Date(item.dueAt).getTime() - Date.now() < 7 * 86_400_000,
    ).length;
    if (privacyDue)
      items.push({
        key: 'privacy',
        label: t.dash.privacyDue,
        count: privacyDue,
        href: `${base}/privacy`,
      });

    return items;
  }, [state, t, base]);

  const topIndicators = state.indicators.filter((item) => item.pairs > 0).slice(0, 5);
  const recent = state.applications.slice(0, 6);
  const isBeneficiary = state.actor.role === 'Beneficiary';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.dash.greeting}، {state.actor.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            {t.dash.subtitle}
            <Badge tone="accent">{t.roles[state.actor.role]}</Badge>
          </p>
        </div>
      </header>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t.dash.kpiPrograms}
          value={formatNumber(state.totals.programs, locale)}
          icon={<FolderKanban size={16} />}
          accent
        />
        <StatTile
          label={isBeneficiary ? t.application.myApplications : t.dash.kpiApplications}
          value={formatNumber(state.totals.applications, locale)}
          sub={
            pendingDecision
              ? `${formatNumber(pendingDecision, locale)} ${t.dash.kpiPending}`
              : undefined
          }
          icon={<FileText size={16} />}
        />
        <StatTile
          label={t.dash.kpiEnrolled}
          value={formatNumber(state.totals.enrolled, locale)}
          icon={<GraduationCap size={16} />}
        />
        <StatTile
          label={t.dash.kpiCompletionRate}
          value={formatPercent(completionRate, locale)}
          sub={`${formatNumber(state.totals.completed, locale)} ${t.dash.kpiCompleted}`}
          icon={<Target size={16} />}
          progress={completionRate}
        />
      </div>

      {/* Attention strip */}
      {!isBeneficiary ? (
        <Card>
          <SectionHeader title={t.dash.needsAttention} />
          {attention.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-[13px] text-positive">
              <CheckCircle2 size={16} />
              {t.dash.needsAttentionEmpty}
            </p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {attention.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-[10px] border border-[var(--line-soft)] px-3.5 py-3 transition-all hover:border-copper-600/40 hover:bg-[var(--surface-sunken)]"
                  >
                    <AlertCircle size={16} className="shrink-0 text-caution" />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
                    <span className="shrink-0 rounded-full bg-caution-soft px-2 py-0.5 text-[12px] font-semibold tabular-nums text-caution">
                      {formatNumber(item.count, locale)}
                    </span>
                    <Arrow size={14} className="shrink-0 text-[var(--text-faint)]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Pipeline */}
        <Card className="lg:col-span-2">
          <SectionHeader title={t.dash.pipeline} hint={t.dash.pipelineHint} />
          <div className="mt-5">
            <Funnel stages={pipeline} emptyLabel={t.common.empty} />
          </div>
        </Card>

        {/* Program status distribution */}
        <Card>
          <SectionHeader title={t.dash.programStatus} />
          <div className="mt-5">
            <BarList data={programStatuses} emptyLabel={t.common.empty} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Seat utilization */}
        <Card>
          <SectionHeader
            title={t.dash.capacity}
            action={
              <Link
                href={`${base}/programs`}
                className="text-[12.5px] font-medium text-copper-600 hover:underline"
              >
                {t.common.viewAll}
              </Link>
            }
          />
          <div className="mt-5">
            <BarList data={seatUsage} unit="percent" max={100} emptyLabel={t.common.empty} />
          </div>
        </Card>

        {/* Upcoming activities */}
        <Card>
          <SectionHeader title={t.dash.upcoming} />
          {upcoming.length === 0 ? (
            <EmptyState
              title={t.activity.noActivities}
              hint={t.common.emptyHint}
              icon={<CalendarClock size={19} />}
            />
          ) : (
            <ul className="mt-4 space-y-1">
              {upcoming.map(({ activity, program }) => (
                <li
                  key={activity.id}
                  className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-[9px] bg-[var(--surface-sunken)] leading-none">
                    <span className="text-[13px] font-semibold tabular-nums">
                      {new Date(activity.startsAt).getDate()}
                    </span>
                    <span className="mt-0.5 text-[9.5px] uppercase text-[var(--text-faint)]">
                      {new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', {
                        month: 'short',
                      }).format(new Date(activity.startsAt))}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {name(activity)}
                    </span>
                    <span className="block truncate text-[12px] text-[var(--text-faint)]">
                      {name(program)} · {activity.location}
                    </span>
                  </span>
                  {activity.required ? <Badge tone="accent">{t.common.required}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Recent applications */}
        <Card className="lg:col-span-3" padded={false}>
          <div className="px-5 pt-5">
            <SectionHeader
              title={isBeneficiary ? t.application.myApplications : t.dash.recent}
              action={
                <Link
                  href={`${base}/applications`}
                  className="text-[12.5px] font-medium text-copper-600 hover:underline"
                >
                  {t.common.viewAll}
                </Link>
              }
            />
          </div>
          {recent.length === 0 ? (
            <EmptyState
              title={t.application.noApplications}
              hint={t.common.emptyHint}
              icon={<ClipboardList size={19} />}
            />
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line-soft)]">
              {recent.map((item) => {
                const program = state.programs.find((entry) => entry.id === item.programId);
                return (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">
                        {isBeneficiary
                          ? program
                            ? name(program)
                            : '…'
                          : item.beneficiary.name}
                      </span>
                      <span className="block truncate text-[12px] text-[var(--text-faint)]">
                        {isBeneficiary
                          ? formatDate(item.submittedAt ?? item.createdAt, locale)
                          : `${program ? name(program) : '…'} · ${formatDate(item.submittedAt ?? item.createdAt, locale)}`}
                      </span>
                    </span>
                    <StatusBadge
                      status={item.status}
                      label={t.statuses[item.status as keyof typeof t.statuses] ?? item.status}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Indicators */}
        <Card className="lg:col-span-2">
          <SectionHeader title={t.dash.impactSummary} />
          {topIndicators.length === 0 ? (
            <EmptyState
              title={t.impact.noIndicators}
              hint={t.common.emptyHint}
              icon={<Target size={19} />}
            />
          ) : (
            <ul className="mt-4 space-y-3.5">
              {topIndicators.map((indicator) => (
                <li key={indicator.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px]">{name(indicator)}</span>
                    <ChangeValue
                      value={indicator.change}
                      direction={indicator.direction}
                      unit={indicator.unit}
                    />
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">
                    {t.impact.pairs}: {formatNumber(indicator.pairs, locale)}
                    {indicator.coverage !== null
                      ? ` · ${t.impact.coverage} ${formatPercent(indicator.coverage, locale)}`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
