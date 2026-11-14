// Compile markers/sheet-{1..4}.png -> markers/targets.mind with MindAR's browser compiler (headless Chrome).
// Prints feature counts and spatial spread per target; exits non-zero if a target looks feature-poor/clustered.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { ROOT, SHEETS } from './config.mjs';
import { startServer } from './static-server.mjs';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.COMPILE_PORT || 8142);
const MIN_FULLRES = 400;   // MindAR caps the detector near 500 points per scale; healthy art saturates it
const MIN_CELL_SHARE = 0.4; // each cell of a 4x5 grid must hold at least 40% of the average share

const server = await startServer(PORT, ROOT);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
let ok = true;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/tools/compile.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  const urls = SHEETS.map((s) => `/markers/sheet-${s.n}.png`);
  const t0 = Date.now();
  const { b64, stats } = await page.evaluate((u) => window.__compile(u), urls);
  fs.writeFileSync(path.join(ROOT, 'markers', 'targets.mind'), Buffer.from(b64, 'base64'));
  console.log(`compiled in ${((Date.now() - t0) / 1000).toFixed(0)} s -> markers/targets.mind (${(Buffer.from(b64, 'base64').length / 1e6).toFixed(2)} MB)`);
  const report = [];
  for (const s of stats) {
    const GX = 4, GY = 5, cells = new Array(GX * GY).fill(0);
    for (const p of s.pts) cells[Math.min(GY - 1, Math.floor(p.y / s.keyH * GY)) * GX + Math.min(GX - 1, Math.floor(p.x / s.keyW * GX))]++;
    const avg = s.pts.length / cells.length, min = Math.min(...cells);
    const poor = s.fullRes < MIN_FULLRES || min < avg * MIN_CELL_SHARE;
    if (poor) ok = false;
    console.log(`target ${s.target} (${SHEETS[s.target].id}): ${s.fullRes} full-res features, ${s.total} over ${s.keyframes} scales, grid min/avg ${min}/${avg.toFixed(0)}${poor ? '  <-- POOR/CLUSTERED' : ''}`);
    report.push({ target: s.target, id: SHEETS[s.target].id, fullResFeatures: s.fullRes, totalFeatures: s.total, scales: s.keyframes, gridMin: min, gridAvg: Math.round(avg), cells });
  }
  fs.writeFileSync(path.join(ROOT, 'markers', 'feature-report.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.close();
}
process.exit(ok ? 0 : 2);
