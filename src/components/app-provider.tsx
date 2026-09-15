'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { getDictionary, type Dictionary, type Locale } from '@/i18n/dictionary';

type Toast = { id: number; tone: 'success' | 'error'; message: string };

type AppContextValue = {
  locale: Locale;
  t: Dictionary;
  toast: (tone: Toast['tone'], message: string) => void;
  /** Fire a command against /api/command. Resolves to the result, or null on failure. */
  run: (action: string, data?: Record<string, unknown>) => Promise<unknown | null>;
  busy: boolean;
  refreshing: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

/** Shorthand for components that only need the dictionary and locale. */
export function useT() {
  const { t, locale } = useApp();
  return { t, locale };
}

export function AppProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const t = useMemo(() => getDictionary(locale), [locale]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const counter = useRef(0);

  const toast = useCallback((tone: Toast['tone'], message: string) => {
    const id = ++counter.current;
    setToasts((list) => [...list, { id, tone, message }]);
    setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 5000);
  }, []);

  const run = useCallback<AppContextValue['run']>(
    async (action, data = {}) => {
      setBusy(true);
      try {
        // Operator panel actions carry the platform prefix and have their own gate.
        const response = await fetch(action.startsWith('platform.') ? '/api/operator' : '/api/command', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, data }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          result?: unknown;
          error?: string;
        };
        if (!response.ok || !payload.ok) {
          const code = (payload.error ?? 'server') as keyof Dictionary['errors'];
          toast('error', t.errors[code] ?? t.errors.server);
          if (response.status === 401) router.push(`/${locale}/login`);
          return null;
        }
        toast('success', t.common.success);
        startRefresh(() => router.refresh());
        return payload.result ?? true;
      } catch {
        toast('error', t.errors.network);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [locale, router, t, toast],
  );

  const value = useMemo(
    () => ({ locale, t, toast, run, busy, refreshing }),
    [locale, t, toast, run, busy, refreshing],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((l) => l.filter((x) => x.id !== id))} />
      <TopProgress active={busy || refreshing} />
    </AppContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed bottom-5 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 end-0 sm:px-5"
      role="status"
      aria-live="polite"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          className="animate-pop pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-[var(--shadow-raised)]"
          style={{
            background: 'var(--surface-card)',
            borderColor: item.tone === 'success' ? 'var(--color-positive)' : 'var(--color-critical)',
          }}
        >
          {item.tone === 'success' ? (
            <CheckCircle2 size={18} className="mt-px shrink-0 text-positive" />
          ) : (
            <AlertTriangle size={18} className="mt-px shrink-0 text-critical" />
          )}
          <p className="flex-1 leading-relaxed">{item.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            className="shrink-0 rounded p-0.5 text-[var(--text-faint)] transition-colors hover:text-[var(--text-strong)]"
            aria-label="close"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

function TopProgress({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (active) {
      setVisible(true);
      return;
    }
    const timer = setTimeout(() => setVisible(false), 260);
    return () => clearTimeout(timer);
  }, [active]);
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[110] h-0.5 overflow-hidden bg-transparent">
      <div
        className="h-full bg-copper-600 transition-[width,opacity] duration-300 ease-out"
        style={{ width: active ? '75%' : '100%', opacity: active ? 1 : 0 }}
      />
    </div>
  );
}
