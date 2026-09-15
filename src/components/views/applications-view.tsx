'use client';
import {AttachmentField} from './attachment-field';

import { useEffect, useMemo, useState } from 'react';
import { Pagination } from '@/components/ui/pagination';
import {
  ClipboardList,
  Plus,
  Gavel,
  UserPlus,
  MessageSquareWarning,
  PlayCircle,
  Star,
  Download,
} from 'lucide-react';
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
  SearchInput,
  Select,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
  Avatar,
} from '@/components/ui';
import { useApp } from '@/components/app-provider';
import { formatDate, formatDateTime, formatNumber, toLocalInput } from '@/lib/format';
import type { AppState, ApplicationState, ProgramState } from '@/lib/types';

export function ApplicationsView({ state }: { state: AppState }) {
  const { locale, t } = useApp();
  const isBeneficiary = state.actor.role === 'Beneficiary';
  return isBeneficiary ? <BeneficiaryView state={state} /> : <OperatorView state={state} />;
}

/* ─────────────────────────── Operator ─────────────────────────── */

function OperatorView({ state }: { state: AppState }) {
  const { locale, t, run, busy } = useApp();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [statusFilter, setStatusFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const canExport = ['Admin', 'Manager', 'Coordinator'].includes(state.actor.role);
  const isOverdue = (item: ApplicationState) =>
    item.status === 'NeedsInfo' && !!item.infoDue && new Date(item.infoDue) < new Date();

  const programName = (id: string) => {
    const program = state.programs.find((item) => item.id === id);
    return program ? (locale === 'ar' ? program.nameAr : program.nameEn) : '…';
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.applications.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (programFilter !== 'all' && item.programId !== programFilter) return false;
      const submitted = item.submittedAt ?? item.createdAt;
      if (from && submitted < from) return false;
      if (to && submitted.slice(0, 10) > to) return false;
      if (overdueOnly && !isOverdue(item)) return false;
      if (!needle) return true;
      return (
        item.beneficiary.name.toLowerCase().includes(needle) ||
        item.beneficiary.email.toLowerCase().includes(needle) ||
        item.reference.toLowerCase().includes(needle)
      );
    });
  }, [state.applications, query, statusFilter, programFilter, from, to, overdueOnly]);
  useEffect(() => { setPage(1); }, [query, statusFilter, programFilter, from, to, overdueOnly]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusOptions = useMemo(
    () => [...new Set(state.applications.map((item) => item.status))],
    [state.applications],
  );

  const current = selected ? state.applications.find((item) => item.id === selected) : null;

  /** Exports run through the server so the scope, the audit entry and the expiring link are the same for every role. */
  async function exportCsv() {
    const result = (await run('export.request', {
      type: 'applications',
      locale,
      ...(programFilter !== 'all' ? { programId: programFilter } : {}),
    })) as { href?: string } | null;
    if (result?.href) window.location.assign(result.href);
  }

  return (
    <>
      <PageHeader
        title={t.application.title}
        subtitle={t.application.subtitle}
        action={
          canExport && filtered.length ? (
            <Button variant="ghost" icon={<Download size={15} />} onClick={exportCsv} loading={busy}>
              {t.common.export}
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
          value={programFilter}
          onChange={(event) => setProgramFilter(event.target.value)}
          className="w-auto min-w-[11rem]"
          aria-label={t.common.program}
        >
          <option value="all">{t.common.all}</option>
          {state.programs.map((program) => (
            <option key={program.id} value={program.id}>
              {locale === 'ar' ? program.nameAr : program.nameEn}
            </option>
          ))}
        </Select>
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
        <Input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="w-auto"
          aria-label={t.common.dateFrom}
        />
        <Input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="w-auto"
          aria-label={t.common.dateTo}
        />
        <Checkbox
          checked={overdueOnly}
          onChange={(event) => setOverdueOnly(event.target.checked)}
          label={t.application.overdueInfo}
        />
      </div>

      <Card padded={false}>
        {filtered.length === 0 ? (
          <EmptyState
            title={t.application.noApplications}
            hint={t.common.emptyHint}
            icon={<ClipboardList size={19} />}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t.application.applicant}</Th>
                <Th>{t.application.reference}</Th>
                <Th>{t.common.program}</Th>
                <Th>{t.common.status}</Th>
                <Th>{t.application.avgScore}</Th>
                <Th>{t.application.submitted}</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((item) => {
                const scores = item.evaluations.filter((evaluation) => !evaluation.conflict);
                const average = scores.length
                  ? scores.reduce((sum, evaluation) => sum + evaluation.score, 0) / scores.length
                  : null;
                return (
                  <Tr key={item.id} onClick={() => setSelected(item.id)}>
                    <Td>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={item.beneficiary.name} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium">
                            {item.beneficiary.name}
                          </span>
                          <span
                            dir="ltr"
                            className="block truncate text-[11.5px] text-[var(--text-faint)]"
                          >
                            {item.beneficiary.email || '…'}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td className="font-mono text-[12px] text-[var(--text-muted)]">
                      <span dir="ltr">{item.reference || item.id.slice(0, 8).toUpperCase()}</span>
                    </Td>
                    <Td className="text-[13px] text-[var(--text-muted)]">
                      {programName(item.programId)}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          status={item.status}
                          label={t.statuses[item.status as keyof typeof t.statuses] ?? item.status}
                        />
                        {isOverdue(item) ? <Badge tone="critical">{t.common.overdue}</Badge> : null}
                      </span>
                    </Td>
                    <Td className="tabular-nums">
                      {average === null ? (
                        <span className="text-[var(--text-faint)]">…</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Star size={13} className="text-copper-600" />
                          {formatNumber(average, locale, 1)}
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-[var(--text-muted)]">
                      {formatDate(item.submittedAt ?? item.createdAt, locale)}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} rtl={locale === 'ar'} labels={{ previous: t.common.previous, next: t.common.next, page: t.common.page, of: t.common.of, showing: t.common.showing }} />
      </Card>

      {current ? (
        <ApplicationDetail
          state={state}
          application={current}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

function ApplicationDetail({
  state,
  application,
  onClose,
}: {
  state: AppState;
  application: ApplicationState;
  onClose: () => void;
}) {
  const { locale, t, run, busy } = useApp();
  const [panel, setPanel] = useState<'none' | 'info' | 'assign' | 'evaluate' | 'decide'>('none');

  const program = state.programs.find((item) => item.id === application.programId);
  const role = state.actor.role;
  const canOperate = ['Admin', 'Manager', 'Coordinator'].includes(role);
  const canManage = ['Admin', 'Manager'].includes(role);
  const canEvaluate =
    ['Admin', 'Manager', 'Reviewer'].includes(role) &&
    application.status === 'UnderReview' &&
    (role === 'Admin' || application.reviewerIds.includes(state.actor.userId));

  const reviewers = state.members.filter(
    (member) =>
      member.active &&
      ['Reviewer', 'Admin', 'Manager'].includes(member.role) &&
      (member.role === 'Admin' || member.programIds.includes(application.programId)),
  );

  const fields = application.formSnapshot.length
    ? application.formSnapshot
    : (program?.form ?? []);

  /** A settled application offers no actions. render no empty footer bar. */
  const hasActions =
    (canOperate && ['Submitted', 'UnderReview'].includes(application.status)) ||
    (canManage && ['UnderReview', 'Waitlisted'].includes(application.status)) ||
    canEvaluate;

  return (
    <Modal
      open
      onClose={onClose}
      title={application.beneficiary.name}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={application.status}
            label={t.statuses[application.status as keyof typeof t.statuses] ?? application.status}
          />
          <span className="text-[12px] text-[var(--text-faint)]">
            {program ? (locale === 'ar' ? program.nameAr : program.nameEn) : '…'}
          </span>
          {application.reference ? (
            <span dir="ltr" className="font-mono text-[12px] text-[var(--text-faint)]">
              {application.reference}
            </span>
          ) : null}
          {application.revisions?.length ? (
            <Badge tone="info">
              {t.application.revisions}: {application.revisions.length}
            </Badge>
          ) : null}
        </span>
      }
      size="lg"
      footer={
        !hasActions ? undefined : (
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {canOperate && application.status === 'Submitted' ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<PlayCircle size={15} />}
              loading={busy}
              onClick={() => run('application.review', { id: application.id })}
            >
              {t.application.review}
            </Button>
          ) : null}
          {canOperate && application.status === 'UnderReview' ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<MessageSquareWarning size={15} />}
              onClick={() => setPanel(panel === 'info' ? 'none' : 'info')}
            >
              {t.application.requestInfo}
            </Button>
          ) : null}
          {canManage && application.status === 'UnderReview' ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<UserPlus size={15} />}
              onClick={() => setPanel(panel === 'assign' ? 'none' : 'assign')}
            >
              {t.application.assign}
            </Button>
          ) : null}
          {canEvaluate ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Star size={15} />}
              onClick={() => setPanel(panel === 'evaluate' ? 'none' : 'evaluate')}
            >
              {t.application.evaluate}
            </Button>
          ) : null}
          {canManage && ['UnderReview', 'Waitlisted'].includes(application.status) ? (
            <Button
              size="sm"
              icon={<Gavel size={15} />}
              onClick={() => setPanel(panel === 'decide' ? 'none' : 'decide')}
            >
              {t.application.decide}
            </Button>
          ) : null}
        </div>
        )
      }
    >
      <div className="space-y-5">
        {application.needsInfo ? (
          <div className="rounded-xl bg-caution-soft px-4 py-3 text-[13px] text-caution">
            <p className="font-medium">{t.application.needsInfoNotice}</p>
            <p className="mt-1">{application.needsInfo}</p>
            {application.infoDue ? (
              <p className="mt-1 text-[12px]">
                {t.application.requestInfoDue}: {formatDateTime(application.infoDue, locale)}
              </p>
            ) : null}
          </div>
        ) : null}

        {application.decisionReason ? (
          <div className="rounded-xl border border-[var(--line-soft)] px-4 py-3 text-[13px]">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              {t.application.decisionReason}
            </p>
            <p className="mt-1 text-[var(--text-muted)]">{application.decisionReason}</p>
          </div>
        ) : null}

        {/* Answers */}
        <section>
          <h3 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            {t.application.answers}
          </h3>
          {fields.length === 0 || Object.keys(application.answers).length === 0 ? (
            <p className="text-[13px] text-[var(--text-faint)]">{t.common.empty}</p>
          ) : (
            <dl className="space-y-2.5">
              {fields.map((field) => (
                <div key={field.id}>
                  <dt className="text-[12px] text-[var(--text-faint)]">
                    {locale === 'ar' ? field.labelAr : field.labelEn}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-[13.5px]">
                    {String(application.answers[field.id] ?? '…')}
                  </dd>
                </div>
              ))}
              {application.answers.additionalResponse ? (
                <div>
                  <dt className="text-[12px] text-[var(--text-faint)]">{t.application.response}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-[13.5px]">
                    {String(application.answers.additionalResponse)}
                  </dd>
                </div>
              ) : null}
            </dl>
          )}
        </section>

        {/* Evaluations */}
        <section>
          <h3 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            {t.application.evaluations}
          </h3>
          {application.evaluations.length === 0 ? (
            <p className="text-[13px] text-[var(--text-faint)]">{t.application.noEvaluations}</p>
          ) : (
            <ul className="space-y-2">
              {application.evaluations.map((evaluation) => {
                const member = state.members.find((item) => item.userId === evaluation.reviewerId);
                return (
                  <li
                    key={evaluation.id}
                    className="rounded-xl border border-[var(--line-soft)] px-3.5 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[13px] font-medium">
                        {member?.user.name ?? t.application.reviewer}
                      </span>
                      {evaluation.conflict ? (
                        <Badge tone="critical">{t.application.conflictShort}</Badge>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold tabular-nums">
                          <Star size={13} className="text-copper-600" />
                          {formatNumber(evaluation.score, locale, 1)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">{evaluation.comment}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {panel === 'info' ? (
          <RequestInfoPanel application={application} program={program} onDone={() => setPanel('none')} />
        ) : null}
        {panel === 'assign' ? (
          <AssignPanel
            application={application}
            reviewers={reviewers}
            onDone={() => setPanel('none')}
          />
        ) : null}
        {panel === 'evaluate' && program ? (
          <EvaluatePanel application={application} program={program} onDone={() => setPanel('none')} />
        ) : null}
        {panel === 'decide' ? (
          <DecidePanel application={application} onDone={() => setPanel('none')} />
        ) : null}
      </div>
    </Modal>
  );
}

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="animate-pop rounded-xl border border-copper-600/25 bg-[var(--surface-sunken)] p-4">
      <h3 className="mb-3 text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function RequestInfoPanel({
  application,
  program,
  onDone,
}: {
  application: ApplicationState;
  program?: ProgramState;
  onDone: () => void;
}) {
  const { t, run, busy, locale } = useApp();
  const [reason, setReason] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState(toLocalInput(new Date(Date.now() + 5 * 86_400_000)));
  const formFields = application.formSnapshot.length ? application.formSnapshot : (program?.form ?? []);

  return (
    <PanelShell title={t.application.requestInfo}>
      <div className="grid gap-3">
        <Field label={t.common.reason} required>
          <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <Field label={t.application.fieldsToComplete} hint={t.application.fieldsHint}>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {formFields.map((field) => (
              <Checkbox
                key={field.id}
                label={locale === 'ar' ? field.labelAr : field.labelEn}
                checked={fields.includes(field.id)}
                onChange={(event) =>
                  setFields((current) =>
                    event.target.checked ? [...current, field.id] : current.filter((x) => x !== field.id),
                  )
                }
              />
            ))}
          </div>
        </Field>
        <Field
          label={t.application.requestInfoDue}
          required
          hint={program ? `${t.common.to} ${new Date(program.startsAt).toLocaleDateString()}` : undefined}
        >
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button
            size="sm"
            loading={busy}
            disabled={reason.trim().length < 3 || !dueAt}
            onClick={async () => {
              const result = await run('application.info', {
                id: application.id,
                reason: reason.trim(),
                fields,
                dueAt: new Date(dueAt).toISOString(),
              });
              if (result) onDone();
            }}
          >
            {t.common.submit}
          </Button>
        </div>
      </div>
    </PanelShell>
  );
}

function AssignPanel({
  application,
  reviewers,
  onDone,
}: {
  application: ApplicationState;
  reviewers: AppState['members'];
  onDone: () => void;
}) {
  const { t, run, busy } = useApp();
  const [reviewerId, setReviewerId] = useState('');

  return (
    <PanelShell title={t.application.assign}>
      {reviewers.length === 0 ? (
        <p className="text-[13px] text-[var(--text-faint)]">{t.common.empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}>
            <option value="">{t.application.reviewer}</option>
            {reviewers.map((member) => (
              <option key={member.id} value={member.userId}>
                {member.user.name} · {t.roles[member.role]}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            loading={busy}
            disabled={!reviewerId}
            onClick={async () => {
              const result = await run('application.assign', { id: application.id, reviewerId });
              if (result) onDone();
            }}
          >
            {t.common.confirm}
          </Button>
        </div>
      )}
    </PanelShell>
  );
}

function EvaluatePanel({
  application,
  program,
  onDone,
}: {
  application: ApplicationState;
  program: ProgramState;
  onDone: () => void;
}) {
  const { locale, t, run, busy } = useApp();
  const [scores, setScores] = useState<number[]>(() => program.rubric.map(() => 3));
  const [comment, setComment] = useState('');
  const [conflict, setConflict] = useState(false);

  const weighted = program.rubric.reduce(
    (sum, criterion, index) => sum + (criterion.weight * scores[index]) / 5,
    0,
  );

  return (
    <PanelShell title={t.application.evaluate}>
      <div className="space-y-4">
        {!conflict
          ? program.rubric.map((criterion, index) => (
              <div key={index}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px]">
                    {locale === 'ar' ? criterion.nameAr : criterion.nameEn}
                    <span className="ms-1.5 text-[11.5px] text-[var(--text-faint)]">
                      {formatNumber(criterion.weight, locale)}%
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                    {scores[index]} / 5
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setScores((current) =>
                          current.map((item, i) => (i === index ? value : item)),
                        )
                      }
                      aria-label={`${value}`}
                      className={`h-8 flex-1 rounded-lg text-[12.5px] font-medium transition-all ${
                        scores[index] >= value
                          ? 'bg-copper-600 text-white'
                          : 'bg-[var(--surface-card)] text-[var(--text-faint)] hover:bg-[var(--line-soft)]'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ))
          : null}

        {!conflict ? (
          <div className="flex items-center justify-between rounded-lg bg-[var(--surface-card)] px-3.5 py-2.5">
            <span className="text-[13px] text-[var(--text-muted)]">{t.application.score}</span>
            <span className="text-[15px] font-semibold tabular-nums">
              {formatNumber(weighted, locale, 1)}
            </span>
          </div>
        ) : null}

        <Checkbox
          checked={conflict}
          onChange={(event) => setConflict(event.target.checked)}
          label={t.application.conflict}
        />

        <Field label={t.application.comment} required>
          <Textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} />
        </Field>

        <div className="flex justify-end">
          <Button
            size="sm"
            loading={busy}
            disabled={comment.trim().length < 3}
            onClick={async () => {
              const result = await run('application.evaluate', {
                id: application.id,
                scores,
                conflict,
                comment: comment.trim(),
              });
              if (result) onDone();
            }}
          >
            {t.common.save}
          </Button>
        </div>
      </div>
    </PanelShell>
  );
}

function DecidePanel({
  application,
  onDone,
}: {
  application: ApplicationState;
  onDone: () => void;
}) {
  const { t, run, busy } = useApp();
  const [to, setTo] = useState<'Accepted' | 'Rejected' | 'Waitlisted'>('Accepted');
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState('');

  const reviewed = application.evaluations.filter((evaluation) => !evaluation.conflict);
  const incomplete =
    !reviewed.length ||
    application.reviewerIds.some(
      (id) => !reviewed.some((evaluation) => evaluation.reviewerId === id),
    );

  return (
    <PanelShell title={t.application.decide}>
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ['Accepted', t.application.accept],
              ['Waitlisted', t.application.waitlist],
              ['Rejected', t.application.reject],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTo(value)}
              className={`h-9 rounded-lg text-[13px] font-medium transition-all ${
                to === value
                  ? 'bg-navy-900 text-white'
                  : 'bg-[var(--surface-card)] text-[var(--text-muted)] hover:bg-[var(--line-soft)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Field label={t.application.decisionReason} required>
          <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>

        {incomplete ? (
          <Field label={t.application.override} hint={t.application.overrideHint} required>
            <Textarea
              rows={2}
              value={override}
              onChange={(event) => setOverride(event.target.value)}
            />
          </Field>
        ) : null}

        <div className="flex justify-end">
          <Button
            size="sm"
            loading={busy}
            disabled={reason.trim().length < 3 || (incomplete && override.trim().length < 10)}
            onClick={async () => {
              const result = await run('application.decide', {
                id: application.id,
                to,
                reason: reason.trim(),
                ...(incomplete ? { override: override.trim() } : {}),
              });
              if (result) onDone();
            }}
          >
            {t.common.confirm}
          </Button>
        </div>
      </div>
    </PanelShell>
  );
}

/* ─────────────────────────── Beneficiary ─────────────────────────── */

function BeneficiaryView({ state }: { state: AppState }) {
  const { locale, t, run, busy } = useApp();
  const [applying, setApplying] = useState<ProgramState | null>(null);
  const [responding, setResponding] = useState<ApplicationState | null>(null);

  const name = (item: { nameAr: string; nameEn: string }) =>
    locale === 'ar' ? item.nameAr : item.nameEn;

  const openPrograms = state.programs.filter(
    (program) =>
      program.status === 'RegistrationOpen' &&
      new Date(program.registrationStart) <= new Date() &&
      new Date(program.registrationEnd) >= new Date() &&
      !state.applications.some(
        (item) => item.programId === program.id && item.status !== 'Draft',
      ),
  );

  return (
    <>
      <PageHeader title={t.application.myApplications} subtitle={t.application.mySubtitle} />

      {openPrograms.length ? (
        <Card className="mb-4">
          <h2 className="text-[13px] font-semibold">{t.program.openForRegistration}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {openPrograms.map((program) => (
              <li
                key={program.id}
                className="flex items-center gap-3 rounded-[10px] border border-[var(--line-soft)] px-3.5 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{name(program)}</span>
                  <span className="block text-[11.5px] text-[var(--text-faint)]">
                    {t.common.to} {formatDate(program.registrationEnd, locale)}
                  </span>
                </span>
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setApplying(program)}>
                  {t.program.apply}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card padded={false}>
        {state.applications.length === 0 ? (
          <EmptyState
            title={t.application.noApplications}
            hint={t.common.emptyHint}
            icon={<ClipboardList size={19} />}
          />
        ) : (
          <ul className="divide-y divide-[var(--line-soft)]">
            {state.applications.map((application) => {
              const program = state.programs.find((item) => item.id === application.programId);
              return (
                <li key={application.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {program ? name(program) : '…'}
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
                  {application.status === 'NeedsInfo' ? (
                    <Button size="sm" variant="ghost" onClick={() => setResponding(application)}>
                      {t.application.resubmit}
                    </Button>
                  ) : null}
                  {['Submitted', 'UnderReview', 'NeedsInfo', 'Waitlisted'].includes(
                    application.status,
                  ) ? (
                    <Button
                      size="sm"
                      variant="subtle"
                      loading={busy}
                      onClick={() => run('application.withdraw', { id: application.id })}
                    >
                      {t.application.withdraw}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {applying ? (
        <ApplyModal program={applying} draft={state.applications.find(a=>a.programId===applying.id&&a.status==='Draft')} onClose={() => setApplying(null)} />
      ) : null}

      {responding ? (
        <RespondModal application={responding} onClose={() => setResponding(null)} />
      ) : null}
    </>
  );
}

function ApplyModal({ program, draft, onClose }: { program: ProgramState; draft?:ApplicationState; onClose: () => void }) {
  const { locale, t, run, busy } = useApp();
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>(draft?.answers??{});
  const [consent, setConsent] = useState(false);

  const missing = program.form.some(
    (field) => field.required && !String(answers[field.id] ?? '').trim(),
  );

  async function submit(asDraft: boolean) {
    const result = await run('application.save', {
      programId: program.id,
      ...(draft?{version:draft.version}:{}),
      answers,
      submit: !asDraft,
      ...(asDraft ? {} : { consent }),
    });
    if (result) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={locale === 'ar' ? program.nameAr : program.nameEn}
      description={t.application.apply}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => submit(true)} loading={busy}>
            {t.application.saveDraft}
          </Button>
          <Button onClick={() => submit(false)} disabled={missing || !consent} loading={busy}>
            {t.application.submitApp}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {program.form.map((field) => {
          const label = locale === 'ar' ? field.labelAr : field.labelEn;
          const value = String(answers[field.id] ?? '');
          const update = (next: string | string[]) =>
            setAnswers((current) => ({ ...current, [field.id]: next }));
          return (
            <Field key={field.id} label={label} required={field.required}>
              {field.type==='attachment'?<AttachmentField programId={program.id} value={Array.isArray(answers[field.id])?answers[field.id] as string[]:[]} onChange={update}/>:field.type==='multiselect'?<div className="space-y-2">{field.options?.map(option=><Checkbox key={option} label={option} checked={Array.isArray(answers[field.id])&&(answers[field.id] as string[]).includes(option)} onChange={e=>{const selected=Array.isArray(answers[field.id])?answers[field.id] as string[]:[];update(e.target.checked?[...selected,option]:selected.filter(v=>v!==option));}}/>)}</div>:field.type === 'textarea' ? (
                <Textarea value={value} onChange={(event) => update(event.target.value)} />
              ) : field.type === 'select' ? (
                <Select value={value} onChange={(event) => update(event.target.value)}>
                  <option value="">{t.common.none}</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  value={value}
                  onChange={(event) => update(event.target.value)}
                />
              )}
            </Field>
          );
        })}

        <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] p-4">
          <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            {locale === 'ar' ? program.privacyAr : program.privacyEn}
          </p>
          <div className="mt-3">
            <Checkbox
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              label={t.application.consent}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function RespondModal({
  application,
  onClose,
}: {
  application: ApplicationState;
  onClose: () => void;
}) {
  const { t, run, busy, locale } = useApp();
  const [response, setResponse] = useState('');
  const requested = application.formSnapshot.filter((field) => application.infoFields.includes(field.id));
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>(() =>
    Object.fromEntries(requested.map((field) => [field.id, application.answers[field.id] ?? ''])),
  );
  const missing = requested.some(
    (field) => field.required && !(Array.isArray(answers[field.id]) ? (answers[field.id] as string[]).length : String(answers[field.id] ?? '').trim()),
  );
  const ready = requested.length ? !missing : response.trim().length >= 1;

  return (
    <Modal
      open
      onClose={onClose}
      title={t.application.resubmit}
      description={application.needsInfo ?? undefined}
      size={requested.length ? 'lg' : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            loading={busy}
            disabled={!ready}
            onClick={async () => {
              const result = await run('application.resubmit', {
                id: application.id,
                response: response.trim(),
                answers,
                version: application.version,
              });
              if (result) onClose();
            }}
          >
            {t.common.submit}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {requested.map((field) => {
          const label = locale === 'ar' ? field.labelAr : field.labelEn;
          const value = String(answers[field.id] ?? '');
          const update = (next: string | string[]) =>
            setAnswers((current) => ({ ...current, [field.id]: next }));
          return (
            <Field key={field.id} label={`${t.application.requested}: ${label}`} required={field.required}>
              {field.type === 'attachment' ? (
                <AttachmentField
                  programId={application.programId}
                  value={Array.isArray(answers[field.id]) ? (answers[field.id] as string[]) : []}
                  onChange={update}
                />
              ) : field.type === 'multiselect' ? (
                <div className="space-y-2">
                  {field.options?.map((option) => (
                    <Checkbox
                      key={option}
                      label={option}
                      checked={Array.isArray(answers[field.id]) && (answers[field.id] as string[]).includes(option)}
                      onChange={(e) => {
                        const current = Array.isArray(answers[field.id]) ? (answers[field.id] as string[]) : [];
                        update(e.target.checked ? [...current, option] : current.filter((v) => v !== option));
                      }}
                    />
                  ))}
                </div>
              ) : field.type === 'textarea' ? (
                <Textarea value={value} onChange={(event) => update(event.target.value)} />
              ) : field.type === 'select' ? (
                <Select value={value} onChange={(event) => update(event.target.value)}>
                  <option value="">{t.common.none}</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  value={value}
                  onChange={(event) => update(event.target.value)}
                />
              )}
            </Field>
          );
        })}
        <Field label={requested.length ? t.application.additionalNote : t.application.response} required={!requested.length}>
          <Textarea rows={3} value={response} onChange={(event) => setResponse(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
