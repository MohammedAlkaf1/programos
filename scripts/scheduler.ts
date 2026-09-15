/**
 * In-process scheduler for the periodic jobs, so a deployment needs no host
 * cron. Each job runs as its own child process through the same entry points
 * the README documents, so nothing here can drift from running them by hand.
 *
 *   npm run scheduler                       all jobs (scan files, reminders, housekeeping, billing, backups)
 *   npm run scheduler -- scan-files reminders   only the named jobs
 *
 * A job never overlaps with itself: a slow run simply delays the next one.
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { captureError } from '../src/lib/errors';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Job = { name: string; script: string; every: number; args?: string[] };

const ALL_JOBS: Job[] = [
  { name: 'scan-files', script: 'scripts/scan-files.ts', every: MINUTE },
  { name: 'reminders', script: 'scripts/reminders.ts', every: HOUR },
  { name: 'housekeeping', script: 'scripts/housekeeping.ts', every: DAY },
  { name: 'billing-cycle', script: 'scripts/billing.ts', every: DAY, args: ['cycle'] },
  { name: 'backup', script: 'scripts/backup.ts', every: DAY, args: ['run'] },
  { name: 'backup-requests', script: 'scripts/backup.ts', every: MINUTE, args: ['pending'] },
];

const selected = process.argv.slice(2);
const unknown = selected.filter((name) => !ALL_JOBS.some((job) => job.name === name));
if (unknown.length) {
  console.error(`[scheduler] unknown job(s): ${unknown.join(', ')}. Known: ${ALL_JOBS.map((j) => j.name).join(', ')}`);
  process.exit(1);
}
const JOBS = selected.length ? ALL_JOBS.filter((job) => selected.includes(job.name)) : ALL_JOBS;

const running = new Set<string>();

function run(job: Job) {
  if (running.has(job.name)) return;
  running.add(job.name);
  const startedAt = Date.now();
  const child = spawn(process.execPath, [tsxCli, job.script, ...(job.args ?? [])], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => {
    running.delete(job.name);
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    console.log(`[scheduler] ${job.name} finished with code ${code} after ${seconds}s`);
    if (code !== 0) void captureError(new Error(`${job.name} exited with code ${code}`), { source: 'worker', path: `scheduler:${job.name}`, context: { seconds } });
  });
  child.on('error', (error) => {
    running.delete(job.name);
    console.error(`[scheduler] ${job.name} failed to start`, error);
  });
}

console.log(`[scheduler] started with ${JOBS.length} jobs`);
const timers = JOBS.map((job) => {
  run(job);
  return setInterval(() => run(job), job.every);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    for (const timer of timers) clearInterval(timer);
    process.exit(0);
  });
}
