import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { publicCommand, publicActions } from '@/lib/public-commands';
import { DomainError } from '@/lib/domain';

/** Best-effort client identity for rate limiting. Never used for authorisation. */
function clientKey(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || 'local';
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowed = [
    req.nextUrl.origin,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.APP_URL,
  ].filter(Boolean);
  if (!origin || !allowed.includes(origin)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'invalid' }, { status: 415 });
  }

  try {
    const raw = await req.text();
    if (raw.length > 20_000) return NextResponse.json({ error: 'invalid' }, { status: 413 });
    const body = JSON.parse(raw) as { action?: string; data?: unknown };

    if (!body.action || !(publicActions as readonly string[]).includes(body.action)) {
      return NextResponse.json({ error: 'invalid' }, { status: 422 });
    }

    const result = await publicCommand(body.action, body.data ?? {}, clientKey(req));
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      // Surface only the first validation code, never the submitted values.
      const code = error.issues[0]?.message;
      return NextResponse.json(
        { error: code === 'weakPassword' ? 'weakPassword' : 'invalid' },
        { status: 422 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'invalid' }, { status: 422 });
    }
    console.error('public_command_failure', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
