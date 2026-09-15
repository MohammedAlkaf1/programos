'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, Building2, Bug, CheckCircle2, CreditCard, DatabaseBackup, FileDown, Inbox, Plus, Receipt, ShieldCheck, Users } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, SectionHeader, Select, StatusBadge, Table, Tabs, Td, Textarea, Th, Tr, cx } from '@/components/ui';
import { StatTile } from '@/components/charts';
import { useApp } from '@/components/app-provider';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { formatMoney } from '@/lib/plan-math';
import type { OperatorState } from '@/lib/operator-state';

type Props = { state: OperatorState };

function useStatus() {
  const { t } = useApp();
  return (status: string) => (t.operator.statuses as Record<string, string>)[status] ?? status;
}

function bytes(n: number | null) {
  if (!n) return '';
  return n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

/* ───────────────────────────── Overview ───────────────────────────── */

export function OperatorOverview({ state }: Props) {
  const { locale, t } = useApp();
  const o = t.operator;
  const s = state.totals;
  const base = `/${locale}/operator`;
  const attention: { text: string; href: string; tone: 'critical' | 'caution' }[] = [];
  if (!s.lastBackupOk) attention.push({ text: o.overview.backupStale, href: `${base}/backups`, tone: 'critical' });
  if (s.pastDueInvoices) attention.push({ text: `${formatNumber(s.pastDueInvoices, locale)} ${o.totals.pastDue}`, href: `${base}/invoices`, tone: 'caution' });
  if (s.unresolvedErrors) attention.push({ text: `${formatNumber(s.unresolvedErrors, locale)} ${o.totals.errors}`, href: `${base}/errors`, tone: s.errorsLastDay ? 'critical' : 'caution' });
  if (s.newLeads) attention.push({ text: `${formatNumber(s.newLeads, locale)} ${o.totals.leads}`, href: `${base}/leads`, tone: 'caution' });

  return (
    <div className="space-y-6">
      <PageHeader title={o.nav.overview} subtitle={o.subtitle} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={o.totals.tenants} value={formatNumber(s.tenants, locale)} sub={`${formatNumber(s.activeTenants, locale)} ${o.totals.activeTenants} · ${formatNumber(s.trialing, locale)} ${o.totals.trialing}`} icon={<Building2 size={16} />} accent />
        <StatTile label={o.totals.mrr} value={formatMoney(s.mrr, s.currency, locale)} sub={o.overview.mrrHint} icon={<CreditCard size={16} />} />
        <StatTile label={o.totals.openInvoices} value={formatNumber(s.openInvoices, locale)} sub={`${formatNumber(s.pastDueInvoices, locale)} ${o.totals.pastDue}`} icon={<Receipt size={16} />} />
        <StatTile label={o.totals.users} value={formatNumber(s.users, locale)} sub={`${formatNumber(s.programs, locale)} ${o.totals.programs} · ${formatNumber(s.applications, locale)} ${o.totals.applications}`} icon={<Users size={16} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <SectionHeader title={o.overview.attention} />
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[10px] bg-positive-soft px-4 py-3 text-[13.5px] text-positive">
              <CheckCircle2 size={18} />
              {o.overview.allClear}
            </div>
          ) : (
            <ul className="space-y-2">
              {attention.map((item) => (
                <li key={item.href + item.text}>
                  <Link href={item.href} className={cx('flex items-center gap-3 rounded-[10px] px-4 py-3 text-[13.5px] transition-colors', item.tone === 'critical' ? 'bg-critical-soft text-critical hover:brightness-95' : 'bg-caution-soft text-caution hover:brightness-95')}>
                    <AlertTriangle size={17} />
                    {item.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <SectionHeader title={o.overview.health} />
          <dl className="space-y-3 text-[13.5px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--text-muted)]">{o.totals.lastBackup}</dt>
              <dd className="flex items-center gap-2 font-medium">
                <span className={cx('size-2 rounded-full', s.lastBackupOk ? 'bg-positive' : 'bg-critical')} />
                {s.lastBackupAt ? formatDateTime(s.lastBackupAt, locale) : o.totals.never}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--text-muted)]">{o.overview.errorsToday}</dt>
              <dd className="flex items-center gap-2 font-medium">
                <span className={cx('size-2 rounded-full', s.errorsLastDay ? 'bg-critical' : 'bg-positive')} />
                {formatNumber(s.errorsLastDay, locale)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--text-muted)]">{o.totals.leads}</dt>
              <dd className="font-medium">{formatNumber(s.newLeads, locale)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <SectionHeader title={o.overview.recentActions} />
        {state.audit.length === 0 ? (
          <EmptyState title={o.overview.noActions} icon={<ShieldCheck size={20} />} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t.common.date}</Th>
                <Th>{t.common.actions}</Th>
                <Th>{o.tenants.title}</Th>
                <Th>{t.common.details}</Th>
              </tr>
            </thead>
            <tbody>
              {state.audit.slice(0, 15).map((row) => {
                const tenant = state.tenants.find((x) => x.id === row.tenantId);
                return (
                  <Tr key={row.id}>
                    <Td className="whitespace-nowrap text-[var(--text-muted)]">{formatDateTime(row.createdAt, locale)}</Td>
                    <Td><code className="text-[12px]">{row.action.replace('platform.', '')}</code></Td>
                    <Td>{tenant ? (locale === 'ar' ? tenant.nameAr : tenant.nameEn) : row.tenantId === 'platform' ? '' : row.tenantId.slice(0, 8)}</Td>
                    <Td className="max-w-[24rem] truncate text-[12.5px] text-[var(--text-muted)]">{Object.entries(row.detail).filter(([, v]) => v !== '' && v !== null).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ───────────────────────────── Tenants ───────────────────────────── */

type TenantRow = OperatorState['tenants'][number];
type TenantAction = 'suspend' | 'resume' | 'close' | 'purge' | 'changePlan';

export function OperatorTenants({ state }: Props) {
  const { locale, t, run, busy } = useApp();
  const o = t.operator;
  const label = useStatus();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [dialog, setDialog] = useState<{ tenant: TenantRow; action: TenantAction } | null>(null);
  const [form, setForm] = useState({ slug: '', nameAr: '', nameEn: '', adminEmail: '', adminName: '' });
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('30');
  const [planCode, setPlanCode] = useState('');
  const name = (x: { nameAr: string; nameEn: string }) => (locale === 'ar' ? x.nameAr : x.nameEn);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.tenants.filter((x) => !q || x.slug.includes(q) || x.nameAr.toLowerCase().includes(q) || x.nameEn.toLowerCase().includes(q));
  }, [state.tenants, query]);

  const submitCreate = async () => {
    const result = await run('platform.tenant.create', form);
    if (result) {
      setCreating(false);
      setForm({ slug: '', nameAr: '', nameEn: '', adminEmail: '', adminName: '' });
    }
  };

  const submitDialog = async () => {
    if (!dialog) return;
    const { tenant, action } = dialog;
    const payload: Record<string, unknown> = { id: tenant.id };
    if (action === 'suspend' || action === 'resume') payload.reason = reason;
    if (action === 'close') Object.assign(payload, { reason, days: Number(days) });
    if (action === 'changePlan') payload.planCode = planCode;
    const result = await run(`platform.tenant.${action}`, payload);
    if (result) {
      setDialog(null);
      setReason('');
    }
  };

  const openDialog = (tenant: TenantRow, action: TenantAction) => {
    setPlanCode(tenant.plan?.code ?? state.plans[0]?.code ?? '');
    setDialog({ tenant, action });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={o.tenants.title} subtitle={o.tenants.subtitle} action={<Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>{o.tenants.create}</Button>} />
      <Card>
        <div className="mb-4 max-w-sm">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={o.tenants.search} aria-label={o.tenants.search} />
        </div>
        <Table>
          <thead>
            <tr>
              <Th>{t.common.name}</Th>
              <Th>{o.tenants.plan}</Th>
              <Th>{t.common.status}</Th>
              <Th className="text-center">{o.tenants.members}</Th>
              <Th className="text-center">{o.tenants.programs}</Th>
              <Th className="text-center">{o.tenants.applications}</Th>
              <Th>{o.tenants.created}</Th>
              <Th>{t.common.actions}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <Tr key={x.id}>
                <Td>
                  <p className="font-medium">{name(x)}</p>
                  <p className="text-[12px] text-[var(--text-faint)]"><bdi>{x.slug}</bdi>{x.openInvoices ? ` · ${x.openInvoices} ${o.tenants.invoices}` : ''}</p>
                </Td>
                <Td>
                  {x.plan ? (
                    <>
                      <p>{name(x.plan)}</p>
                      {x.subscription ? (
                        <p className="text-[12px] text-[var(--text-faint)]">
                          {label(x.subscription.status)}
                          {x.subscription.status === 'Trialing' && x.subscription.trialEndsAt ? ` · ${o.tenants.trialEnds} ${formatDate(x.subscription.trialEndsAt, locale)}` : ` · ${o.tenants.renews} ${formatDate(x.subscription.currentPeriodEnd, locale)}`}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[var(--text-faint)]">{t.common.none}</span>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={x.status} label={label(x.status)} />
                  {x.deleteAt ? <p className="mt-1 text-[11.5px] text-critical">{o.tenants.deleteAt} {formatDate(x.deleteAt, locale)}</p> : null}
                </Td>
                <Td className="text-center tabular-nums">{formatNumber(x.members, locale)}</Td>
                <Td className="text-center tabular-nums">{formatNumber(x.programs, locale)}</Td>
                <Td className="text-center tabular-nums">{formatNumber(x.applications, locale)}</Td>
                <Td className="whitespace-nowrap text-[var(--text-muted)]">{formatDate(x.createdAt, locale)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {x.status === 'Active' ? <Button size="sm" variant="ghost" onClick={() => openDialog(x, 'suspend')}>{o.tenants.suspend}</Button> : null}
                    {x.status === 'Suspended' || x.status === 'Closing' ? <Button size="sm" variant="ghost" onClick={() => openDialog(x, 'resume')}>{o.tenants.resume}</Button> : null}
                    {x.status !== 'Closed' && x.status !== 'Closing' ? <Button size="sm" variant="ghost" onClick={() => openDialog(x, 'close')}>{o.tenants.close}</Button> : null}
                    {x.status === 'Closing' && x.deleteAt && new Date(x.deleteAt) <= new Date() ? <Button size="sm" variant="danger" onClick={() => openDialog(x, 'purge')}>{o.tenants.purge}</Button> : null}
                    {x.plan && x.status !== 'Closed' ? <Button size="sm" variant="subtle" onClick={() => openDialog(x, 'changePlan')}>{o.tenants.changePlan}</Button> : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        {rows.length === 0 ? <EmptyState title={t.common.empty} /> : null}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={o.tenants.createTitle}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>{t.common.cancel}</Button>
            <Button loading={busy} onClick={submitCreate} disabled={!form.slug || !form.nameAr || !form.nameEn || !form.adminEmail}>{t.common.create}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={o.tenants.slug} hint={o.tenants.slugHint} required><Input dir="ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} /></Field>
          <Field label={o.tenants.adminEmail} required><Input dir="ltr" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></Field>
          <Field label={o.tenants.nameAr} required><Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></Field>
          <Field label={o.tenants.nameEn} required><Input dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></Field>
          <Field label={o.tenants.adminName}><Input value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} /></Field>
        </div>
        <p className="mt-3 text-[12.5px] text-[var(--text-muted)]">{o.tenants.invitationQueued}.</p>
      </Modal>

      <Modal
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog ? `${o.tenants[dialog.action]} · ${name(dialog.tenant)}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>{t.common.cancel}</Button>
            <Button variant={dialog?.action === 'purge' ? 'danger' : 'primary'} loading={busy} onClick={submitDialog} disabled={(dialog?.action === 'suspend' || dialog?.action === 'resume' || dialog?.action === 'close') && reason.trim().length < 3}>
              {t.common.confirm}
            </Button>
          </>
        }
      >
        {dialog?.action === 'suspend' ? <p className="mb-3 text-[13px] text-[var(--text-muted)]">{o.tenants.suspendHint}</p> : null}
        {dialog?.action === 'close' ? <p className="mb-3 text-[13px] text-[var(--text-muted)]">{o.tenants.closeHint}</p> : null}
        {dialog?.action === 'purge' ? <p className="mb-3 rounded-[10px] bg-critical-soft px-4 py-3 text-[13px] text-critical">{o.tenants.purgeHint}</p> : null}
        {dialog && ['suspend', 'resume', 'close'].includes(dialog.action) ? (
          <Field label={o.tenants.reason} required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        ) : null}
        {dialog?.action === 'close' ? (
          <Field label={o.tenants.days} className="mt-3"><Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        ) : null}
        {dialog?.action === 'changePlan' ? (
          <Field label={o.tenants.plan}>
            <Select value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
              {state.plans.map((p) => (
                <option key={p.code} value={p.code}>{name(p)} · {formatMoney(p.priceMonthly, p.currency, locale)}</option>
              ))}
            </Select>
          </Field>
        ) : null}
      </Modal>
    </div>
  );
}

/* ───────────────────────────── Invoices ───────────────────────────── */

type Filter = 'open' | 'overdue' | 'paid' | 'all';

export function OperatorInvoices({ state }: Props) {
  const { locale, t, run, busy } = useApp();
  const o = t.operator;
  const label = useStatus();
  const [filter, setFilter] = useState<Filter>('open');
  const [paying, setPaying] = useState<OperatorState['invoices'][number] | null>(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const rows = state.invoices.filter((x) => (filter === 'all' ? true : filter === 'paid' ? x.status === 'Paid' : filter === 'overdue' ? x.overdue : x.status === 'Open'));
  const counts = { open: state.invoices.filter((x) => x.status === 'Open').length, overdue: state.invoices.filter((x) => x.overdue).length, paid: state.invoices.filter((x) => x.status === 'Paid').length, all: state.invoices.length };

  const submit = async () => {
    if (!paying) return;
    const result = await run('platform.invoice.markPaid', { id: paying.id, reference: reference || undefined, note: note || undefined });
    if (result) {
      setPaying(null);
      setReference('');
      setNote('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={o.invoices.title} subtitle={o.invoices.subtitle} />
      <Card>
        <div className="mb-4">
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'open', label: o.invoices.open, count: counts.open },
              { value: 'overdue', label: o.invoices.overdue, count: counts.overdue },
              { value: 'paid', label: o.invoices.paidFilter, count: counts.paid },
              { value: 'all', label: o.invoices.all, count: counts.all },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState title={o.invoices.none} icon={<Receipt size={20} />} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{o.invoices.number}</Th>
                <Th>{o.invoices.tenant}</Th>
                <Th className="text-end">{o.invoices.net}</Th>
                <Th className="text-end">{o.invoices.vat}</Th>
                <Th className="text-end">{o.invoices.total}</Th>
                <Th>{t.common.status}</Th>
                <Th>{o.invoices.due}</Th>
                <Th>{t.common.actions}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <Tr key={x.id}>
                  <Td>
                    <p className="font-medium"><bdi>{x.number}</bdi></p>
                    <p className="text-[12px] text-[var(--text-faint)]">{formatDate(x.periodStart, locale)} → {formatDate(x.periodEnd, locale)}</p>
                  </Td>
                  <Td>
                    <p>{locale === 'ar' ? x.tenantNameAr : x.tenantNameEn}</p>
                    <p className="text-[12px] text-[var(--text-faint)]"><bdi>{x.tenantSlug}</bdi></p>
                  </Td>
                  <Td className="text-end tabular-nums">{formatMoney(x.netAmount, x.currency, locale)}</Td>
                  <Td className="text-end tabular-nums">{formatMoney(x.vatAmount, x.currency, locale)}</Td>
                  <Td className="text-end font-medium tabular-nums">{formatMoney(x.amount, x.currency, locale)}</Td>
                  <Td>
                    <StatusBadge status={x.overdue ? 'PastDue' : x.status} label={x.overdue ? o.invoices.overdue : label(x.status)} />
                    {x.paidAt ? <p className="mt-1 text-[11.5px] text-[var(--text-faint)]">{formatDate(x.paidAt, locale)}{x.providerRef ? ` · ${x.providerRef}` : ''}</p> : null}
                  </Td>
                  <Td className="whitespace-nowrap text-[var(--text-muted)]">{formatDate(x.dueAt, locale)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <a href={`/api/invoices/${x.id}/pdf?locale=${locale}`} target="_blank" rel="noopener" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--line-strong)] px-3 text-[13px] font-medium hover:bg-[var(--surface-sunken)]">
                        <FileDown size={14} />
                        {o.invoices.pdf}
                      </a>
                      {x.status === 'Open' ? <Button size="sm" onClick={() => setPaying(x)}>{o.invoices.markPaid}</Button> : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={!!paying}
        onClose={() => setPaying(null)}
        title={o.invoices.markPaidTitle}
        description={paying ? `${paying.number} · ${formatMoney(paying.amount, paying.currency, locale)}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaying(null)}>{t.common.cancel}</Button>
            <Button loading={busy} onClick={submit}>{t.common.confirm}</Button>
          </>
        }
      >
        <p className="mb-3 text-[13px] text-[var(--text-muted)]">{o.invoices.markPaidHint}</p>
        <Field label={o.invoices.reference}><Input dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <Field label={o.invoices.note} className="mt-3"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

/* ───────────────────────────── Leads ───────────────────────────── */

export function OperatorLeads({ state }: Props) {
  const { locale, t, run } = useApp();
  const o = t.operator;
  const label = useStatus();
  const [show, setShow] = useState<'New' | 'Contacted' | 'Closed' | 'all'>('New');
  const rows = state.leads.filter((x) => show === 'all' || x.status === show);
  const topic = (code: string) => (o.leads.topics as Record<string, string>)[code] ?? code;

  return (
    <div className="space-y-6">
      <PageHeader title={o.leads.title} subtitle={o.leads.subtitle} />
      <Card>
        <div className="mb-4">
          <Tabs
            value={show}
            onChange={setShow}
            items={[
              { value: 'New', label: label('New'), count: state.leads.filter((x) => x.status === 'New').length },
              { value: 'Contacted', label: label('Contacted'), count: state.leads.filter((x) => x.status === 'Contacted').length },
              { value: 'Closed', label: label('Closed'), count: state.leads.filter((x) => x.status === 'Closed').length },
              { value: 'all', label: t.common.all, count: state.leads.length },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState title={o.leads.none} icon={<Inbox size={20} />} />
        ) : (
          <ul className="divide-y divide-[var(--line-soft)]">
            {rows.map((x) => (
              <li key={x.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{x.name}</p>
                    <span className="text-[13px] text-[var(--text-muted)]">· {x.organization}</span>
                    <Badge tone="accent">{topic(x.topic)}</Badge>
                    <StatusBadge status={x.status} label={label(x.status)} />
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--text-faint)]">
                    <bdi>{x.email}</bdi>{x.phone ? <> · <bdi>{x.phone}</bdi></> : null} · {formatDateTime(x.createdAt, locale)}
                    {x.handledBy ? <> · {x.handledBy}</> : null}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed">{x.message}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {x.status === 'New' ? <Button size="sm" onClick={() => run('platform.lead.update', { id: x.id, status: 'Contacted' })}>{o.leads.contacted}</Button> : null}
                  {x.status !== 'Closed' ? <Button size="sm" variant="ghost" onClick={() => run('platform.lead.update', { id: x.id, status: 'Closed' })}>{o.leads.closed}</Button> : null}
                  {x.status === 'Closed' ? <Button size="sm" variant="subtle" onClick={() => run('platform.lead.update', { id: x.id, status: 'New' })}>{o.leads.reopen}</Button> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ───────────────────────────── Backups ───────────────────────────── */

export function OperatorBackups({ state }: Props) {
  const { locale, t, run, busy, toast } = useApp();
  const o = t.operator;
  const label = useStatus();
  const pending = state.backups.some((b) => b.status === 'Requested' || (b.status === 'Running' && Date.now() - new Date(b.startedAt ?? b.createdAt).getTime() < 2 * 3_600_000));
  const trigger = (code: string) => (o.backups.triggers as Record<string, string>)[code] ?? code;

  const request = async () => {
    const result = await run('platform.backup.request');
    if (result) toast('success', o.backups.requested);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={o.backups.title} subtitle={o.backups.subtitle} action={<Button icon={<DatabaseBackup size={15} />} loading={busy} disabled={pending} onClick={request}>{o.backups.requestNow}</Button>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="text-[13.5px] text-[var(--text-muted)]">{o.backups.hint}</p>
          <dl className="mt-4 grid gap-3 text-[13.5px] sm:grid-cols-3">
            <div><dt className="text-[var(--text-faint)]">{o.backups.directory}</dt><dd className="mt-0.5 break-all font-medium" dir="ltr">{state.backupConfig.directory}</dd></div>
            <div><dt className="text-[var(--text-faint)]">{o.backups.keep}</dt><dd className="mt-0.5 font-medium">{formatNumber(state.backupConfig.keep, locale)} {o.backups.keepUnit} · {formatNumber(state.backupConfig.localFiles, locale)} {o.backups.localFiles}</dd></div>
            <div><dt className="text-[var(--text-faint)]">{o.backups.remote}</dt><dd className="mt-0.5 font-medium">{state.backupConfig.remote ? `${o.backups.remoteOn} ${state.backupConfig.remote}` : t.common.none}</dd></div>
          </dl>
          {!state.backupConfig.remote ? <p className="mt-4 rounded-[10px] bg-caution-soft px-4 py-3 text-[13px] text-caution">{o.backups.remoteOff}</p> : null}
        </Card>
        <Card>
          <SectionHeader title={o.backups.restoreTitle} />
          <p className="text-[13px] text-[var(--text-muted)]">{o.backups.restoreHint}</p>
          <pre dir="ltr" className="mt-3 overflow-x-auto rounded-[10px] bg-[var(--surface-sunken)] p-3 text-[12px] leading-relaxed">{`npm run backup -- list\nnpm run backup -- verify <file>\nnpm run backup -- restore <file> --yes\nnpm run backup -- drill`}</pre>
        </Card>
      </div>
      <Card>
        {state.backups.length === 0 ? (
          <EmptyState title={o.backups.none} icon={<DatabaseBackup size={20} />} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{o.backups.started}</Th>
                <Th>{t.common.status}</Th>
                <Th>{o.backups.trigger}</Th>
                <Th>{o.backups.file}</Th>
                <Th className="text-end">{o.backups.size}</Th>
                <Th className="text-end">{o.backups.rows}</Th>
                <Th>{o.backups.remote}</Th>
              </tr>
            </thead>
            <tbody>
              {state.backups.map((b) => (
                <Tr key={b.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(b.startedAt ?? b.createdAt, locale)}</Td>
                  <Td>
                    <StatusBadge status={b.status === 'Completed' ? 'Active' : b.status === 'Failed' ? 'Rejected' : 'Pending'} label={label(b.status)} />
                    {b.error ? <p className="mt-1 max-w-[20rem] text-[11.5px] text-critical">{b.error}</p> : null}
                  </Td>
                  <Td>{trigger(b.trigger)}{b.requestedBy ? <span className="block text-[11.5px] text-[var(--text-faint)]"><bdi>{b.requestedBy}</bdi></span> : null}</Td>
                  <Td><bdi className="text-[12.5px]">{b.file ?? ''}</bdi></Td>
                  <Td className="text-end tabular-nums">{bytes(b.bytes)}</Td>
                  <Td className="text-end tabular-nums">{b.rows ? formatNumber(b.rows, locale) : ''}</Td>
                  <Td className="text-[12.5px]">{b.remote ? <bdi>{b.remote}</bdi> : <span className="text-[var(--text-faint)]">{t.common.none}</span>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ───────────────────────────── Errors ───────────────────────────── */

export function OperatorErrors({ state }: Props) {
  const { locale, t, run, busy } = useApp();
  const o = t.operator;
  const [showResolved, setShowResolved] = useState(false);
  const [open, setOpen] = useState<OperatorState['errors'][number] | null>(null);
  const rows = state.errors.filter((e) => showResolved || !e.resolvedAt);
  const source = (code: string) => (o.errors.sources as Record<string, string>)[code] ?? code;
  const unresolved = state.errors.filter((e) => !e.resolvedAt).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={o.errors.title}
        subtitle={o.errors.subtitle}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowResolved((v) => !v)}>{showResolved ? o.errors.hideResolved : o.errors.showResolved}</Button>
            {unresolved ? <Button loading={busy} onClick={() => run('platform.error.resolveAll')}>{o.errors.resolveAll}</Button> : null}
          </div>
        }
      />
      <p className="text-[13px] text-[var(--text-muted)]">{o.errors.reopened} {o.errors.webhookOff}</p>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title={o.errors.none} icon={<Bug size={20} />} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{o.errors.source}</Th>
                <Th>{o.errors.message}</Th>
                <Th className="text-center">{o.errors.count}</Th>
                <Th>{o.errors.lastSeen}</Th>
                <Th>{t.common.actions}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <Tr key={e.id}>
                  <Td><Badge tone={e.source === 'client' ? 'info' : e.source === 'worker' ? 'caution' : 'critical'}>{source(e.source)}</Badge></Td>
                  <Td>
                    <button type="button" onClick={() => setOpen(e)} className="text-start hover:underline">
                      <p className="font-medium"><bdi>{e.name}</bdi>: <bdi>{e.message.slice(0, 120)}</bdi></p>
                      {e.path ? <p className="text-[12px] text-[var(--text-faint)]"><bdi>{e.path}</bdi></p> : null}
                    </button>
                    {e.resolvedAt ? <p className="mt-1 text-[11.5px] text-positive">{o.errors.resolved} · {formatDateTime(e.resolvedAt, locale)}</p> : null}
                  </Td>
                  <Td className="text-center tabular-nums">{formatNumber(e.count, locale)}</Td>
                  <Td className="whitespace-nowrap text-[var(--text-muted)]">{formatDateTime(e.lastSeenAt, locale)}<span className="block text-[11.5px] text-[var(--text-faint)]">{o.errors.firstSeen} {formatDate(e.firstSeenAt, locale)}</span></Td>
                  <Td>{!e.resolvedAt ? <Button size="sm" variant="ghost" onClick={() => run('platform.error.resolve', { id: e.id })}>{o.errors.resolve}</Button> : null}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.name}` : ''} description={open?.message} size="lg" footer={<Button variant="ghost" onClick={() => setOpen(null)}>{t.common.close}</Button>}>
        {open ? (
          <div className="space-y-3 text-[13px]">
            <Row label={o.errors.source}>{source(open.source)}</Row>
            <Row label={o.errors.path}><bdi>{open.path || t.common.none}</bdi></Row>
            <Row label={o.errors.count}>{formatNumber(open.count, locale)} · {o.errors.firstSeen} {formatDateTime(open.firstSeenAt, locale)} · {o.errors.lastSeen} {formatDateTime(open.lastSeenAt, locale)}</Row>
            <div>
              <p className="mb-1 text-[var(--text-faint)]">{o.errors.context}</p>
              <pre dir="ltr" className="overflow-x-auto rounded-[10px] bg-[var(--surface-sunken)] p-3 text-[12px]">{JSON.stringify(open.context, null, 2)}</pre>
            </div>
            <div>
              <p className="mb-1 text-[var(--text-faint)]">{o.errors.stack}</p>
              <pre dir="ltr" className="max-h-72 overflow-auto rounded-[10px] bg-[var(--surface-sunken)] p-3 text-[11.5px] leading-relaxed">{open.stack || t.common.none}</pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 text-[var(--text-faint)]">{label}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}
