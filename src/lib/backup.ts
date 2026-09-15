import { createHash, createHmac } from 'node:crypto';
import { createWriteStream, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { gunzipSync, createGzip } from 'node:zlib';
import { Client, types as pgTypes } from 'pg';

/**
 * Logical backup and restore of the whole database, in plain Node.
 *
 * Why not pg_dump: the production worker image can carry it, but the Windows
 * development machine and the embedded database cannot, and a backup routine
 * that is never exercised locally is one nobody trusts. This format is a
 * gzip file of newline separated JSON: a header, then one line per row with
 * the table name, then a footer with counts and a checksum. Restore reads it
 * back in dependency order inside one transaction, so a failure half way
 * leaves the database exactly as it was.
 *
 * The file also records the applied Prisma migrations, and restore refuses a
 * file whose migrations differ from the target unless told to proceed.
 */

export type BackupSummary = { file: string; bytes: number; tables: number; rows: number; checksum: string };

type Column = { name: string; type: string };
type TableInfo = { name: string; columns: Column[]; dependsOn: string[] };

const BACKUP_VERSION = 1;

/**
 * Timestamps travel as the exact text Postgres holds. node-postgres would
 * otherwise parse a `timestamp without time zone` in the machine's local zone
 * and hand it back shifted, which is how a backup taken in Riyadh restores
 * three hours late.
 */
const TIMESTAMP_OIDS = new Set([1114, 1184, 1082]);
function connect(databaseUrl: string) {
  return new Client({
    connectionString: databaseUrl,
    types: { getTypeParser: (oid: number, format?: unknown) => (TIMESTAMP_OIDS.has(oid) ? (v: string) => v : (pgTypes.getTypeParser as (o: number, f?: unknown) => (v: string) => unknown)(oid, format)) } as never,
  });
}

export function backupDirectory() {
  return process.env.BACKUP_DIR ?? join(process.cwd(), 'data', 'backups');
}

async function tables(client: Client): Promise<TableInfo[]> {
  const names = (
    await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
    )
  ).rows.map((r) => r.table_name);
  const columns = await client.query<{ table_name: string; column_name: string; udt_name: string; data_type: string }>(
    `SELECT table_name, column_name, udt_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`,
  );
  const fks = await client.query<{ child: string; parent: string }>(
    `SELECT tc.table_name AS child, ccu.table_name AS parent
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.constraint_schema=tc.constraint_schema
      WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`,
  );
  return names.map((name) => ({
    name,
    columns: columns.rows
      .filter((c) => c.table_name === name)
      .map((c) => ({ name: c.column_name, type: c.data_type === 'ARRAY' ? `${c.udt_name.replace(/^_/, '')}[]` : c.udt_name })),
    dependsOn: [...new Set(fks.rows.filter((f) => f.child === name && f.parent !== name).map((f) => f.parent))],
  }));
}

/** Parents before children, so inserts never hit a missing foreign key. */
export function dependencyOrder(list: { name: string; dependsOn: string[] }[]) {
  const done = new Set<string>();
  const out: string[] = [];
  const visiting = new Set<string>();
  const visit = (name: string) => {
    if (done.has(name)) return;
    if (visiting.has(name)) return; // a cycle; Prisma schemas do not produce them, but never loop forever
    visiting.add(name);
    for (const parent of list.find((t) => t.name === name)?.dependsOn ?? []) visit(parent);
    visiting.delete(name);
    done.add(name);
    out.push(name);
  };
  for (const t of list) visit(t.name);
  return out;
}

function encodeValue(value: unknown): unknown {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Buffer.isBuffer(value)) return { $bytes: value.toString('base64') };
  return value;
}

function decodeValue(value: unknown, type: string): unknown {
  if (value && typeof value === 'object' && '$date' in (value as object)) return new Date((value as { $date: string }).$date);
  if (value && typeof value === 'object' && '$bytes' in (value as object)) return Buffer.from((value as { $bytes: string }).$bytes, 'base64');
  if ((type === 'jsonb' || type === 'json') && value !== null) return JSON.stringify(value);
  return value;
}

