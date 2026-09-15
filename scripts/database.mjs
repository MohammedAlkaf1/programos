import 'dotenv/config';
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';

const databaseDir = path.resolve('data/postgres');
const db = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: process.env.LOCAL_DATABASE_PASSWORD,
  port: 55432,
  persistent: true,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1'],
  // On Windows initdb inherits the system codepage (WIN1252 on an Arabic or
  // Western locale), which cannot store Arabic text. Force a UTF-8 cluster.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: () => {},
});

if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await db.initialise();
await db.start();

const client = db.getPgClient();
await client.connect();

const existing = await client.query(
  "SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname='programos'",
);

if (existing.rowCount && existing.rows[0].encoding !== 'UTF8') {
  await client.end();
  await db.stop();
  throw new Error('The existing programos database requires an explicit UTF8 migration. Its data has been preserved.');
}

if (!existing.rowCount) {
  // template0 is required to override the encoding inherited from template1.
  await client.query(
    "CREATE DATABASE programos WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'",
  );
}

await client.end();
console.log('ProgramOS database ready on localhost:55432 (UTF8)');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await db.stop();
    process.exit(0);
  });
}
setInterval(() => {}, 30000);
