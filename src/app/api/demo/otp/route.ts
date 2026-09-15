import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { demoLoginEnabled } from '@/lib/demo';
import { otp, unseal } from '@/lib/totp';

/**
 * The current two step code for the seeded demo accounts, so the sign in
 * screen can fill it beside the demo password.
 *
 * Two step verification stays mandatory for staff and is not relaxed here: the
 * code is still checked at sign in. This only saves a booth visitor from
 * setting up an authenticator app to look at demo data. It answers nothing
 * unless the database is marked as seeded demo data, never in production, and
 * only reads the shared secret of the @programos.sa demo accounts.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV === 'production' || !demoLoginEnabled()) {
    return NextResponse.json({ error: 'notFound' }, { status: 404 });
  }
  const account = await db.user.findFirst({
    where: { email: { endsWith: '@programos.sa' }, mfaEnabled: true, mfaSecret: { not: null } },
    select: { mfaSecret: true },
  });
  if (!account?.mfaSecret) return NextResponse.json({ error: 'notFound' }, { status: 404 });
  const now = Date.now();
  const step = Math.floor(now / 30000);
  return NextResponse.json(
    { code: otp(unseal(account.mfaSecret), step), secondsLeft: 30 - Math.floor((now % 30000) / 1000) },
    { headers: { 'cache-control': 'no-store' } },
  );
}
