'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('render_failure', error.digest ?? error.name);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-critical-soft text-critical">
        <AlertTriangle size={22} />
      </span>
      <div>
        <h1 className="text-lg font-semibold">حدث خطأ غير متوقع · Something went wrong</h1>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          حاول مرة أخرى، وإن استمر الخطأ فتواصل مع مدير النظام.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800"
      >
        <RotateCcw size={15} />
        إعادة المحاولة · Retry
      </button>
    </div>
  );
}
