/**
 * Drains the Outbox table. Without this running, invitations and password
 * resets are queued and never delivered.
 *
 *   npm run mail:send      once
 *   npm run mail:worker    every 15s until stopped
 *
 * With no SMTP_HOST configured it writes each message to data/mail/*.eml
 * instead of sending, so local development is verifiable without a mail
 * server — and so nothing is silently dropped.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const MAX_ATTEMPTS = 4;
const BATCH = 20;

type Message = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  attempts: number;
};

async function transport() {
  if (!process.env.SMTP_HOST) return null;
  const { createTransport } = await import('nodemailer');
  return createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
}

function writeToDisk(message: Message) {
  const dir = path.resolve('data/mail');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${message.id.slice(0, 8)}.eml`);
  writeFileSync(
    file,
    [
      `To: ${message.recipient}`,
      `From: ${process.env.MAIL_FROM ?? 'ProgramOS <no-reply@programos.local>'}`,
      `Subject: ${message.subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      message.body,
    ].join('\n'),
    'utf8',
  );
  return file;
}

export async function drain() {
  const mailer = await transport();
  const due = (await db.outbox.findMany({
    where: { status: 'Queued', attempts: { lt: MAX_ATTEMPTS }, nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
  })) as Message[];

  let sent = 0;
  let failed = 0;

  for (const message of due) {
    try {
      if (mailer) {
        await mailer.sendMail({
          to: message.recipient,
          from: process.env.MAIL_FROM ?? 'ProgramOS <no-reply@programos.local>',
          subject: message.subject,
          text: message.body,
        });
      } else {
        const file = writeToDisk(message);
        console.log(`  → ${message.recipient}  (${path.basename(file)})`);
      }
      await db.outbox.update({
        where: { id: message.id },
        data: { status: 'Sent', attempts: { increment: 1 } },
      });
      sent += 1;
    } catch (error) {
      const attempts = message.attempts + 1;
      const delay = 60_000 * ([1,5,30][attempts-1]??30);
      await db.outbox.update({
        where: { id: message.id },
        data: {
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'Failed' : 'Queued',
          nextAttemptAt: new Date(Date.now() + delay),
        },
      });
      failed += 1;
      console.error(
        `  ! ${message.recipient} attempt ${attempts}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  return { sent, failed, considered: due.length };
}

const watch = process.argv.includes('--watch');

async function once() {
  const result = await drain();
  if (result.considered) {
    console.log(
      `mail: ${result.sent} sent, ${result.failed} failed${process.env.SMTP_HOST ? '' : ' (written to data/mail)'}`,
    );
  }
  return result;
}

if (watch) {
  console.log('mail worker started (every 15s) — Ctrl+C to stop');
  await once();
  const timer = setInterval(() => {
    once().catch((error) => console.error(error));
  }, 15_000);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      clearInterval(timer);
      await db.$disconnect();
      process.exit(0);
    });
  }
} else {
  await once();
  await db.$disconnect();
}
