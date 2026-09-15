import { requireState } from './session-state';
import { isLocale, getDictionary, type Locale } from '@/i18n/dictionary';
import type { Role } from './domain';
import type { AppState } from './types';

/**
 * Resolves the locale and loads state, reporting whether the signed-in role may
 * see this page. The API enforces the same rules — this only keeps navigation
 * honest.
 *
 * It reports rather than redirects on purpose: these pages stream, and a
 * streaming `redirect()` degrades to a one-second `<meta http-equiv="refresh">`
 * on the client. Rendering a denial is instant and tells the user why.
 */
export async function pageState(
  params: Promise<{ locale: string }>,
  allowed?: Role[],
): Promise<{ locale: Locale; state: AppState; permitted: boolean }> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'ar';
  const state = await requireState(locale);
  const permitted = !allowed || allowed.includes(state.actor.role);
  return { locale, state, permitted };
}

export async function pageTitle(
  params: Promise<{ locale: string }>,
  key: keyof ReturnType<typeof getDictionary>['nav'],
) {
  const { locale } = await params;
  const t = getDictionary(isLocale(locale) ? locale : 'ar');
  return { title: t.nav[key] as string };
}
