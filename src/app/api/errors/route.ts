import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { captureError } from '@/lib/errors';

/**
 * Browser error reports from the error boundary. Anonymous by design: no
 * session is needed to report that a page broke, so the endpoint is rate
 * limited per address and accepts nothing beyond the failure itself.
 */
const report = z.object({
  name: z.string().trim().max(120).default('Error'),
  message: z.string().trim().max(500),
  digest: z.string().max(64).nullable().optional(),
  stack: z.string().max(2000).optional(),
  path: z.string().max(300).optional(),
});

const LIMIT = 20;
const WINDOW = 60_000;

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '';
  const allowed = [request.nextUrl.origin, 'http://localhost:3000', 'http://127.0.0.1:3000', process.env.APP_URL];
  if (!allowed.includes(origin)) return NextResponse.json({ ok: false }, { status: 403 });
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const key = `errors:${address}`;
  const now = new Date();
  const bucket = await db.authAttempt.findUnique({ where: { key } });
  if (bucket && bucket.resetAt > now && bucket.count >= LIMIT) return NextResponse.json({ ok: false }, { status: 429 });
  await db.authAttempt.upsert({
    where: { key },
    create: { key, count: 1, resetAt: new Date(Date.now() + WINDOW) },
    update: bucket && bucket.resetAt > now ? { count: { increment: 1 } } : { count: 1, resetAt: new Date(Date.now() + WINDOW) },
  });
  const parsed = report.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 422 });
  const { name, message, digest, stack, path } = parsed.data;
  await captureError(null, { source: 'client', name, message, stack, path, context: { digest: digest ?? undefined } });
  return NextResponse.json({ ok: true });
}
