'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './index';

/**
 * Page controls for long lists. A table of a few hundred rows is still one
 * page of HTML, so this is about reading, not loading: the eye finds a row in
 * twenty five lines and loses it in three hundred.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  labels,
  rtl,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  labels: { previous: string; next: string; page: string; of: string; showing: string };
  rtl: boolean;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const Back = rtl ? ChevronRight : ChevronLeft;
  const Forward = rtl ? ChevronLeft : ChevronRight;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] px-4 py-3 text-[12.5px] text-[var(--text-muted)]">
      <span className="tabular-nums">
        {labels.showing} {first}–{last} {labels.of} {total}
      </span>
      <span className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} icon={<Back size={14} />}>
          {labels.previous}
        </Button>
        <span className="min-w-[5.5rem] text-center tabular-nums">
          {labels.page} {page} {labels.of} {pageCount}
        </span>
        <Button variant="ghost" size="sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)} icon={<Forward size={14} />}>
          {labels.next}
        </Button>
      </span>
    </div>
  );
}
