'use client';

import { useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';

/**
 * Discards a session cookie that no longer maps to a usable account, so the
 * visitor is not left carrying a zombie session that every page rejects.
 *
 * Rendered only by the sign-in page, and only when the server has already
 * decided the session is stale. `redirect: false` keeps the visitor on the
 * form they are about to use.
 */
export function ClearStaleSession() {
  const cleared = useRef(false);

  useEffect(() => {
    if (cleared.current) return;
    cleared.current = true;
    void signOut({ redirect: false });
  }, []);

  return null;
}
