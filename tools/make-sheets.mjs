// Printable A4 sheets: tracked art at exactly 180 x 230 mm (the very PNG that was compiled) + margin furniture.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PDFDocument } from 'pdf-lib';
import { ROOT, SHEETS, QR_URL, ART_MM } from './config.mjs';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const printDir = path.join(ROOT, 'markers', 'print');
fs.mkdirSync(printDir, { recursive: true });

// A4 portrait 210 x 297. Art centred horizontally, 12 mm from the top. Everything else sits in the white margin.
const ART_X = (210 - ART_MM.w) / 2, ART_Y = 12;
const FOOT_Y = ART_Y + ART_MM.h; // 242
const html = (s) => `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><title>Sheet ${s.n}</title>
<style>
@page { size: 210mm 297mm; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { width: 210mm; height: 297mm; background: #fff; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.page { position: relative; width: 210mm; height: 297mm; overflow: hidden }
.art { position: absolute; left: ${ART_X}mm; top: ${ART_Y}mm; width: ${ART_MM.w}mm; height: ${ART_MM.h}mm; display: block }
.key { position: absolute; left: ${ART_X - 0.8}mm; top: ${ART_Y - 0.8}mm; width: ${ART_MM.w + 1.6}mm; height: ${ART_MM.h + 1.6}mm; border: 0.2mm solid #555 }
.crop { position: absolute; background: #555 }
.foot { position: absolute; left: ${ART_X}mm; top: ${FOOT_Y + 6}mm; width: ${ART_MM.w}mm; height: 40mm; display: flex; justify-content: space-between; align-items: center }
.txt { width: 130mm }
.num { font-size: 11pt; letter-spacing: .08em; text-transform: uppercase; color: #666 }
h1 { font-size: 22pt; font-weight: 700; margin: 1mm 0 3mm; line-height: 1.1 }
p { font-size: 11.5pt; line-height: 1.3 }
.qr { width: 36mm; height: 36mm; display: block }
</style></head><body><div class="page">
<div class="key"></div>
<img class="art" src="../sheet-${s.n}.png" alt="">
${[[ART_X - 5, ART_Y - 0.1, 3.5, 0.2], [ART_X + ART_MM.w + 1.5, ART_Y - 0.1, 3.5, 0.2], [ART_X - 5, FOOT_Y - 0.1, 3.5, 0.2], [ART_X + ART_MM.w + 1.5, FOOT_Y - 0.1, 3.5, 0.2],
  [ART_X - 0.1, ART_Y - 5, 0.2, 3.5], [ART_X + ART_MM.w - 0.1, ART_Y - 5, 0.2, 3.5], [ART_X - 0.1, FOOT_Y + 1.5, 0.2, 3.5], [ART_X + ART_MM.w - 0.1, FOOT_Y + 1.5, 0.2, 3.5]]
  .map(([x, y, w, h]) => `<div class="crop" style="left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm"></div>`).join('')}
<div class="foot"><div class="txt"><div class="num">Sheet ${s.n} of ${SHEETS.length}</div><h1>${s.n} · ${s.title}</h1><p>Scan the QR code, then point your phone at this sheet</p></div>
<img class="qr" src="../qr-sheet.png" alt="QR code: ${QR_URL}"></div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const tmp = [];
try {
  const page = await browser.newPage();
  for (const s of SHEETS) {
    const f = path.join(printDir, `.tmp-sheet-${s.n}.html`);
    fs.writeFileSync(f, html(s)); tmp.push(f);
    await page.goto('file://' + f);
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    await page.pdf({ path: path.join(printDir, `sheet-${s.n}.pdf`), width: '210mm', height: '297mm', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    console.log(`sheet-${s.n}.pdf`);
  }
} finally {
  await browser.close();
  tmp.forEach((f) => fs.rmSync(f, { force: true }));
}
const all = await PDFDocument.create();
for (const s of SHEETS) {
  const src = await PDFDocument.load(fs.readFileSync(path.join(printDir, `sheet-${s.n}.pdf`)));
  (await all.copyPages(src, src.getPageIndices())).forEach((p) => all.addPage(p));
}
fs.writeFileSync(path.join(printDir, 'all-sheets.pdf'), await all.save());
console.log(`all-sheets.pdf (${all.getPageCount()} pages)`);
