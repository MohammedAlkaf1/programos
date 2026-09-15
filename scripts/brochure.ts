/**
 * Builds the Arabic marketing brochure as a PDF and places it at
 * public/docs/ProgramOS_Brochure_AR.pdf, where the site footer links to it.
 *
 *   npm run docs:brochure
 *
 * Like docs:guide it needs the dev server and the database, because the three
 * product screenshots are taken live from the seeded demo workspace. The copy
 * lives in scripts/marketing/brochure.ar.html and mirrors src/i18n/site.ts.
 *
 * The contact block reads BROCHURE_SITE and BROCHURE_EMAIL, falling back to
 * the host of APP_URL and CONTACT_EMAIL. Set them before printing for a client.
 */
import 'dotenv/config';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from '@playwright/test';
import {db} from '../src/lib/db';
import {otp, unseal} from '../src/lib/totp';

const base = process.env.GUIDE_BASE_URL ?? 'http://127.0.0.1:3000';
const root = process.cwd();
const template = readFileSync(join(root, 'scripts', 'marketing', 'brochure.ar.html'), 'utf8');
const outDir = join(root, 'public', 'docs');
const shotDir = join(root, 'data', 'brochure-shots');
mkdirSync(outDir, {recursive: true});
mkdirSync(shotDir, {recursive: true});

const SHOTS: {name: string; path: string; height: number}[] = [
  {name: 'dashboard', path: '/ar', height: 820},
  {name: 'impact', path: '/ar/impact', height: 760},
  {name: 'reports', path: '/ar/reports', height: 820},
];

function siteLabel() {
  if (process.env.BROCHURE_SITE) return process.env.BROCHURE_SITE;
  try {
    const host = new URL(process.env.APP_URL ?? '').host;
    if (host && !/localhost|127\.0\.0\.1/.test(host)) return host;
  } catch {}
  return 'programos.sa';
}

async function main() {
  const admin = await db.user.findFirst({where: {email: 'admin@programos.sa'}});
  if (!admin?.mfaSecret) throw new Error('demo admin not provisioned: run npm run db:seed and npm run demo:mfa first');
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 2});

  await page.goto(`${base}/ar/login`, {waitUntil: 'domcontentloaded'});
  await page.locator('input[type=email]').fill(admin.email);
  await page.locator('input[type=password]').fill('Demo@12345');
  await page.locator('input[autocomplete="one-time-code"]').fill(otp(unseal(admin.mfaSecret), Math.floor(Date.now() / 30000)));
  await page.locator('button[type=submit]').click();
  await page.waitForURL(`${base}/ar`, {timeout: 60000});

  const images: Record<string, string> = {};
  for (const shot of SHOTS) {
    await page.goto(`${base}${shot.path}`, {waitUntil: 'domcontentloaded'});
    await page.addStyleTag({content: 'nextjs-portal{display:none}'});
    await page.waitForTimeout(1800);
    const file = join(shotDir, `${shot.name}.png`);
    await page.screenshot({path: file, clip: {x: 0, y: 0, width: 1440, height: shot.height}});
    images[shot.name] = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  }

  const email = process.env.BROCHURE_EMAIL ?? (process.env.CONTACT_EMAIL && !/\.local$/.test(process.env.CONTACT_EMAIL) ? process.env.CONTACT_EMAIL : `hello@${siteLabel()}`);
  const html = template
    .replace(/\{\{shot:([a-z-]+)\}\}/g, (_, name: string) => images[name] ?? '')
    .replace(/\{\{date\}\}/g, new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', {month: 'long', year: 'numeric'}).format(new Date()))
    .replace(/\{\{year\}\}/g, String(new Date().getFullYear()))
    .replace(/\{\{site\}\}/g, siteLabel())
    .replace(/\{\{email\}\}/g, email);

  writeFileSync(join(shotDir, 'brochure.html'), html);
  const doc = await browser.newPage();
  await doc.setContent(html, {waitUntil: 'networkidle'});
  await doc.evaluate(() => document.fonts.ready);
  const target = join(outDir, 'ProgramOS_Brochure_AR.pdf');
  await doc.pdf({path: target, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: {top: 0, bottom: 0, left: 0, right: 0}});
  await browser.close();
  console.log(`brochure written: ${target} (${(readFileSync(target).length / 1024).toFixed(0)} KB); site ${siteLabel()}, email ${email}`);
}

try {
  await main();
} finally {
  await db.$disconnect();
}
