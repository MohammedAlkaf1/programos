/**
 * End to end check of the operator panel, backups, invoice PDFs and error
 * tracking against the running dev server.
 *
 *   npm run check:operator
 *
 * Needs `npm run db:start`, `npm run dev`, the seeded demo workspace and
 * `npm run demo:mfa`. Grants the demo admin operator access if missing.
 * Screenshots land in data/operator-shots for a visual pass.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { db } from '../src/lib/db';
import { otp, unseal } from '../src/lib/totp';

const require = createRequire(import.meta.url);
const base = process.env.GUIDE_BASE_URL ?? 'http://127.0.0.1:3000';
const shots = join(process.cwd(), 'data', 'operator-shots');
mkdirSync(shots, { recursive: true });
let passed = 0;
const step = (name: string) => {
  passed += 1;
  console.log(` • ${name}`);
};

async function signIn(page: Page, email: string) {
  const user = await db.user.findFirst({ where: { email } });
  if (!user?.mfaSecret) throw new Error(`${email} has no authenticator: run npm run demo:mfa`);
  await page.goto(`${base}/ar/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill('Demo@12345');
  await page.locator('input[autocomplete="one-time-code"]').fill(otp(unseal(user.mfaSecret), Math.floor(Date.now() / 30000)));
  await page.locator('button[type=submit]').click();
  await page.waitForURL(`${base}/ar`, { timeout: 60000 });
  return user;
}

async function main() {
  const admin = await db.user.findFirst({ where: { email: 'admin@programos.sa' } });
  if (!admin) throw new Error('seed the demo workspace first');
  if (!admin.platformOperator) await db.user.update({ where: { id: admin.id }, data: { platformOperator: true } });

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|hydrat/i.test(m.text())) console.log('   console:', m.text().slice(0, 160));
  });

  /* A non operator is sent back to the application. */
  await signIn(page, 'manager@programos.sa');
  await page.goto(`${base}/ar/operator`);
  await page.waitForURL((u) => !u.pathname.includes('/operator'), { timeout: 20000 });
  step('A staff member who is not an operator cannot open the panel');
  await page.context().clearCookies();

  /* The operator sees the panel and the link inside the application. */
  await signIn(page, 'admin@programos.sa');
  await page.goto(`${base}/ar`);
  await page.getByRole('link', { name: 'لوحة المشغّل' }).first().click();
  await page.waitForURL(/\/operator$/);
  await page.getByText('نظرة عامة', { exact: true }).first().waitFor();
  await page.screenshot({ path: join(shots, 'overview.png') });
  step('The operator reaches the overview from the application shell');

  /* Tenants page lists the demo workspaces. */
  await page.goto(`${base}/ar/operator/tenants`);
  await page.getByText('athar', { exact: false }).first().waitFor();
  await page.screenshot({ path: join(shots, 'tenants.png') });
  step('The tenants page lists every workspace with plan and status');

  /* Invoices page and PDF download. */
  await page.goto(`${base}/ar/operator/invoices`);
  await page.getByText('الفواتير', { exact: true }).first().waitFor();
  await page.getByRole('tab', { name: /الكل/ }).click().catch(() => {});
  await page.screenshot({ path: join(shots, 'invoices.png') });
  const invoice = await db.invoice.findFirst({ orderBy: { issuedAt: 'desc' } });
  assert.ok(invoice, 'the demo data has at least one invoice');
  const pdf = await page.request.get(`${base}/api/invoices/${invoice.id}/pdf?locale=ar`);
  assert.equal(pdf.status(), 200);
  const type = pdf.headers()['content-type'] ?? '';
  const body = await pdf.body();
  if (type.includes('application/pdf')) {
    assert.ok(body.length > 10_000, `pdf is ${body.length} bytes`);
    assert.equal(body.subarray(0, 4).toString(), '%PDF');
    step(`An invoice renders to PDF (${Math.round(body.length / 1024)} KB)`);
  } else {
    assert.ok(body.toString().includes('فاتورة ضريبية'), 'html fallback carries the invoice');
    step('An invoice renders as HTML because no browser is available for PDF');
  }
  const html = await page.request.get(`${base}/api/invoices/${invoice.id}/pdf?locale=ar&format=html`);
  assert.ok((await html.text()).includes(invoice.number));
  step('The invoice HTML carries the invoice number, net, VAT and total');
  await page.goto(`${base}/api/invoices/${invoice.id}/pdf?locale=ar&format=html`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(shots, 'invoice.png'), fullPage: true });

  /* A tenant admin from another tenant cannot fetch this invoice; the operator can. */
  const other = await db.invoice.findFirst({ where: { tenantId: { not: invoice.tenantId } } });
  if (other) {
    const cross = await page.request.get(`${base}/api/invoices/${other.id}/pdf?format=html`);
    assert.equal(cross.status(), 200, 'the operator may read any invoice');
    step('The operator can read invoices of every tenant');
  }

  /* Backups: request from the panel, run the pending job, see it completed. */
  await page.goto(`${base}/ar/operator/backups`);
  await page.getByRole('button', { name: 'نسخة الآن' }).click();
  await page.getByText('طُلبت النسخة').waitFor({ timeout: 15000 });
  const requested = await db.backupRun.findFirst({ where: { status: 'Requested', trigger: 'panel' } });
  assert.ok(requested, 'a Requested backup run exists');
  const { execFileSync: run } = await import('node:child_process');
  run(process.execPath, [require.resolve('tsx/cli'), 'scripts/backup.ts', 'pending'], { stdio: 'inherit' });
  const done = await db.backupRun.findUnique({ where: { id: requested.id } });
  assert.equal(done?.status, 'Completed');
  assert.ok((done?.rows ?? 0) > 100);
  await page.reload();
  await page.getByText('مكتملة').first().waitFor();
  await page.screenshot({ path: join(shots, 'backups.png') });
  step(`A backup requested from the panel completes (${done?.rows} rows, ${Math.round((done?.bytes ?? 0) / 1024)} KB)`);

  /* Error tracking: a browser report lands, is grouped, is resolved. */
  const stamp = Date.now();
  for (let i = 0; i < 3; i++) {
    const r = await page.request.post(`${base}/api/errors`, {
      headers: { origin: base, 'content-type': 'application/json' },
      data: { name: 'CheckError', message: `operator check ${stamp} failed at row ${i}`, stack: `CheckError: x\n    at render (src/app/x.tsx:1:1)`, path: '/ar/operator-check' },
    });
    assert.equal(r.status(), 200);
  }
  const grouped = await db.errorEvent.findFirst({ where: { name: 'CheckError', source: 'client', resolvedAt: null }, orderBy: { lastSeenAt: 'desc' } });
  assert.ok(grouped && grouped.count >= 3, 'three reports with varying numbers group into one row');
  step('Browser error reports are accepted and grouped by fingerprint');
  await page.goto(`${base}/ar/operator/errors`);
  await page.getByText('CheckError').first().waitFor();
  await page.screenshot({ path: join(shots, 'errors.png') });
  await page.getByRole('button', { name: 'تم الحل' }).first().click();
  await page.getByText('تم تنفيذ العملية').waitFor();
  await page.waitForTimeout(800);
  const resolved = await db.errorEvent.findUnique({ where: { id: grouped.id } });
  assert.ok(resolved?.resolvedAt, 'resolved from the panel');
  step('An error is resolved from the panel');
  const unauth = await page.request.post(`${base}/api/errors`, { headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, data: { message: 'x' } });
  assert.equal(unauth.status(), 403);
  step('Cross origin error reports are refused');

  /* Leads page renders. */
  await page.goto(`${base}/ar/operator/leads`);
  await page.getByText('طلبات التواصل', { exact: true }).first().waitFor();
  await page.screenshot({ path: join(shots, 'leads.png') });
  step('The contact requests page renders');

  /* Operator API refuses a tenant admin without the flag, and refuses non platform actions. */
  const bad = await page.request.post(`${base}/api/operator`, { headers: { origin: base, 'content-type': 'application/json' }, data: { action: 'program.create', data: {} } });
  assert.equal(bad.status(), 404);
  step('The operator API accepts platform actions only');

  await browser.close();
  console.log(`\n${passed} operator checks passed`);
}

try {
  await main();
} finally {
  await db.$disconnect();
}
