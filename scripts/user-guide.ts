/**
 * Builds the Arabic user guide as a PDF and places it at
 * public/docs/ProgramOS_User_Guide_AR.pdf, where the site footer links to it.
 *
 *   npm run docs:guide
 *
 * Needs the dev server (npm run dev) and the database (npm run db:start),
 * because the screenshots are taken live from the seeded demo workspace with
 * the demo admin account, so the pictures always match the product as built.
 * The text lives in scripts/user-guide/guide.ar.html; this script only fills
 * in the screenshots and prints the page.
 */
import 'dotenv/config';
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from '@playwright/test';
import {db} from '../src/lib/db';
import {otp, unseal} from '../src/lib/totp';

const base = process.env.GUIDE_BASE_URL ?? 'http://127.0.0.1:3000';
const root = process.cwd();
const template = readFileSync(join(root, 'scripts', 'user-guide', 'guide.ar.html'), 'utf8');
const outDir = join(root, 'public', 'docs');
const shotDir = join(root, 'data', 'guide-shots');
mkdirSync(outDir, {recursive: true});
mkdirSync(shotDir, {recursive: true});

/** Screens to photograph: placeholder name, path inside the app, and what to wait for. */
const SHOTS: {name: string; path: string; height?: number; before?: string}[] = [
  {name: 'login', path: '/ar/login', height: 900, before: 'public'},
  {name: 'dashboard', path: '/ar', height: 900},
  {name: 'programs', path: '/ar/programs', height: 760},
  {name: 'applications', path: '/ar/applications', height: 900},
  {name: 'beneficiaries', path: '/ar/beneficiaries', height: 900},
  {name: 'activities', path: '/ar/activities', height: 760},
  {name: 'impact', path: '/ar/impact', height: 900},
  {name: 'reports', path: '/ar/reports', height: 1000},
  {name: 'privacy', path: '/ar/privacy', height: 900},
  {name: 'team', path: '/ar/team', height: 900},
  {name: 'integrations', path: '/ar/integrations', height: 900},
  {name: 'billing', path: '/ar/billing', height: 760},
  {name: 'assistant', path: '/ar/assistant', height: 760},
];

async function main() {
  const admin = await db.user.findFirst({where: {email: 'admin@programos.sa'}});
  if (!admin?.mfaSecret) throw new Error('demo admin not provisioned: run npm run db:seed and npm run demo:mfa first');
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1.5});

  // Public screens first, then sign in as the demo admin for the application.
  const images: Record<string, string> = {};
  for (const shot of SHOTS.filter((s) => s.before === 'public')) {
    await page.goto(`${base}${shot.path}`, {waitUntil: 'domcontentloaded'});
    await page.addStyleTag({content: 'nextjs-portal{display:none}'});
    await page.waitForTimeout(1200);
    const file = join(shotDir, `${shot.name}.png`);
    await page.screenshot({path: file, clip: {x: 0, y: 0, width: 1440, height: shot.height ?? 900}});
    images[shot.name] = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  }
  await page.goto(`${base}/ar/login`, {waitUntil: 'domcontentloaded'});
  await page.locator('input[type=email]').fill(admin.email);
  await page.locator('input[type=password]').fill('Demo@12345');
  await page.locator('input[autocomplete="one-time-code"]').fill(otp(unseal(admin.mfaSecret), Math.floor(Date.now() / 30000)));
  await page.locator('button[type=submit]').click();
  await page.waitForURL(`${base}/ar`, {timeout: 60000});
  for (const shot of SHOTS.filter((s) => s.before !== 'public')) {
    await page.goto(`${base}${shot.path}`, {waitUntil: 'domcontentloaded'});
    await page.addStyleTag({content: 'nextjs-portal{display:none}'});
    await page.waitForTimeout(1800);
    const file = join(shotDir, `${shot.name}.png`);
    await page.screenshot({path: file, clip: {x: 0, y: 0, width: 1440, height: shot.height ?? 900}});
    images[shot.name] = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  }

  const html = template
    .replace(/\{\{shot:([a-z-]+)\}\}/g, (_, name: string) => images[name] ?? '')
    .replace(/\{\{date\}\}/g, new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', {dateStyle: 'long'}).format(new Date()))
    .replace(/\{\{version\}\}/g, JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version ?? '1.0');

  writeFileSync(join(shotDir, 'guide.html'), html);
  const doc = await browser.newPage();
  await doc.setContent(html, {waitUntil: 'networkidle'});
  await doc.evaluate(() => document.fonts.ready);
  const target = join(outDir, 'ProgramOS_User_Guide_AR.pdf');
  await doc.pdf({
    path: target,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;font-size:9px;color:#8a939e;padding:0 14mm;display:flex;justify-content:space-between;direction:rtl;font-family:Arial,sans-serif"><span>ProgramOS · دليل المستخدم</span><span class="pageNumber"></span></div>',
    margin: {top: '16mm', bottom: '18mm', left: '14mm', right: '14mm'},
  });
  await browser.close();
  console.log(`guide written: ${target} (${(readFileSync(target).length / 1024).toFixed(0)} KB)`);
  if (!existsSync(target)) throw new Error('pdf not written');
}

try {
  await main();
} finally {
  await db.$disconnect();
}
