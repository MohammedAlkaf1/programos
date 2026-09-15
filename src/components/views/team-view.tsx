'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pagination } from '@/components/ui/pagination';
import { UserPlus, Users, History, Settings2 } from 'lucide-react';
import {
  Avatar,
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
  SectionHeader,
  Select,
  Table,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { useApp } from '@/components/app-provider';
import { formatDateTime } from '@/lib/format';
import { roles } from '@/lib/domain';
import type { AppState, MemberState } from '@/lib/types';

export function TeamView({ state }: { state: AppState }) {
  const { locale, t, run, busy } = useApp();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<MemberState | null>(null);
  const [auditActor, setAuditActor] = useState('all');
  const [auditAction, setAuditAction] = useState('all');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [support, setSupport] = useState({ email: '', hours: '4', reason: '' });
  const [revokeReason, setRevokeReason] = useState('');
  const auditActions = useMemo(() => [...new Set(state.audit.map((e) => e.action))].sort(), [state.audit]);
  const auditRows = useMemo(
    () =>
      state.audit.filter((entry) => {
        if (auditActor !== 'all' && entry.actorId !== auditActor) return false;
        if (auditAction !== 'all' && entry.action !== auditAction) return false;
        if (auditFrom && entry.createdAt < auditFrom) return false;
        if (auditTo && entry.createdAt.slice(0, 10) > auditTo) return false;
        return true;
      }),
    [state.audit, auditActor, auditAction, auditFrom, auditTo],
  );
  const grants = state.members.filter((m) => m.supportGrant && m.active);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.members;
    return state.members.filter(
      (member) =>
        member.user.name.toLowerCase().includes(needle) ||
        member.user.email.toLowerCase().includes(needle),
    );
  }, [state.members, query]);
  useEffect(() => { setPage(1); }, [query]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const programName = (id: string) => {
    const program = state.programs.find((item) => item.id === id);
    return program ? (locale === 'ar' ? program.nameAr : program.nameEn) : id.slice(0, 8);
  };

  return (
    <>
      <PageHeader
        title={t.team.title}
        subtitle={t.team.subtitle}
        action={
          <Button icon={<UserPlus size={16} />} onClick={() => setInviting(true)}>
            {t.team.invite}
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <SearchInput value={query} onChange={setQuery} placeholder={t.common.searchPlaceholder} />
      </div>

      <Card padded={false}>
        {filtered.length === 0 ? (
          <EmptyState title={t.common.empty} hint={t.common.emptyHint} icon={<Users size={19} />} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t.team.member}</Th>
                <Th>{t.common.role}</Th>
                <Th>{t.team.programScope}</Th>
                <Th>{t.common.status}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((member) => {
                const isSelf = member.userId === state.actor.userId;
                return (
                  <Tr key={member.id}>
                    <Td>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={member.user.name} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium">
                            {member.user.name}
                          </span>
                          <span
                            dir="ltr"
                            className="block truncate text-[11.5px] text-[var(--text-faint)]"
                          >
                            {member.user.email}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <Badge tone="accent">{t.roles[member.role]}</Badge>
                    </Td>
                    <Td className="max-w-[18rem] text-[12.5px] text-[var(--text-muted)]">
                      {['Admin', 'Beneficiary'].includes(member.role)
                        ? t.team.allPrograms
                        : member.programIds.length
                          ? member.programIds.map(programName).join('، ')
                          : t.common.none}
                    </Td>
                    <Td>
                      <Badge tone={member.active ? 'positive' : 'neutral'}>
                        {member.active ? t.team.activeMember : t.team.inactiveMember}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Settings2 size={14} />}
                          disabled={isSelf}
                          title={isSelf ? t.team.selfEditBlocked : undefined}
                          onClick={() => setEditing(member)}
                        >
                          {t.common.edit}
                        </Button>
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} rtl={locale === 'ar'} labels={{ previous: t.common.previous, next: t.common.next, page: t.common.page, of: t.common.of, showing: t.common.showing }} />
      </Card>

      {/* Temporary support access */}
      <Card className="mt-4">
        <SectionHeader title={t.team.supportAccess} hint={t.team.supportHint} />
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
          <Field label={t.team.operatorEmail} required>
            <Input dir="ltr" type="email" value={support.email} onChange={(e) => setSupport((c) => ({ ...c, email: e.target.value }))} />
          </Field>
          <Field label={t.common.hours} required>
            <Input type="number" min={1} max={72} value={support.hours} onChange={(e) => setSupport((c) => ({ ...c, hours: e.target.value }))} />
          </Field>
          <Field label={t.common.reason} required>
            <Input value={support.reason} onChange={(e) => setSupport((c) => ({ ...c, reason: e.target.value }))} />
          </Field>
          <div className="flex items-end">
            <Button
              loading={busy}
              disabled={!support.email.includes('@') || support.reason.trim().length < 3}
              onClick={async () => {
                const result = await run('support.grant', { email: support.email.trim(), hours: Number(support.hours), reason: support.reason.trim() });
                if (result) setSupport({ email: '', hours: '4', reason: '' });
              }}
            >
              {t.team.grantSupport}
            </Button>
          </div>
        </div>
        {grants.length ? (
          <ul className="mt-4 divide-y divide-[var(--line-soft)]">
            {grants.map((grant) => (
              <li key={grant.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 text-[13px]">
                  {grant.user.name} <span dir="ltr" className="text-[var(--text-faint)]">{grant.user.email}</span>
                  <span className="block text-[11.5px] text-[var(--text-faint)]">{t.common.expires}: {grant.expiresAt ? formatDateTime(grant.expiresAt, locale) : '…'}</span>
                </span>
                <Input className="h-8 w-48 text-[12.5px]" placeholder={t.common.reason} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
                <Button size="sm" variant="danger" disabled={revokeReason.trim().length < 3} loading={busy} onClick={() => run('support.revoke', { id: grant.id, reason: revokeReason.trim() })}>
                  {t.team.revokeSupport}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* Undeliverable mail */}
      {state.failedMail.length ? (
        <Card className="mt-4" padded={false}>
          <div className="px-5 pt-5">
            <SectionHeader title={t.team.failedMail} hint={t.team.failedMailHint} />
          </div>
          <Table className="mt-3">
            <thead>
              <tr>
                <Th>{t.team.recipient}</Th>
                <Th>{t.common.date}</Th>
                <Th>{t.team.attempts}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {state.failedMail.map((mail) => (
                <Tr key={mail.id}>
                  <Td className="text-[12.5px]"><span dir="ltr">{mail.recipient}</span></Td>
                  <Td className="whitespace-nowrap text-[12.5px]">{formatDateTime(mail.createdAt, locale)}</Td>
                  <Td className="tabular-nums">{mail.attempts}</Td>
                  <Td>
                    <span className="flex justify-end">
                      <Button size="sm" variant="ghost" loading={busy} onClick={() => run('outbox.retry', { id: mail.id })}>
                        {t.common.retry}
                      </Button>
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {/* Audit log */}
      <Card className="mt-4" padded={false}>
        <div className="px-5 pt-5">
          <SectionHeader title={t.team.auditLog} hint={t.team.auditHint} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Select value={auditActor} onChange={(e) => setAuditActor(e.target.value)} className="w-auto min-w-[10rem]" aria-label={t.team.filterActor}>
              <option value="all">{t.team.filterActor}</option>
              {state.members.map((m) => (
                <option key={m.id} value={m.userId}>{m.user.name}</option>
              ))}
              <option value="system">system</option>
            </Select>
            <Select value={auditAction} onChange={(e) => setAuditAction(e.target.value)} className="w-auto min-w-[10rem]" aria-label={t.team.filterAction}>
              <option value="all">{t.team.filterAction}</option>
              {auditActions.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </Select>
            <Input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} className="w-auto" aria-label={t.common.dateFrom} />
            <Input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} className="w-auto" aria-label={t.common.dateTo} />
          </div>
        </div>
        {auditRows.length === 0 ? (
          <EmptyState title={t.common.empty} hint={t.common.emptyHint} icon={<History size={19} />} />
        ) : (
          <ul className="mt-3 max-h-[26rem] divide-y divide-[var(--line-soft)] overflow-y-auto">
            {auditRows.map((entry) => {
              const member = state.members.find((item) => item.userId === entry.actorId);
              const reason = typeof entry.detail?.reason === 'string' ? entry.detail.reason : '';
              return (
                <li key={entry.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span dir="ltr" className="block truncate font-mono text-[12px] text-copper-700">
                      {entry.action}
                    </span>
                    <span className="block truncate text-[11.5px] text-[var(--text-faint)]">
                      {member?.user.name ?? entry.actorId.slice(0, 8)}{reason ? ` · ${reason}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-[var(--text-faint)]">
                    {formatDateTime(entry.createdAt, locale)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {inviting ? <InviteModal state={state} onClose={() => setInviting(false)} /> : null}
      {editing ? (
        <EditMemberModal state={state} member={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

function ProgramScopePicker({
  state,
  selected,
  onChange,
  disabled,
}: {
  state: AppState;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { locale, t } = useApp();
  if (disabled) {
    return <p className="text-[12.5px] text-[var(--text-faint)]">{t.team.allPrograms}</p>;
  }
  if (!state.programs.length) {
    return <p className="text-[12.5px] text-[var(--text-faint)]">{t.program.noPrograms}</p>;
  }
  return (
    <div className="max-h-44 space-y-2 overflow-y-auto rounded-[10px] border border-[var(--line-strong)] p-3">
      {state.programs.map((program) => (
        <Checkbox
          key={program.id}
          checked={selected.includes(program.id)}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? [...selected, program.id]
                : selected.filter((id) => id !== program.id),
            )
          }
          label={locale === 'ar' ? program.nameAr : program.nameEn}
        />
      ))}
    </div>
  );
}

function InviteModal({ state, onClose }: { state: AppState; onClose: () => void }) {
  const { t, run, busy } = useApp();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof roles)[number]>('Coordinator');
  const [programIds, setProgramIds] = useState<string[]>([]);

  const scopeless = ['Admin', 'Beneficiary'].includes(role);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <Modal
      open
      onClose={onClose}
      title={t.team.invite}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            loading={busy}
            disabled={!valid}
            onClick={async () => {
              const result = await run('member.invite', {
                email: email.trim().toLowerCase(),
                role,
                programIds: scopeless ? [] : programIds,
              });
              if (result) onClose();
            }}
          >
            {t.common.submit}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={t.common.email} required>
          <Input
            type="email"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@organization.sa"
          />
        </Field>
        <Field label={t.common.role} required>
          <Select
            value={role}
            onChange={(event) => setRole(event.target.value as (typeof roles)[number])}
          >
            {roles.map((item) => (
              <option key={item} value={item}>
                {t.roles[item]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.team.programScope}>
          <ProgramScopePicker
            state={state}
            selected={programIds}
            onChange={setProgramIds}
            disabled={scopeless}
          />
        </Field>
        <p className="text-[12px] text-[var(--text-faint)]">{t.team.inviteSent}</p>
      </div>
    </Modal>
  );
}

function EditMemberModal({
  state,
  member,
  onClose,
}: {
  state: AppState;
  member: MemberState;
  onClose: () => void;
}) {
  const { t, run, busy } = useApp();
  const [role, setRole] = useState<(typeof roles)[number]>(member.role);
  const [active, setActive] = useState(member.active);
  const [programIds, setProgramIds] = useState<string[]>(member.programIds);

  const scopeless = ['Admin', 'Beneficiary'].includes(role);

  return (
    <Modal
      open
      onClose={onClose}
      title={member.user.name}
      description={member.user.email}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            loading={busy}
            onClick={async () => {
              const result = await run('member.update', {
                id: member.id,
                role,
                active,
                programIds: scopeless ? [] : programIds,
              });
              if (result) onClose();
            }}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={t.common.role} required>
          <Select
            value={role}
            onChange={(event) => setRole(event.target.value as (typeof roles)[number])}
          >
            {roles.map((item) => (
              <option key={item} value={item}>
                {t.roles[item]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.team.programScope}>
          <ProgramScopePicker
            state={state}
            selected={programIds}
            onChange={setProgramIds}
            disabled={scopeless}
          />
        </Field>
        <Checkbox
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          label={t.team.activeMember}
        />
      </div>
    </Modal>
  );
}
