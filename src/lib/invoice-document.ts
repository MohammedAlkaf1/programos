import QRCode from 'qrcode';
import { formatMoney, invoiceBreakdown } from './plan-math';
import { formatDate } from './format';
import type { Locale } from '@/i18n/dictionary';

/**
 * The printable tax invoice. One HTML document, Arabic first with the English
 * term beneath each label, sized for A4, rendered to PDF by pdf.ts.
 *
 * Seller details come from the environment (SELLER_NAME, SELLER_NAME_EN,
 * SELLER_VAT_NUMBER, SELLER_CR_NUMBER, SELLER_ADDRESS). When a VAT number is
 * present the document carries the ZATCA phase one QR code: a base64 TLV of
 * seller name, VAT number, timestamp, total and VAT amount.
 */

export type InvoiceDocumentInput = {
  invoice: { number: string; amount: number; netAmount?: number; vatAmount?: number; currency: string; status: string; issuedAt: Date; dueAt: Date; paidAt: Date | null; periodStart: Date; periodEnd: Date; provider: string; providerRef: string | null; note: string | null };
  tenant: { nameAr: string; nameEn: string; slug: string };
  plan: { nameAr: string; nameEn: string };
  locale: Locale;
};

export function sellerFromEnv(env = process.env) {
  return {
    name: env.SELLER_NAME ?? 'ProgramOS',
    nameEn: env.SELLER_NAME_EN ?? env.SELLER_NAME ?? 'ProgramOS',
    vatNumber: env.SELLER_VAT_NUMBER ?? '',
    crNumber: env.SELLER_CR_NUMBER ?? '',
    address: env.SELLER_ADDRESS ?? '',
    email: env.CONTACT_EMAIL ?? '',
    site: (() => {
      try {
        return new URL(env.APP_URL ?? '').host;
      } catch {
        return '';
      }
    })(),
  };
}

function tlv(tag: number, value: string) {
  const bytes = Buffer.from(value, 'utf8');
  return Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
}