export async function createBackup(databaseUrl: string, options: { dir?: string; label?: string } = {}): Promise<BackupSummary> {
  const dir = options.dir ?? backupDirectory();
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = join(dir, `programos-${stamp}${options.label ? `-${options.label}` : ''}.ndjson.gz`);
  const client = connect(databaseUrl);
  await client.connect();
  const hash = createHash('sha256');
  let rows = 0;
  try {
    // One snapshot for every table: rows added while the backup runs are not half included.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const list = await tables(client);
    const migrations = list.some((t) => t.name === '_prisma_migrations')
      ? (await client.query<{ migration_name: string }>(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`)).rows.map((r) => r.migration_name)
      : [];
    const gzip = createGzip({ level: 6 });
    const sink = createWriteStream(file);
    const finished = new Promise<void>((resolve, reject) => {
      sink.on('finish', () => resolve());
      sink.on('error', reject);
      gzip.on('error', reject);
    });
    gzip.pipe(sink);
    const write = (line: object) =>
      new Promise<void>((resolve, reject) => {
        const text = JSON.stringify(line) + '\n';
        hash.update(text);
        gzip.write(text, (err) => (err ? reject(err) : resolve()));
      });
    await write({ kind: 'header', version: BACKUP_VERSION, createdAt: new Date().toISOString(), migrations, tables: list.map((t) => ({ name: t.name, columns: t.columns, dependsOn: t.dependsOn })) });
    for (const t of list) {
      const result = await client.query(`SELECT * FROM "${t.name}"`);
      for (const row of result.rows) {
        const encoded: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) encoded[k] = encodeValue(v);
        await write({ kind: 'row', table: t.name, row: encoded });
        rows += 1;
      }
    }
    await write({ kind: 'footer', rows, tables: list.length });
    await new Promise<void>((resolve) => gzip.end(resolve));
    await finished;
    await client.query('COMMIT');
    const bytes = statSync(file).size;
    return { file, bytes, tables: list.length, rows, checksum: hash.digest('hex') };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    try {
      unlinkSync(file);
    } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

export type RestoreOptions = { allowMigrationMismatch?: boolean; dryRun?: boolean };
export type RestoreSummary = { tables: number; rows: number; migrationsMatch: boolean; dryRun: boolean };

export function readBackup(file: string) {
  const text = gunzipSync(readFileSync(file)).toString('utf8');
  const lines = text.split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
  const header = lines[0];
  const footer = lines[lines.length - 1];
  if (header?.kind !== 'header' || footer?.kind !== 'footer') throw new Error('not a ProgramOS backup file');
  const rows = lines.slice(1, -1) as { kind: 'row'; table: string; row: Record<string, unknown> }[];
  if (rows.length !== Number(footer.rows)) throw new Error(`backup is truncated: ${rows.length} of ${footer.rows} rows`);
  const checksum = createHash('sha256').update(lines.map((l) => JSON.stringify(l) + '\n').join('')).digest('hex');
  return {
    header: header as { version: number; createdAt: string; migrations: string[]; tables: TableInfo[] },
    rows,
    checksum,
  };
}

export async function restoreBackup(databaseUrl: string, file: string, options: RestoreOptions = {}): Promise<RestoreSummary> {
  const { header, rows } = readBackup(file);
  const client = connect(databaseUrl);
  await client.connect();
  try {
    const live = await tables(client);
    const liveMigrations = live.some((t) => t.name === '_prisma_migrations')
      ? (await client.query<{ migration_name: string }>(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`)).rows.map((r) => r.migration_name)
      : [];
    const migrationsMatch = JSON.stringify(liveMigrations) === JSON.stringify(header.migrations ?? []);
    if (!migrationsMatch && !options.allowMigrationMismatch)
      throw new Error(`migration mismatch: backup has [${(header.migrations ?? []).join(', ')}], database has [${liveMigrations.join(', ')}]. Pass --force to restore anyway.`);
    if (options.dryRun) return { tables: header.tables.length, rows: rows.length, migrationsMatch, dryRun: true };

    const liveByName = new Map(live.map((t) => [t.name, t]));
    const order = dependencyOrder(header.tables).filter((name) => liveByName.has(name) && name !== '_prisma_migrations');
    const byTable = new Map<string, Record<string, unknown>[]>();
    for (const r of rows) byTable.set(r.table, [...(byTable.get(r.table) ?? []), r.row]);

    await client.query('BEGIN');
    // Children first when emptying, parents first when filling.
    await client.query(`TRUNCATE ${order.map((n) => `"${n}"`).join(', ')} RESTART IDENTITY CASCADE`);
    let inserted = 0;
    for (const name of order) {
      const columns = liveByName.get(name)!.columns;
      const list = byTable.get(name) ?? [];
      const names = columns.map((c) => `"${c.name}"`).join(', ');
      const casts = columns.map((c, i) => `$${i + 1}::${c.type}`).join(', ');
      for (const row of list) {
        const values = columns.map((c) => decodeValue(row[c.name] ?? null, c.type));
        await client.query(`INSERT INTO "${name}" (${names}) VALUES (${casts})`, values);
        inserted += 1;
      }
    }
    await client.query('COMMIT');
    return { tables: order.length, rows: inserted, migrationsMatch, dryRun: false };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

/** Keep the newest N files in the backup directory. */
export function pruneBackups(dir = backupDirectory(), keep = Number(process.env.BACKUP_KEEP ?? 14)) {
  if (!Number.isFinite(keep) || keep < 1) return [];
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('programos-') && f.endsWith('.ndjson.gz'))
    .sort()
    .reverse();
  const removed = files.slice(keep);
  for (const f of removed) unlinkSync(join(dir, f));
  return removed;
}

/* ------------------------------------------------------------------------ */
/* Off site copy: S3 compatible storage with a hand rolled SigV4 signature,  */
/* so no SDK is needed for one PUT a day.                                    */
/* ------------------------------------------------------------------------ */

export type S3Target = { endpoint: string; region: string; bucket: string; accessKey: string; secretKey: string; prefix?: string };

export function s3TargetFromEnv(env = process.env): S3Target | null {
  const { BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY, BACKUP_S3_SECRET_KEY } = env;
  if (!BACKUP_S3_ENDPOINT || !BACKUP_S3_BUCKET || !BACKUP_S3_ACCESS_KEY || !BACKUP_S3_SECRET_KEY) return null;
  return { endpoint: BACKUP_S3_ENDPOINT.replace(/\/$/, ''), region: env.BACKUP_S3_REGION ?? 'me-south-1', bucket: BACKUP_S3_BUCKET, accessKey: BACKUP_S3_ACCESS_KEY, secretKey: BACKUP_S3_SECRET_KEY, prefix: env.BACKUP_S3_PREFIX ?? 'programos/' };
}

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();

/** AWS Signature Version 4 headers for a single request. Exported for the unit test against the published example. */
export function signS3Request(target: S3Target, method: string, key: string, body: Buffer, now = new Date()) {
  const url = new URL(`${target.endpoint}/${target.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const headers: Record<string, string> = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((h) => `${h}:${headers[h].trim()}\n`)
    .join('');
  const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/${target.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${target.secretKey}`, date), target.region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${target.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { url: url.toString(), headers };
}

export async function uploadBackup(target: S3Target, file: string) {
  const body = readFileSync(file);
  const key = `${target.prefix ?? ''}${basename(file)}`;
  const { url, headers } = signS3Request(target, 'PUT', key, body);
  const response = await fetch(url, { method: 'PUT', headers: { ...headers, 'content-type': 'application/gzip', 'content-length': String(body.length) }, body, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`upload failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
  return `${target.bucket}/${key}`;
}
