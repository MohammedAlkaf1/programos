import { auth } from '@/auth';
import { headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { DomainError } from './domain';

/**
 * Who may open the operator panel: an active user flagged as a platform
 * operator, with two step verification on. Membership in any tenant is not
 * required and grants nothing here; the flag is set from the console
 * (`npm run operator -- grant <email>`) or by another operator.
 */
export type OperatorActor = { userId: string; name: string; email: string; correlationId: string };

const IDLE_MS = 30 * 60_000;

export async function operatorActor(): Promise<OperatorActor> {
  const session = await auth();
  if (!session?.user?.id) throw new DomainError('unauthorized', 401);
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.active) throw new DomainError('unauthorized', 401);
  if (!user.platformOperator) throw new DomainError('forbidden', 403);
  if (!user.mfaEnabled) throw new DomainError('mfaRequired', 403);
  const now = new Date();
  if (user.lastSeenAt && now.getTime() - user.lastSeenAt.getTime() > IDLE_MS) {
    await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 }, lastSeenAt: null } });
    throw new DomainError('unauthorized', 401);
  }
  if (!user.lastSeenAt || now.getTime() - user.lastSeenAt.getTime() > 60_000) await db.user.update({ where: { id: user.id }, data: { lastSeenAt: now } });
  let correlationId: string = randomUUID();
  try {
    const h = (await headers()).get('x-request-id');
    if (h && /^[a-zA-Z0-9-]{8,64}$/.test(h)) correlationId = h;
  } catch {}
  return { userId: user.id, name: user.name, email: user.email, correlationId };
}

/** Whether the signed in person is an operator, without throwing. */
export async function isOperator() {
  try {
    await operatorActor();
    return true;
  } catch {
    return false;
  }
}
