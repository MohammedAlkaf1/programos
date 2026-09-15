import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { operatorActor } from '@/lib/operator-access';
import { operatorCommand } from '@/lib/operator-commands';
import { DomainError } from '@/lib/domain';
import { captureError } from '@/lib/errors';
import { db } from '@/lib/db';

/** The operator panel's write endpoint. Same shape as /api/command, different gate. */
const LIMIT = 120;
const WINDOW = 60_000;

async function throttle(userId: string) {
  const key = `op:${userId}`;
  const now = new Date();
  const b = await db.authAttempt.findUnique({ where: { key } });
  if (b && b.resetAt > now && b.count >= LIMIT) throw new DomainError('rateLimited', 429);
  await db.authAttempt.upsert({
    where: { key },
    create: { key, count: 1, resetAt: new Date(Date.now() + WINDOW) },
    update: b && b.resetAt > now ? { count: { increment: 1 } } : { count: 1, resetAt: new Date(Date.now() + WINDOW) },
  });
}

function respond(status: number, body: object, correlationId?: string) {
  const r = NextResponse.json(body, { status });
  if (correlationId) r.headers.set('x-correlation-id', correlationId);
  return r;
}

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin && !['http://localhost:3000', 'http://127.0.0.1:3000', process.env.APP_URL].includes(req.headers.get('origin') ?? '')) return respond(403, { error: 'forbidden' });
  if (!req.headers.get('content-type')?.includes('application/json')) return respond(415, { error: 'invalid' });
  let correlationId = '';
  try {
    const raw = await req.text();
    if (raw.length > 50_000) return respond(413, { error: 'invalid' });
    const body = JSON.parse(raw) as { action?: unknown; data?: unknown };
    const a = await operatorActor();
    correlationId = a.correlationId;
    await throttle(a.userId);
    const action = String(body.action ?? '');
    if (!action.startsWith('platform.')) return respond(404, { error: 'notFound' }, correlationId);
    const result = await operatorCommand(a, action, body.data);
    return respond(200, { ok: true, result }, correlationId);
  } catch (e) {
    let status = 500;
    let error = 'server';
    if (e instanceof DomainError) {
      status = e.status;
      error = e.code;
    } else if (e instanceof ZodError || e instanceof SyntaxError) {
      status = 422;
      error = 'invalid';
    } else {
      await captureError(e, { source: 'api', path: '/api/operator', context: { correlationId } });
    }
    return respond(status, { error }, correlationId);
  }
}
