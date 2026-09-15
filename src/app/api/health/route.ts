import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Liveness and readiness for the container platform. Reports only whether the
 * process is up and the database answers; no version, no tenant data.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { status: 'degraded' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
