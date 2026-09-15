/**
 * Database backup and restore.
 *
 *   npm run backup                       take a backup now (records a BackupRun, prunes old files, uploads if S3 is configured)
 *   npm run backup -- pending            take a backup only if the operator panel requested one
 *   npm run backup -- list               list local backup files
 *   npm run backup -- verify <file>      read a file back and check its checksum and row count
 *   npm run backup -- restore <file>     replace the database contents with the file (asks for --yes)
 *   npm run backup -- drill              backup, then restore that same file, then compare row counts
 *
 * The scheduler runs `backup` daily and `pending` every minute.
 */
import 'dotenv/config';
import { statSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { db } from '../src/lib/db';
import { captureError } from '../src/lib/errors';
import { backupDirectory, createBackup, pruneBackups, readBackup, restoreBackup, s3TargetFromEnv, uploadBackup } from '../src/lib/backup';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const [command = 'run', ...args] = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);

async function runBackup(runId: string | null, trigger: string) {
  const run = runId
    ? await db.backupRun.update({ where: { id: runId }, data: { status: 'Running', startedAt: new Date() } })
    : await db.backupRun.create({ data: { status: 'Running', trigger, startedAt: new Date() } });
  try {
    const summary = await createBackup(url!);
    const target = s3TargetFromEnv();
    const remote = target ? await uploadBackup(target, summary.file) : null;
    const pruned = pruneBackups();
    await db.backupRun.update({
      where: { id: run.id },
      data: { status: 'Completed', finishedAt: new Date(), file: basename(summary.file), bytes: summary.bytes, tables: summary.tables, rows: summary.rows, checksum: summary.checksum, remote },
    });
    console.log(`backup ${basename(summary.file)}: ${summary.rows} rows in ${summary.tables} tables, ${(summary.bytes / 1024).toFixed(0)} KB${remote ? `, copied to ${remote}` : ''}${pruned.length ? `, pruned ${pruned.length}` : ''}`);
    return { ...summary, runId: run.id, remote };
  } catch (error) {
    await db.backupRun.update({ where: { id: run.id }, data: { status: 'Failed', finishedAt: new Date(), error: (error instanceof Error ? error.message : String(error)).slice(0, 1000) } });
    await captureError(error, { source: 'worker', path: 'backup', context: { trigger } });
    throw error;
  }
}

async function main() {
  switch (command) {
    case 'run':
      await runBackup(null, 'manual');
      return;
    case 'pending': {
      const requested = await db.backupRun.findFirst({ where: { status: 'Requested' }, orderBy: { createdAt: 'asc' } });
      if (!requested) return;
      await runBackup(requested.id, requested.trigger);
      return;
    }
    case 'list': {
      const dir = backupDirectory();
      for (const f of readdirSync(dir).filter((f) => f.endsWith('.ndjson.gz')).sort()) console.log(`${f}  ${(statSync(join(dir, f)).size / 1024).toFixed(0)} KB`);
      return;
    }
    case 'verify': {
      const file = args[0];
      if (!file) throw new Error('usage: verify <file>');
      const parsed = readBackup(resolveFile(file));
      const run = await db.backupRun.findFirst({ where: { file: basename(file) } });
      console.log(`${basename(file)}: ${parsed.rows.length} rows, ${parsed.header.tables.length} tables, created ${parsed.header.createdAt}, migrations ${parsed.header.migrations.length}`);
      if (run?.checksum) console.log(run.checksum === parsed.checksum ? 'checksum matches the recorded run' : `CHECKSUM MISMATCH: recorded ${run.checksum}, file ${parsed.checksum}`);
      return;
    }
    case 'restore': {
      const file = args.find((a) => !a.startsWith('--'));
      if (!file) throw new Error('usage: restore <file> --yes [--force]');
      const dry = await restoreBackup(url!, resolveFile(file), { dryRun: true, allowMigrationMismatch: flag('force') });
      console.log(`would replace the database with ${dry.rows} rows in ${dry.tables} tables (migrations ${dry.migrationsMatch ? 'match' : 'DIFFER'})`);
      if (!flag('yes')) {
        console.log('add --yes to proceed. This deletes everything currently in the database.');
        return;
      }
      const done = await restoreBackup(url!, resolveFile(file), { allowMigrationMismatch: flag('force') });
      await db.audit.create({ data: { tenantId: 'platform', actorId: 'operator', action: 'platform.restore', entityId: basename(file), detail: { rows: done.rows, tables: done.tables } } });
      console.log(`restored ${done.rows} rows into ${done.tables} tables`);
      return;
    }
    case 'drill': {
      const before = await rowCounts();
      const summary = await runBackup(null, 'drill');
      const done = await restoreBackup(url!, summary.file);
      // The snapshot holds this run as "Running"; put the finished state back so the panel shows the truth.
      await db.backupRun.update({ where: { id: summary.runId }, data: { status: 'Completed', finishedAt: new Date(), file: basename(summary.file), bytes: summary.bytes, tables: summary.tables, rows: summary.rows, checksum: summary.checksum, remote: summary.remote, trigger: 'drill' } });
      const after = await rowCounts();
      const differences = Object.keys(before).filter((t) => before[t] !== after[t]);
      if (differences.length) throw new Error(`drill failed: counts differ for ${differences.join(', ')}`);
      console.log(`drill passed: ${done.rows} rows restored, every table count unchanged`);
      return;
    }
    default:
      console.log('commands: run | pending | list | verify <file> | restore <file> --yes [--force] | drill');
      process.exitCode = 1;
  }
}

function resolveFile(name: string) {
  return name.includes('/') || name.includes('\\') ? name : join(backupDirectory(), name);
}

async function rowCounts() {
  const names = await db.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
  const counts: Record<string, number> = {};
  for (const { table_name } of names) {
    if (table_name === 'BackupRun') continue; // the drill itself adds a row here
    const [{ count }] = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "${table_name}"`);
    counts[table_name] = Number(count);
  }
  return counts;
}

try {
  await main();
} finally {
  await db.$disconnect();
}
