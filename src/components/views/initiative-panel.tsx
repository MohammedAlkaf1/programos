'use client';

import { useState } from 'react';
import { Layers, Archive } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Button, Field, Input, Modal, Textarea } from '@/components/ui';
import type { AppState } from '@/lib/types';

/**
 * Initiatives group programs under one objective. They are edited rarely, so
 * the panel is a toolbar button that opens a dialog rather than a card that
 * sits empty above the program list.
 */
export function InitiativePanel({ state }: { state: AppState }) {
  const { locale, run, busy } = useApp();
  const ar = locale === 'ar';
  const [open, setOpen] = useState(false);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [objective, setObjective] = useState('');
  if (state.actor.role !== 'Admin') return null;
  const canSubmit = nameAr.trim().length > 1 && nameEn.trim().length > 1 && objective.trim().length >= 3;

  return (
    <>
      <Button variant="ghost" icon={<Layers size={15} />} onClick={() => setOpen(true)} className="ms-auto">
        {ar ? 'المبادرات' : 'Initiatives'}
        {state.initiatives.length ? (
          <span className="rounded-full bg-copper-100 px-1.5 text-[11px] font-semibold text-copper-700">{state.initiatives.length}</span>
        ) : null}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={ar ? 'إدارة المبادرات' : 'Manage initiatives'}
        description={ar ? 'المبادرة تجمع عدة برامج تحت هدف واحد. أرشفتها لا تحذف برامجها.' : 'An initiative groups programs under one objective. Archiving it keeps its programs.'}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={ar ? 'اسم المبادرة بالعربية' : 'Arabic name'} required>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </Field>
          <Field label={ar ? 'اسم المبادرة بالإنجليزية' : 'English name'} required>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </Field>
          <Field label={ar ? 'الهدف' : 'Objective'} required className="sm:col-span-2">
            <Textarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            loading={busy}
            disabled={!canSubmit}
            onClick={async () => {
              const result = await run('initiative.create', { nameAr, nameEn, objective });
              if (result) { setNameAr(''); setNameEn(''); setObjective(''); }
            }}
          >
            {ar ? 'إنشاء مبادرة' : 'Create initiative'}
          </Button>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            {ar ? 'المبادرات الحالية' : 'Current initiatives'}
          </p>
          {state.initiatives.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)]">{ar ? 'لا توجد مبادرات بعد' : 'No initiatives yet'}</p>
          ) : (
            <ul className="divide-y divide-[var(--line-soft)] rounded-xl border border-[var(--line-soft)]">
              {state.initiatives.map((initiative) => (
                <li key={initiative.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13.5px]">
                  <span className="truncate">{ar ? initiative.nameAr : initiative.nameEn}</span>
                  <Button
                    variant="subtle"
                    size="sm"
                    icon={<Archive size={14} />}
                    disabled={objective.trim().length < 3}
                    title={ar ? 'اكتب سبب الأرشفة في حقل الهدف أولاً' : 'Write the archive reason in the objective field first'}
                    onClick={() => run('initiative.archive', { id: initiative.id, reason: objective })}
                  >
                    {ar ? 'أرشفة' : 'Archive'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}
