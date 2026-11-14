// Deterministic screenshots of viewer.html in headless Chrome.
//   node tools/shots.mjs [name-filter]      -> docs/shots/<name>.png
// Each shot: { name, scene, js } where js runs in the page with `d` = experience.debug, then time is stepped.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './static-server.mjs';
import { ROOT } from './config.mjs';

const OUT = join(ROOT, 'docs', 'shots');
mkdirSync(OUT, { recursive: true });
const filter = process.argv[2] || '';
const PORT = 8152;

export const SHOTS = [
  { name: 'before-3d', scene: 'before', js: `d.ui.setLabelsVisible(false)` },
  { name: 'before-3d-solid', scene: 'before', js: `d.ui.setLabelsVisible(false); d.setOrgans('solid')` },
  { name: 'before-3d-pins', scene: 'before', js: `` },
  { name: 'before-side', scene: 'before', js: `d.ui.setLabelsVisible(false); d.setView('side')` },
  { name: 'before-above', scene: 'before', js: `d.ui.setLabelsVisible(false); d.setView('above')` },
  { name: 'before-below', scene: 'before', js: `d.ui.setLabelsVisible(false); d.setView('below')` },
  { name: 'before-select', scene: 'before', js: `d.setView('below'); d.selectLabel('puborectalis')` },
  { name: 'before-cough', scene: 'before', js: `d.ui.setLabelsVisible(false); d.setView('side')`, after: `d.startCough()`, afterSteps: 4 },
  { name: 'before-cough-held', scene: 'before', js: `d.ui.setLabelsVisible(false); d.setView('side')`, after: `d.startCough()`, afterSteps: 11 },
  { name: 'preg-t0', scene: 'pregnancy', js: `` },
  { name: 'preg-t1', scene: 'pregnancy', js: `slide(1)` },
  { name: 'preg-t2', scene: 'pregnancy', js: `slide(2)` },
  { name: 'preg-t3', scene: 'pregnancy', js: `slide(3)` },
  { name: 'preg-t3-3d', scene: 'pregnancy', js: `slide(3); d.setView('3d')` },
  { name: 'preg-t3-3d-ghost', scene: 'pregnancy', js: `slide(3); d.setView('3d'); d.setOrgans('ghost')` },
  { name: 'preg-t3-leak', scene: 'pregnancy', js: `slide(3)`, after: `d.startCough()`, afterSteps: 10 },
  { name: 'birth-before', scene: 'birth', js: `` },
  { name: 'birth-crowning-below', scene: 'birth', js: `click('Crowning')` },
  { name: 'birth-crowning-side', scene: 'birth', js: `click('Crowning'); d.setView('side', true)` },
  { name: 'birth-after', scene: 'birth', js: `click('After birth')` },
  { name: 'birth-avulsion-below', scene: 'birth', js: `click('After birth'); d.T.avulsion = 1; d.setView('below', true)` },
  { name: 'birth-avulsion-3d', scene: 'birth', js: `click('After birth'); d.T.avulsion = 1; d.setView('3d', true); d.setOrgans('hide')` },
  { name: 'birth-avulsion-toggle', scene: 'birth', js: `click('After birth'); click('Muscle pulled off the bone (avulsion)'); d.setView('below', true); d.ui.toggleSheet(false)` },
  { name: 'train-expanded', scene: 'solutions', js: `d.ui.toggleSheet(false)` },
  { name: 'train-rest', scene: 'solutions', js: `` },
  { name: 'train-squeeze', scene: 'solutions', js: `d.T.contraction = 1` },
  { name: 'train-bearing-down', scene: 'solutions', js: `d.T.contraction = -1` },
  { name: 'train-squeeze-below', scene: 'solutions', js: `d.T.contraction = 1; d.setView('below')` },
  { name: 'train-rest-below', scene: 'solutions', js: `d.setView('below')` },
];

const server = await startServer(PORT, ROOT);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
page.on('pageerror', (e) => errors.push(String(e)));
let info = null;
for (const s of SHOTS) {
  if (filter && !s.name.includes(filter)) continue;
  await page.goto(`http://127.0.0.1:${PORT}/viewer.html?scene=${s.scene}${s.expanded ? '' : ''}`);
  await page.waitForFunction('window.__pf && window.__pf.exp', null, { timeout: 30000 });
  info = await page.evaluate(async ({ js, after, afterSteps }) => {
    const { exp, renderer, scene, camera, controls } = window.__pf;
    renderer.setAnimationLoop(null);
    const d = exp.debug;
    const step = (n, dt = 0.1) => { for (let i = 0; i < n; i++) exp.update(dt); };
    step(3);
    const click = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t).click();
    const slide = (v) => { const el = document.querySelector('input[type=range]'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    new Function('d', 'click', 'slide', js)(d, click, slide);
    step(70);
    if (after) { new Function('d', 'click', 'slide', after)(d, click, slide); step(afterSteps || 5, 0.1); }
    controls.update(); renderer.render(scene, camera);
    await new Promise((r) => requestAnimationFrame(() => r()));
    renderer.render(scene, camera);
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  }, s);
  await page.screenshot({ path: join(OUT, s.name + '.png') });
  console.log(s.name, JSON.stringify(info));
}
await browser.close(); server.close();
if (errors.length) { console.log('CONSOLE ERRORS:\n' + [...new Set(errors)].join('\n')); process.exitCode = 1; }
