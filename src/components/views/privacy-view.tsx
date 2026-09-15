'use client';

import { useState } from 'react';
import { ShieldCheck, Plus, Download, Trash2 } from 'lucide-react';
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
  Textarea,
  Th,
  Tr,
} from '@/components/ui';
import { useApp } from '@/components/app-provider';
import { formatDate, formatDateTime, relativeDays } from '@/lib/format';
import type { AppState, PrivacyState } from '@/lib/types';

const NEXT_STATUS: Record<string, string[]> = {
  New: ['IdentityVerified', 'Rejected'],
  IdentityVerified: ['InProgress', 'Rejected'],
  InProgress: ['Fulfilled', 'Rejected'],
};

export function PrivacyView({ state }: { state: AppState }) {
  const { locale, t, run, busy } = useApp();
  const [creating, setCreating] = useState(false);
  const [advancing, setAdvancing] = useState<PrivacyState | null>(null);
  const [deciding, setDeciding] = useState<{ id: string; approve: boolean } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');

  const isAdmin = state.actor.role === 'Admin';
  const isBeneficiary = state.actor.role === 'Beneficiary';
  const personName = (userId: string) => {
    if (userId === state.actor.userId) return t.privacy.myself;
    const member = state.members.find((m) => m.userId === userId);
    return member ? `${member.user.name} · ${member.user.email}` : userId.slice(0, 8);
  };
  const copies = state.exports.filter((job) => job.type === 'subject' && job.userId === state.actor.userId && job.status === 'Ready' && new Date(job.expiresAt) > new Date());

  return (
    <>
      <PageHeader
        title={t.privacy.title}
        subtitle={t.privacy.subtitle}
        action={
          <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            {t.privacy.create}
          </Button>
        }
      />

      <div className="grid gap-4">
        {isBeneficiary ? <ProfileCard state={state} /> : null}

        {copies.length ? (
          <Card>
            <SectionHeader title={t.privacy.copyReady} />
            <div className="mt-3 flex flex-wrap gap-2">
              {copies.map((job) => (
                <a key={job.id} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium text-copper-700 hover:underline" href={`/api/export?job=${job.id}`}>
                  <Download size={14} /> {t.privacy.downloadCopy} · {formatDateTime(job.createdAt, locale)}
                </a>
              ))}
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => run('preferences.save', { reminders: false })}>
              {locale === 'ar' ? 'إيقاف التذكيرات الاختيارية' : 'Turn optional reminders off'}
            </Button>
            <Button variant="ghost" onClick={() => run('preferences.save', { reminders: true })}>
              {locale === 'ar' ? 'تفعيل التذكيرات' : 'Turn reminders on'}
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await run('session.revoke');
                window.location.href = `/${locale}/login`;
              }}
            >
              {locale === 'ar' ? 'تسجيل الخروج من كل الجلسات' : 'Sign out of all sessions'}
            </Button>
          </div>
        </Card>

        <Card padded={false}>
          {state.privacy.length === 0 ? (
            <EmptyState title={t.privacy.noRequests} hint={t.common.emptyHint} icon={<ShieldCheck size={19} />} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t.privacy.type}</Th>
                  {isAdmin ? <Th>{t.privacy.requester}</Th> : null}
                  <Th>{t.common.status}</Th>
                  <Th>{t.privacy.due}</Th>
                  <Th>{t.common.reason}</Th>
                  {isAdmin ? <Th /> : null}
                </tr>
              </thead>
              <tbody>
                {state.privacy.map((request) => {
                  const days = relativeDays(request.dueAt);
                  const open = !['Fulfilled', 'Rejected'].includes(request.status);
                  const urgent = open && days !== null && days <= 7;
                  return (
                    <Tr key={request.id}>
                      <Td className="text-[13.5px] font-medium">{t.privacy.types[request.type]}</Td>
                      {isAdmin ? <Td className="text-[12.5px] text-[var(--text-muted)]">{personName(request.userId)}</Td> : null}
                      <Td>
                        <StatusBadge status={request.status} label={t.statuses[request.status as keyof typeof t.statuses] ?? request.status} />
                      </Td>
                      <Td>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <span className="tabular-nums text-[12.5px]">{formatDate(request.dueAt, locale)}</span>
                          {urgent ? <Badge tone={days !== null && days < 0 ? 'critical' : 'caution'}>{days !== null && days < 0 ? t.common.overdue : days}</Badge> : null}
                        </span>
                      </Td>
                      <Td className="max-w-[18rem] truncate text-[12.5px] text-[var(--text-muted)]">{request.reason ?? '…'}</Td>
                      {isAdmin ? (
                        <Td>
                          <span className="flex justify-end">
                            {(NEXT_STATUS[request.status] ?? []).length ? (
                              <Button size="sm" variant="ghost" onClick={() => setAdvancing(request)}>
                                {t.privacy.advance}
                              </Button>
                            ) : null}
                          </span>
                        </Td>
                      ) : null}
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        {isAdmin ? (
          <Card padded={false}>
            <div className="px-5 pt-5">
              <SectionHeader title={t.privacy.deletionQueue} hint={t.privacy.deletionHint} />
            </div>
            {state.deletionCandidates.length === 0 ? (
              <EmptyState title={t.common.empty} hint={t.common.emptyHint} icon={<Trash2 size={19} />} />
            ) : (
              <Table className="mt-3">
                <thead>
                  <tr>
                    <Th>{t.common.name}</Th>
                    <Th>{t.common.reason}</Th>
                    <Th>{t.privacy.due}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {state.deletionCandidates.map((candidate) => (
                    <Tr key={candidate.id}>
                      <Td className="text-[13.5px]">
                        {candidate.beneficiary?.name ?? '…'}
                        <span dir="ltr" className="block text-[11.5px] text-[var(--text-faint)]">{candidate.beneficiary?.email}</span>
                      </Td>
                      <Td className="text-[12.5px] text-[var(--text-muted)]">{candidate.reason}</Td>
                      <Td className="tabular-nums text-[12.5px]">{formatDate(candidate.dueAt, locale)}</Td>
                      <Td>
                        <span className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => { setDeciding({ id: candidate.id, approve: false }); setDecisionReason(''); }}>
                            {t.common.dismiss}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => { setDeciding({ id: candidate.id, approve: true }); setDecisionReason(''); }}>
                            {t.common.approve}
                          </Button>
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        ) : null}

        {state.consents.length ? (
          <Card padded={false}>
            <div className="px-5 pt-5">
              <SectionHeader title={t.privacy.consents} />
            </div>
            <Table className="mt-3">
              <thead>
                <tr>
                  <Th>{t.common.program}</Th>
                  <Th>{t.common.date}</Th>
                  <Th>{t.common.status}</Th>
                </tr>
              </thead>
              <tbody>
                {state.consents.slice(0, 50).map((consent) => {
                  const application = state.applications.find((a) => a.id === consent.applicationId);
                  const program = state.programs.find((p) => p.id === application?.programId);
                  return (
                    <Tr key={consent.id}>
                      <Td className="text-[13px]">
                        {program ? (locale === 'ar' ? program.nameAr : program.nameEn) : consent.purpose}
                        {!isBeneficiary && application ? <span className="block text-[11.5px] text-[var(--text-faint)]">{application.beneficiary.name}</span> : null}
                      </Td>
                      <Td className="tabular-nums text-[12.5px]">{formatDateTime(consent.givenAt, locale)}</Td>
                      <Td>
                        <Badge tone={consent.withdrawnAt ? 'neutral' : 'positive'}>
                          {consent.withdrawnAt ? t.privacy.consentWithdrawn : t.privacy.consentActive}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        ) : null}
      </div>

      {creating ? <CreateRequestModal state={state} onClose={() => setCreating(false)} /> : null}
      {advancing ? <AdvanceModal request={advancing} onClose={() => setAdvancing(null)} /> : null}
      {deciding ? (
        <Modal
          open
          onClose={() => setDeciding(null)}
          title={deciding.approve ? t.common.approve : t.common.dismiss}
          description={t.privacy.deletionHint}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeciding(null)}>{t.common.cancel}</Button>
              <Button
                variant={deciding.approve ? 'danger' : 'primary'}
                loading={busy}
                disabled={decisionReason.trim().length < 3}
                onClick={async () => {
                  const result = await run('deletion.decide', { id: deciding.id, approve: deciding.approve, reason: decisionReason.trim() });
                  if (result) setDeciding(null);
                }}
              >
                {t.common.confirm}
              </Button>
            </>
          }
        >
          <Field label={t.common.reason} required>
            <Textarea rows={3} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}

function ProfileCard({ state }: { state: AppState }) {
  const { t, run, busy, toast } = useApp();
  const [draft, setDraft] = useState({
    name: state.profile?.name ?? state.actor.name,
    phone: state.profile?.phone ?? '',
    email: state.profile?.email ?? '',
  });
  return (
    <Card>
      <SectionHeader title={t.privacy.profile} hint={t.privacy.profileHint} />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label={t.common.name} required>
          <Input value={draft.name} onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))} />
        </Field>
        <Field label={t.common.phone} hint="+9665xxxxxxxx">
          <Input dir="ltr" value={draft.phone} onChange={(e) => setDraft((c) => ({ ...c, phone: e.target.value }))} />
        </Field>
        <Field label={t.common.email} required>
          <Input dir="ltr" type="email" value={draft.email} onChange={(e) => setDraft((c) => ({ ...c, email: e.target.value }))} />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          loading={busy}
          disabled={draft.name.trim().length < 2 || (draft.phone.trim() !== '' && !/^\+[1-9]\d{6,14}$/.test(draft.phone.trim()))}
          onClick={async () => {
            const result = (await run('profile.update', {
              name: draft.name.trim(),
              phone: draft.phone.trim(),
              ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
            })) as { emailChange?: boolean } | null;
            if (result?.emailChange) toast('success', t.privacy.emailChangeSent);
          }}
        >
          {t.common.save}
        </Button>
      </div>
    </Card>
  );
}

function CreateRequestModal({ state, onClose }: { state: AppState; onClose: () => void }) {
  const { t, run, busy } = useApp();
  const [type, setType] = useState<PrivacyState['type']>('Access');
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const isAdmin = state.actor.role === 'Admin';

  return (
    <Modal
      open
      onClose={onClose}
      title={t.privacy.create}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button
            loading={busy}
            onClick={async () => {
              const result = await run('privacy.create', { type, ...(userId ? { userId } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
              if (result) onClose();
            }}
          >
            {t.common.submit}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={t.privacy.type} required>
          <Select value={type} onChange={(event) => setType(event.target.value as PrivacyState['type'])}>
            {(Object.keys(t.privacy.types) as Array<PrivacyState['type']>).map((key) => (
              <option key={key} value={key}>{t.privacy.types[key]}</option>
            ))}
          </Select>
        </Field>
        {isAdmin ? (
          <Field label={t.privacy.onBehalf}>
            <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">{t.privacy.myself}</option>
              {state.members.filter((m) => m.userId !== state.actor.userId).map((m) => (
                <option key={m.id} value={m.userId}>{m.user.name} · {m.user.email}</option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label={t.privacy.note}>
          <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function AdvanceModal({ request, onClose }: { request: PrivacyState; onClose: () => void }) {
  const { t, run, busy } = useApp();
  const options = NEXT_STATUS[request.status] ?? [];
  const [to, setTo] = useState(options[0] ?? '');
  const [reason, setReason] = useState('');
  const [changes, setChanges] = useState({ name: '', phone: '' });
  const correction = to === 'Fulfilled' && request.type === 'Correction';
  const validCorrection = !correction || changes.name.trim().length >= 2 || changes.phone.trim() !== '';

  return (
    <Modal
      open
      onClose={onClose}
      title={to === 'Fulfilled' ? t.privacy.fulfil : t.privacy.advance}
      description={t.privacy.types[request.type]}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button
            loading={busy}
            disabled={!to || reason.trim().length < 3 || !validCorrection}
            onClick={async () => {
              const result = await run(to === 'Fulfilled' ? 'privacy.fulfil' : 'privacy.update', {
                id: request.id,
                to,
                reason: reason.trim(),
                ...(correction ? { changes: { ...(changes.name.trim() ? { name: changes.name.trim() } : {}), ...(changes.phone.trim() !== '' ? { phone: changes.phone.trim() } : {}) } } : {}),
              });
              if (result) onClose();
            }}
          >
            {t.common.confirm}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={t.common.status} required>
          <Select value={to} onChange={(event) => setTo(event.target.value)}>
            {options.map((option) => (
              <option key={option} value={option}>{t.statuses[option as keyof typeof t.statuses] ?? option}</option>
            ))}
          </Select>
        </Field>
        {correction ? (
          <>
            <Field label={t.privacy.correctionName}>
              <Input value={changes.name} onChange={(event) => setChanges((c) => ({ ...c, name: event.target.value }))} />
            </Field>
            <Field label={t.privacy.correctionPhone} hint="+9665xxxxxxxx">
              <Input dir="ltr" value={changes.phone} onChange={(event) => setChanges((c) => ({ ...c, phone: event.target.value }))} />
            </Field>
          </>
        ) : null}
        <Field label={t.common.reason} required>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
