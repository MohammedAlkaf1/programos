/**
 * Every way a live session can stop matching the account behind it, and the
 * proof that none of them strands the user in a redirect loop.
 *
 *   npm run check:session
 *
 * Requires the dev server on 127.0.0.1:3000.
 */
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const BASE = 'http://127.0.0.1:3000';
let failures = 0;

function check(label: string, ok: boolean, extra = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
}

/** Signs in and returns the session cookie jar as a header string. */
async function signIn(email: string, password: string) {
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  const jar = new Map<string, string>();
  const collect = (response: Response) => {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
  };
  collect(csrfResponse);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const cookieHeader = () =>
    [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');

  const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: BASE,
      cookie: cookieHeader(),
    },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/ar` }),
  });
  collect(login);
  return cookieHeader;
}

/** Walks redirects manually so a loop shows up as a hop count, not a hang. */
async function hops(path: string, cookie: string, limit = 8) {
  let url = `${BASE}${path}`;
  const trail: string[] = [];
  for (let i = 0; i < limit; i += 1) {
    const response = await fetch(url, { redirect: 'manual', headers: { cookie } });
    trail.push(`${new URL(url).pathname} ${response.status}`);
    const location = response.headers.get('location');
    if (!location) return { trail, looped: false, final: response.status };
    url = new URL(location, BASE).toString();
  }
  return { trail, looped: true, final: 0 };
}

async function main() {
  const password = 'Demo@12345';

  console.log('\n1. a healthy session still skips the sign-in page');
  {
    const cookie = await signIn('admin@programos.sa', password);
    const dashboard = await hops('/ar', cookie());
    const login = await hops('/ar/login', cookie());
    check('dashboard renders', !dashboard.looped && dashboard.final === 200, dashboard.trail.join(' -> '));
    check('sign-in redirects to the dashboard', !login.looped && login.trail.length === 2,
          login.trail.join(' -> '));
  }

  console.log('\n2. the account is deactivated while signed in');
  {
    const user = await db.user.findUniqueOrThrow({ where: { email: 'manager@programos.sa' } });
    const cookie = await signIn('manager@programos.sa', password);
    await db.user.update({ where: { id: user.id }, data: { active: false } });
    try {
      const dashboard = await hops('/ar', cookie());
      const login = await hops('/ar/login', cookie());
      check('no loop on the dashboard', !dashboard.looped, dashboard.trail.join(' -> '));
      check('sign-in form is reachable', !login.looped && login.final === 200,
            login.trail.join(' -> '));
    } finally {
      await db.user.update({ where: { id: user.id }, data: { active: true } });
    }
  }

  console.log('\n3. the last membership is revoked while signed in');
  {
    const user = await db.user.findUniqueOrThrow({ where: { email: 'coordinator@programos.sa' } });
    const cookie = await signIn('coordinator@programos.sa', password);
    await db.membership.updateMany({ where: { userId: user.id }, data: { active: false } });
    try {
      const dashboard = await hops('/ar', cookie());
      const login = await hops('/ar/login', cookie());
      check('no loop on the dashboard', !dashboard.looped, dashboard.trail.join(' -> '));
      check('sign-in form is reachable', !login.looped && login.final === 200,
            login.trail.join(' -> '));
    } finally {
      await db.membership.updateMany({ where: { userId: user.id }, data: { active: true } });
    }
  }

  console.log('\n4. the tenant cookie names a workspace the user has left');
  {
    const cookie = await signIn('admin@programos.sa', password);
    const other = await db.tenant.findFirstOrThrow({ where: { slug: 'bina' } });
    // A tenant id the user has no membership for at all.
    const orphan = '00000000-0000-4000-8000-000000000000';
    const withOrphan = `${cookie()}; programos.tenant=${orphan}`;
    const dashboard = await hops('/ar', withOrphan);
    check('falls back to a workspace they do belong to',
          !dashboard.looped && dashboard.final === 200, dashboard.trail.join(' -> '));

    const valid = `${cookie()}; programos.tenant=${other.id}`;
    const switched = await hops('/ar', valid);
    check('a valid tenant cookie still works', !switched.looped && switched.final === 200,
          switched.trail.join(' -> '));
  }

  /* The case that actually bit us: the account behind a live session is gone
     entirely, as after a database restore or a reseed. */
  console.log('\n5. the account behind the session is deleted');
  {
    const { hash } = await import('bcryptjs');
    const stamp = Date.now().toString(36);
    const tenant = await db.tenant.create({
      data: { slug: `ghost-${stamp}`, nameAr: 'مؤسسة مؤقتة', nameEn: `Ghost ${stamp}` },
    });
    const user = await db.user.create({
      data: {
        email: `ghost-${stamp}@example.invalid`,
        name: 'حساب مؤقت',
        password: await hash(password, 10),
        verified: true,
      },
    });
    await db.membership.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'Admin', programIds: [] },
    });

    const cookie = await signIn(user.email, password);
    const before = await hops('/ar', cookie());
    check('signs in normally first', !before.looped && before.final === 200,
          before.trail.join(' -> '));

    // Delete the account out from under the live session.
    await db.membership.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.tenant.delete({ where: { id: tenant.id } });

    const dashboard = await hops('/ar', cookie());
    const login = await hops('/ar/login', cookie());
    check('dashboard does not loop', !dashboard.looped, dashboard.trail.join(' -> '));
    check('sign-in form renders instead of bouncing', !login.looped && login.final === 200,
          login.trail.join(' -> '));
    check('reaching the form takes one hop at most', login.trail.length <= 1,
          login.trail.join(' -> '));
  }

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nno session state produces a redirect loop');
  if (failures) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
