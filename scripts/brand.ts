/**
 * Exports the brand assets that cannot be hand written: PNG renditions of the
 * mark and the lockups (with the real IBM Plex Sans Arabic face), the Apple
 * touch icon, and a one page brand sheet.
 *
 *   npm run brand:export
 *
 * Sources of truth are the SVG files in public/brand. Needs internet for the
 * font and the Microsoft Edge channel of Playwright, like docs:guide.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from '@playwright/test';

const root = process.cwd();
const brandDir = join(root, 'public', 'brand');
const outDir = join(brandDir, 'png');
mkdirSync(outDir, {recursive: true});

const svg = (name: string) => readFileSync(join(brandDir, `${name}.svg`), 'utf8');
const FONT = `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">`;
const BASE = `<meta charset="utf-8">${FONT}<style>*{box-sizing:border-box}body{margin:0;font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif}svg{display:block}</style>`;

/** Each export: an element id, the html around it, output size in CSS px, and scale. */
const EXPORTS: {file: string; html: string; width: number; height: number; scale: number; transparent?: boolean}[] = [
  {file: 'programos-mark-1024.png', html: svg('programos-mark'), width: 512, height: 512, scale: 2, transparent: true},
  {file: 'programos-mark-copper-1024.png', html: svg('programos-mark-copper'), width: 512, height: 512, scale: 2, transparent: true},
  {file: 'programos-mark-mono-navy-1024.png', html: svg('programos-mark-mono-navy'), width: 512, height: 512, scale: 2, transparent: true},
  {file: 'programos-mark-mono-white-1024.png', html: svg('programos-mark-mono-white'), width: 512, height: 512, scale: 2, transparent: true},
  {file: 'programos-lockup-ar.png', html: svg('programos-lockup-ar'), width: 1020, height: 192, scale: 2, transparent: true},
  {file: 'programos-lockup-en.png', html: svg('programos-lockup-en'), width: 1020, height: 192, scale: 2, transparent: true},
  {file: 'programos-lockup-ar-dark.png', html: svg('programos-lockup-ar-dark'), width: 1020, height: 192, scale: 2, transparent: true},
  {file: 'programos-lockup-en-dark.png', html: svg('programos-lockup-en-dark'), width: 1020, height: 192, scale: 2, transparent: true},
  {file: 'apple-icon.png', html: svg('programos-mark'), width: 180, height: 180, scale: 1},
];

const SHEET = `
<style>
 body{background:#f4f2ea;color:#283543;padding:40px;direction:rtl}
 h1{font-size:28px;margin:0 0 4px;font-weight:700}
 .lead{color:#566270;font-size:14px;margin:0 0 28px}
 .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:28px}
 .tile{background:#fff;border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;min-height:180px}
 .tile.dark{background:#283543;color:#eeebdf}.tile.ivory{background:#eeebdf}.tile.copper{background:#C16325;color:#eeebdf}
 .tile small{font-size:11px;color:#8a939e}.dark small,.copper small{color:#d6dae0}
 .swatches{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:28px}
 .sw{border-radius:16px;padding:18px;min-height:110px;display:flex;flex-direction:column;justify-content:flex-end}
 .sw b{font-size:15px}.sw span{font-size:12px;opacity:.85;direction:ltr;text-align:right}
 .story{background:#fff;border-radius:16px;padding:24px;display:grid;grid-template-columns:1fr 2fr;gap:24px;align-items:center;font-size:14px;line-height:1.9}
 .story h2{margin:0 0 6px;font-size:18px}
 .lock{display:flex;align-items:center;gap:14px}
 .sizes{display:flex;gap:14px;align-items:flex-end}
</style>
<h1>هوية برنامج أو إس</h1>
<p class="lead">العلامة والألوان والخط، في صفحة واحدة.</p>
<div class="grid">
 <div class="tile"><div style="width:120px">${svg('programos-mark')}</div><small>العلامة الأساسية</small></div>
 <div class="tile dark"><div style="width:120px">${svg('programos-mark-copper')}</div><small>على الكحلي</small></div>
 <div class="tile ivory"><div style="width:120px">${svg('programos-mark-mono-navy')}</div><small>لون واحد</small></div>
 <div class="tile dark"><div style="width:120px">${svg('programos-mark-mono-white')}</div><small>لون واحد على الداكن</small></div>
</div>
<div class="grid" style="grid-template-columns:1fr 1fr">
 <div class="tile" style="align-items:stretch"><div style="width:100%">${svg('programos-lockup-ar')}</div><div style="width:100%">${svg('programos-lockup-en')}</div></div>
 <div class="tile dark" style="align-items:stretch"><div style="width:100%">${svg('programos-lockup-ar-dark')}</div><div style="width:100%">${svg('programos-lockup-en-dark')}</div></div>
</div>
<div class="swatches">
 <div class="sw" style="background:#283543;color:#eeebdf"><b>كحلي</b><span>#283543</span></div>
 <div class="sw" style="background:#C16325;color:#fff"><b>نحاسي</b><span>#C16325</span></div>
 <div class="sw" style="background:#EEEBDF;color:#283543;border:1px solid #d6dae0"><b>عاجي</b><span>#EEEBDF</span></div>
</div>
<div class="story">
 <div class="sizes"><div style="width:96px">${svg('programos-mark')}</div><div style="width:48px">${svg('programos-mark')}</div><div style="width:24px">${svg('programos-mark')}</div><div style="width:16px">${svg('programos-mark')}</div></div>
 <div><h2>فكرة العلامة</h2>حرف الباء، أول حرف في كلمة برنامج، مرسوم كمسار يبدأ من اليمين وينخفض ثم يصعد إلى اليسار، في اتجاه القراءة العربية. النقطة العاجية في نهاية المسار هي المستفيد الذي وصل، ونقطة الباء النحاسية تحت القوس تحفظ هوية الحرف. الخط للنصوص كلها: IBM Plex Sans Arabic.</div>
</div>`;

async function main() {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  for (const item of EXPORTS) {
    const page = await browser.newPage({viewport: {width: item.width, height: item.height}, deviceScaleFactor: item.scale});
    const html = `${BASE}<style>body{${item.transparent ? 'background:transparent' : 'background:#283543'}}svg{width:${item.width}px;height:${item.height}px}</style>${item.html}`;
    await page.setContent(html, {waitUntil: 'networkidle'});
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path: join(outDir, item.file), omitBackground: Boolean(item.transparent)});
    await page.close();
  }
  const sheet = await browser.newPage({viewport: {width: 1280, height: 1000}, deviceScaleFactor: 2});
  await sheet.setContent(`${BASE}${SHEET}`, {waitUntil: 'networkidle'});
  await sheet.evaluate(() => document.fonts.ready);
  await sheet.screenshot({path: join(outDir, 'programos-brand-sheet.png'), fullPage: true});
  await browser.close();
  // Next.js serves src/app/apple-icon.png as the touch icon.
  writeFileSync(join(root, 'src', 'app', 'apple-icon.png'), readFileSync(join(outDir, 'apple-icon.png')));
  console.log(`brand assets written to ${outDir} (${EXPORTS.length + 1} files) and src/app/apple-icon.png`);
}

await main();
