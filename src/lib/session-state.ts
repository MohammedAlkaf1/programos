import { cache } from 'react';
import { redirect } from 'next/navigation';
import { actor } from './access';
import { getState } from './state';
import { DomainError } from './domain';
import type { AppState } from './types';
import type { Locale } from '@/i18n/dictionary';

/**
 * Deduplicated per request: the layout and the page both call this, but the
 * database is only read once.
 */
export const loadActor = cache(actor);

export const loadState = cache(async (): Promise<AppState> => {
  const current = await loadActor();
  return (await getState(current)) as AppState;
});

/**
 * Whether the current session still resolves to a usable actor.
 *
 * The session is a self-contained JWT valid for hours, but the account behind
 * it can be deactivated, lose its last membership, or have its tenant removed
 * at any moment. Pages that redirect *away* from sign-in must apply this test
 * rather than trusting the cookie: otherwise sign-in bounces to the dashboard,
 * the dashboard bounces back, and the browser reports ERR_TOO_MANY_REDIRECTS.
 */
export async function sessionIsUsable() {
  try {
    await loadActor();
    return true;
  } catch {
    return false;
  }
}

/** Loads state, sending anyone without a valid session back to the sign-in page. */
export async function requireState(locale: Locale): Promise<AppState> {
  try {
    return await loadState();
  } catch (error) {
    if(error instanceof DomainError&&error.code==='mfaRequired')redirect(`/${locale}/security`);
    if (error instanceof DomainError && (error.status === 401 || error.status === 403)) {
      redirect(`/${locale}/login`);
    }
    throw error;
  }
}