/** ZATCA simplified invoice QR payload (phase one). Amounts in major units with two decimals. */
export function zatcaPayload(input: { sellerName: string; vatNumber: string; timestamp: Date; total: number; vat: number }) {
  return Buffer.concat([
    tlv(1, input.sellerName),
    tlv(2, input.vatNumber),
    tlv(3, input.timestamp.toISOString()),
    tlv(4, (input.total / 100).toFixed(2)),
    tlv(5, (input.vat / 100).toFixed(2)),
  ]).toString('base64');
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export async function invoiceHtml(input: InvoiceDocumentInput) {
  const { invoice, tenant, plan, locale } = input;
  const seller = sellerFromEnv();
  const money = (n: number) => formatMoney(n, invoice.currency, locale);
  const { netAmount, vatAmount, amount } = invoiceBreakdown(invoice);
  // Legacy invoices were issued before tax was itemised; they show a 0% line rather than a rate that was never charged.
  const rate = vatAmount ? Math.round((vatAmount / netAmount) * 100) : 0;
  const ar = locale === 'ar';
  const L = (a: string, e: string) => `<span class="l">${esc(ar ? a : e)}</span><span class="s">${esc(ar ? e : a)}</span>`;
  const paid = invoice.status === 'Paid';
  const qr = seller.vatNumber
    ? await QRCode.toDataURL(zatcaPayload({ sellerName: seller.name, vatNumber: seller.vatNumber, timestamp: invoice.paidAt ?? invoice.issuedAt, total: amount, vat: vatAmount }), { margin: 0, width: 240, errorCorrectionLevel: 'M' })
    : null;
  const mark = `<svg viewBox="0 0 64 64" width="42" height="42" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#283543"/><path d="M50 24C50 35 45 42 32 42C21 42 14.5 37 14.5 30C14.5 25 16 21 18 18" fill="none" stroke="#C16325" stroke-width="5.5" stroke-linecap="round"/><circle cx="18" cy="18" r="4.6" fill="#EEEBDF"/><circle cx="32" cy="52.5" r="3.6" fill="#C16325"/></svg>`;

  return `<!doctype html>
<html lang="${locale}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${esc(invoice.number)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm; }
  :root { --navy:#283543; --copper:#c16325; --ivory:#f4f2ea; --muted:#566270; --line:rgba(40,53,67,.14); }
  * { box-sizing: border-box; }
  body { margin:0; font-family:'IBM Plex Sans Arabic','Noto Sans Arabic','Noto Naskh Arabic','Segoe UI',Tahoma,Arial,sans-serif; color:#1b242e; font-size:10.5pt; line-height:1.7; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; gap:16pt; border-bottom:2px solid var(--copper); padding-bottom:12pt; }
  .brand { display:flex; gap:10pt; align-items:center; }
  .brand b { display:block; font-size:14pt; color:var(--navy); }
  .brand span { font-size:9pt; color:var(--muted); }
  h1 { margin:0; font-size:20pt; color:var(--navy); text-align:end; }
  .num { font-size:11pt; color:var(--muted); text-align:end; }
  .badge { display:inline-block; margin-top:6pt; padding:2pt 10pt; border-radius:999px; font-size:9pt; font-weight:600; background:${paid ? '#e3f3e8' : '#fbeee1'}; color:${paid ? '#1d6b3a' : '#9c4e1c'}; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:14pt; margin:16pt 0; }
  .box { background:var(--ivory); border-radius:10pt; padding:12pt 14pt; }
  .box h3 { margin:0 0 6pt; font-size:9pt; color:var(--copper); font-weight:600; letter-spacing:.3px; }
  .box p { margin:0; }
  .box .name { font-weight:600; color:var(--navy); font-size:11.5pt; }
  .meta { display:grid; grid-template-columns:repeat(4,1fr); gap:10pt; margin-bottom:14pt; }
  .meta div { border:1px solid var(--line); border-radius:8pt; padding:8pt 10pt; }
  .l { display:block; font-size:9pt; color:var(--muted); }
  .s { display:block; font-size:8pt; color:#8a939e; }
  .v { display:block; font-weight:600; color:var(--navy); margin-top:2pt; }
  table { width:100%; border-collapse:collapse; margin-top:6pt; }
  th, td { padding:8pt 10pt; text-align:start; border-bottom:1px solid var(--line); vertical-align:top; }
  th { background:var(--navy); color:#eeebdf; font-weight:600; font-size:9.5pt; }
  th:first-child { border-start-start-radius:8pt; } th:last-child { border-start-end-radius:8pt; }
  td.n, th.n { text-align:end; white-space:nowrap; font-variant-numeric:tabular-nums; }
  .totals { margin-top:10pt; margin-inline-start:auto; width:80mm; }
  .totals div { display:flex; justify-content:space-between; padding:5pt 0; border-bottom:1px dashed var(--line); }
  .totals .grand { border-bottom:none; border-top:2px solid var(--navy); margin-top:4pt; padding-top:8pt; font-size:13pt; font-weight:700; color:var(--navy); }
  .foot { display:flex; justify-content:space-between; align-items:flex-end; gap:16pt; margin-top:22pt; padding-top:12pt; border-top:1px solid var(--line); font-size:9pt; color:var(--muted); }
  .foot img { width:34mm; height:34mm; display:block; }
  .note { margin-top:12pt; font-size:9.5pt; color:var(--muted); }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">${mark}<div><b>${esc(ar ? seller.name : seller.nameEn)}</b><span>${esc(ar ? 'منصة إدارة البرامج وقياس الأثر' : 'Program management and impact measurement')}</span></div></div>
    <div>
      <h1>${esc(ar ? 'فاتورة ضريبية' : 'Tax invoice')}</h1>
      <div class="num">${esc(invoice.number)}</div>
      <div style="text-align:end"><span class="badge">${esc(paid ? (ar ? 'مدفوعة' : 'Paid') : ar ? 'مستحقة' : 'Due')}</span></div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <h3>${esc(ar ? 'المورد' : 'Seller')}</h3>
      <p class="name">${esc(ar ? seller.name : seller.nameEn)}</p>
      ${seller.address ? `<p>${esc(seller.address)}</p>` : ''}
      ${seller.vatNumber ? `<p>${esc(ar ? 'الرقم الضريبي' : 'VAT number')}: <bdi>${esc(seller.vatNumber)}</bdi></p>` : ''}
      ${seller.crNumber ? `<p>${esc(ar ? 'السجل التجاري' : 'CR number')}: <bdi>${esc(seller.crNumber)}</bdi></p>` : ''}
      ${seller.email ? `<p><bdi>${esc(seller.email)}</bdi></p>` : ''}
    </div>
    <div class="box">
      <h3>${esc(ar ? 'العميل' : 'Customer')}</h3>
      <p class="name">${esc(ar ? tenant.nameAr : tenant.nameEn)}</p>
      <p>${esc(ar ? tenant.nameEn : tenant.nameAr)}</p>
      <p>${esc(ar ? 'معرّف مساحة العمل' : 'Workspace')}: <bdi>${esc(tenant.slug)}</bdi></p>
    </div>
  </div>

  <div class="meta">
    <div>${L('تاريخ الإصدار', 'Issue date')}<span class="v">${formatDate(invoice.issuedAt, locale)}</span></div>
    <div>${L('تاريخ الاستحقاق', 'Due date')}<span class="v">${formatDate(invoice.dueAt, locale)}</span></div>
    <div>${L('فترة الخدمة', 'Service period')}<span class="v">${formatDate(invoice.periodStart, locale)} → ${formatDate(invoice.periodEnd, locale)}</span></div>
    <div>${L('طريقة الدفع', 'Payment')}<span class="v">${esc(invoice.provider === 'moyasar' ? (ar ? 'دفع إلكتروني' : 'Online payment') : ar ? 'تحويل بنكي' : 'Bank transfer')}${invoice.providerRef ? ` · <bdi>${esc(invoice.providerRef)}</bdi>` : ''}</span></div>
  </div>

  <table>
    <thead><tr><th>${esc(ar ? 'البند' : 'Item')}</th><th>${esc(ar ? 'الفترة' : 'Period')}</th><th class="n">${esc(ar ? 'المبلغ قبل الضريبة' : 'Net amount')}</th><th class="n">${esc(ar ? `الضريبة ${rate}%` : `VAT ${rate}%`)}</th><th class="n">${esc(ar ? 'الإجمالي' : 'Total')}</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>${esc(ar ? plan.nameAr : plan.nameEn)}</strong><br><span style="color:var(--muted);font-size:9pt">${esc(ar ? 'اشتراك شهري في منصة برنامج أو إس' : 'Monthly ProgramOS subscription')}</span></td>
        <td>${formatDate(invoice.periodStart, locale)}<br>${formatDate(invoice.periodEnd, locale)}</td>
        <td class="n">${money(netAmount)}</td>
        <td class="n">${money(vatAmount)}</td>
        <td class="n">${money(amount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div><span>${esc(ar ? 'المجموع قبل الضريبة' : 'Subtotal')}</span><span>${money(netAmount)}</span></div>
    <div><span>${esc(ar ? `ضريبة القيمة المضافة ${rate}%` : `VAT ${rate}%`)}</span><span>${money(vatAmount)}</span></div>
    <div class="grand"><span>${esc(ar ? 'الإجمالي المستحق' : 'Total due')}</span><span>${money(amount)}</span></div>
    ${paid && invoice.paidAt ? `<div><span>${esc(ar ? 'تاريخ السداد' : 'Paid on')}</span><span>${formatDate(invoice.paidAt, locale)}</span></div>` : ''}
  </div>

  ${invoice.note ? `<p class="note">${esc(invoice.note)}</p>` : ''}

  <div class="foot">
    <div>
      <p style="margin:0 0 4pt">${esc(ar ? 'هذه الفاتورة صادرة إلكترونيًا من منصة برنامج أو إس ولا تحتاج توقيعًا.' : 'Issued electronically by ProgramOS; no signature is required.')}</p>
      ${seller.site ? `<p style="margin:0"><bdi>${esc(seller.site)}</bdi></p>` : ''}
      ${!seller.vatNumber ? `<p style="margin:4pt 0 0;color:#9c4e1c">${esc(ar ? 'لم يُضبط الرقم الضريبي للمورد بعد، فلا يحمل المستند رمز هيئة الزكاة والضريبة والجمارك.' : 'The seller VAT number is not configured, so the ZATCA QR code is omitted.')}</p>` : ''}
    </div>
    ${qr ? `<img src="${qr}" alt="ZATCA QR">` : ''}
  </div>
</body>
</html>`;
}
