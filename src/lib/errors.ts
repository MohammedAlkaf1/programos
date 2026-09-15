import { createHash } from 'node:crypto';
import { db } from './db';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Built in error tracking. Failures from the server, the API, the workers and
 * the browser land in one table grouped by fingerprint, so the operator panel
 * shows "this failed 40 times since Tuesday" rather than 40 rows.
 *
 * The first occurrence of a new fingerprint can also be pushed to a chat
 * webhook (ERROR_WEBHOOK_URL: Slack, Teams or anything that accepts JSON), so
 * someone hears about a new kind of failure without watching a dashboard.
 *
 * Nothing here may throw: an error tracker that breaks the request it is
 * reporting on is worse than none.
 */

export type ErrorSource = 'server' | 'api' | 'worker' | 'client';

export type CaptureOptions = {
  source: ErrorSource;
  path?: string;
  /** Small, non personal facts that help reproduce the failure. */
  context?: Record<string, unknown>;
  /** Overrides the derived name/message, for reports that arrive as plain data. */
  name?: string;
  message?: string;
  stack?: string;
};

/** Numbers, ids and quoted strings vary per occurrence; strip them so the same bug groups together. */
export function normaliseMessage(message: string) {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\b\d+(\.\d+)?\b/g, '<n>')
    .replace(/(["'`]).*?\1/g, '<str>')
    .trim()
    .slice(0, 300);
}

export function fingerprintOf(source: string, name: string, message: string, stack: string) {
  // The first frame outside node internals is the most stable part of a stack.
  const frame =
    stack
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .find((line) => line.startsWith('at ') && !line.includes('node:internal')) ?? '';
  const stableFrame = frame.replace(/:\d+:\d+\)?$/, '').replace(/^at\s+/, '');
  return createHash('sha256').update([source, name, normaliseMessage(message), stableFrame].join('|')).digest('hex').slice(0, 32);
}

function describe(error: unknown, options: CaptureOptions) {
  const isError = error instanceof Error;
  const name = options.name ?? (isError ? error.name : 'Error');
  const message = options.message ?? (isError ? error.message : typeof error === 'string' ? error : 'Unknown failure');
  const stack = options.stack ?? (isError ? (error.stack ?? '') : '');
  return { name: name.slice(0, 120), message: message.slice(0, 2000), stack: stack.slice(0, 6000) };
}

export async function captureError(error: unknown, options: CaptureOptions) {
  try {
    const { name, message, stack } = describe(error, options);
    const fingerprint = fingerprintOf(options.source, name, message, stack);
    const path = (options.path ?? '').slice(0, 300);
    const context = JSON.parse(JSON.stringify(options.context ?? {})) as Prisma.InputJsonObject;
    const now = new Date();
    const row = await db.errorEvent.upsert({
      where: { fingerprint },
      create: { fingerprint, source: options.source, name, message, stack, path, context, firstSeenAt: now, lastSeenAt: now },
      // A resolved fingerprint that fires again reopens: the fix did not hold.
      update: { count: { increment: 1 }, lastSeenAt: now, message, stack, path, context, resolvedAt: null },
    });
    if (row.count === 1) await notifyNew(row);
    return row;
  } catch (trackerFailure) {
    console.error('error_tracker_failure', trackerFailure instanceof Error ? trackerFailure.message : trackerFailure);
    return null;
  }
}

async function notifyNew(row: { id: string; source: string; name: string; message: string; path: string }) {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  const text = `ProgramOS: new ${row.source} error\n${row.name}: ${row.message.slice(0, 300)}\n${row.path || ''}\n${process.env.APP_URL ?? ''}/ar/operator/errors`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // `text` suits Slack and most chat hooks; the rest is there for anything structured.
      body: JSON.stringify({ text, source: row.source, name: row.name, message: row.message, path: row.path, id: row.id }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // The webhook is a convenience. The row is already stored.
  }
}
