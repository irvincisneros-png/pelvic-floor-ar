// Deterministic marker art: seeded generative line-work -> SVG -> PNG (sharp).
// Output: markers/src/sheet-N.svg and markers/sheet-N.png (1440 x 1840, 180:230).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, ART_PX, SHEETS } from './config.mjs';

const W = ART_PX.w, H = ART_PX.h;

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return f;
}

function makeNoise(seed) {
  const r = rng(seed);
  const N = 256, g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const sm = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const at = (a, b) => g[((b & 255) * N) + (a & 255)];
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y) => (v(x, y) * 0.6 + v(x * 2.1 + 17, y * 2.1 + 5) * 0.3 + v(x * 4.3 + 3, y * 4.3 + 9) * 0.1);
}

const f1 = (n) => n.toFixed(1);

// Smooth closed blob through noisy radii (Catmull-Rom -> cubic Bezier)
function blobPath(cx, cy, rx, ry, rot, wob, r, n = 11) {
  const pts = [];
  const phase = r() * 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wob * (Math.sin(a * 2 + phase) * 0.5 + Math.sin(a * 3 + phase * 1.7) * 0.35 + (r() - 0.5) * 0.7);
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return closedSpline(pts);
}
function closedSpline(pts) {
  const n = pts.length;
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d + 'Z';
}

// ---- per-sheet recipes ----
const RECIPES = [
  { // 1 teal / cyan: whorl + fine flow lines
    seed: 1101, bg: '#06222b',
    pal: ['#12a5a8', '#7fe3d6', '#e9fbf4', '#0b5f73', '#f2c14e', '#1b3f4d'],
    dark: '#041a21', light: '#effcf6', flowFreq: 0.0042, flowTurn: 5.2, flowN: 520, bigBlobs: 9, cells: 60, hero: 'whorl',
  },
  { // 2 magenta / rose: cells + branching
    seed: 2202, bg: '#2a0a22',
    pal: ['#d6336c', '#ff8fb1', '#fff0f4', '#7b1f55', '#ffc857', '#4a1442'],
    dark: '#1f0719', light: '#fff2f6', flowFreq: 0.0058, flowTurn: 3.6, flowN: 380, bigBlobs: 7, cells: 120, hero: 'branch',
  },
  { // 3 amber / orange: topographic contours
    seed: 3303, bg: '#2b1604',
    pal: ['#f08a1c', '#ffc46b', '#fff4dc', '#9a4a0b', '#3fb7a0', '#5a2d07'],
    dark: '#1e0f02', light: '#fff6e2', flowFreq: 0.0034, flowTurn: 6.5, flowN: 460, bigBlobs: 10, cells: 70, hero: 'topo',
  },
  { // 4 green / violet: fibre bundles
    seed: 4404, bg: '#0f1d12',
    pal: ['#58c26a', '#b6f0a0', '#f1ffe6', '#2c7a3e', '#9d6bff', '#18321e'],
    dark: '#0a140c', light: '#f2ffe8', flowFreq: 0.0050, flowTurn: 4.4, flowN: 560, bigBlobs: 8, cells: 90, hero: 'fibre',
  },
];

function build(rc) {
  const r = rng(rc.seed);
  const noise = makeNoise(rc.seed + 7);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const out = [];
  const add = (s) => out.push(s);

  add(`<rect width="${W}" height="${H}" fill="${rc.bg}"/>`);

  // Layer 0: dense fine hatch field so no area is flat
  {
    const a = r() * Math.PI;
    let lines = '';
    for (let i = -H; i < W + H; i += 14 + Math.floor(r() * 10)) {
      lines += `M${i} 0L${f1(i + Math.sin(a) * H)} ${H}`;
    }
    add(`<path d="${lines}" stroke="${rc.pal[3]}" stroke-width="2" opacity="0.5" fill="none"/>`);
  }

  // Layer 1: big nested "cell/contour" blobs (large scale)
  for (let i = 0; i < rc.bigBlobs; i++) {
    const cx = r() * W, cy = r() * H;
    const base = 160 + r() * 330;
    const ry = base * (0.6 + r() * 0.7), rot = r() * Math.PI;
    const wob = 0.18 + r() * 0.22;
    const fill = pick(rc.pal);
    const rings = 5 + Math.floor(r() * 5);
    const seedState = Math.floor(r() * 1e9);
    for (let k = 0; k < rings; k++) {
      const t = 1 - k / rings;
      const rr = rng(seedState); // same shape each ring => concentric
      const col = k % 2 === 0 ? fill : (k % 4 === 1 ? rc.dark : rc.light);
      add(`<path d="${blobPath(cx, cy, base * t, ry * t, rot, wob, rr)}" fill="${col}" fill-opacity="${k === 0 ? 0.9 : 0.85}" stroke="${k % 2 ? rc.light : rc.dark}" stroke-width="${3 + r() * 5}"/>`);
    }
  }

  // Layer 2: flow-field streamlines
  {
    let paths = {};
    for (let i = 0; i < rc.flowN; i++) {
      let x = r() * W, y = r() * H;
      const col = pick(rc.pal);
      const sw = (1.3 + Math.pow(r(), 2) * 6).toFixed(1);
      const steps = 30 + Math.floor(r() * 110);
      let d = `M${f1(x)} ${f1(y)}`;
      for (let s = 0; s < steps; s++) {
        const a = noise(x * rc.flowFreq, y * rc.flowFreq) * Math.PI * rc.flowTurn;
        x += Math.cos(a) * 5; y += Math.sin(a) * 5;
        d += `L${f1(x)} ${f1(y)}`;
      }
      const key = `${col}|${sw}`;
      (paths[key] ||= []).push(d);
    }
    for (const [key, ds] of Object.entries(paths)) {
      const [col, sw] = key.split('|');
      add(`<path d="${ds.join('')}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>`);
    }
  }

  // Layer 3: medium cells with nuclei, scattered unevenly (clustered by noise)
  for (let i = 0; i < rc.cells; i++) {
    let x, y, tries = 0;
    do { x = r() * W; y = r() * H; tries++; } while (noise(x * 0.0025 + 3, y * 0.0025) < 0.42 && tries < 12);
    const rad = 22 + Math.pow(r(), 1.6) * 110;
    const ry = rad * (0.65 + r() * 0.6), rot = r() * Math.PI;
    const seedState = Math.floor(r() * 1e9);
    add(`<path d="${blobPath(x, y, rad, ry, rot, 0.15, rng(seedState), 9)}" fill="${pick(rc.pal)}" stroke="${rc.dark}" stroke-width="${3 + r() * 4}"/>`);
    add(`<path d="${blobPath(x + rad * 0.12, y, rad * 0.58, ry * 0.58, rot, 0.2, rng(seedState + 1), 9)}" fill="${r() < 0.5 ? rc.light : rc.dark}" stroke="${rc.light}" stroke-width="2.5"/>`);
    if (r() < 0.6) add(`<circle cx="${f1(x + rad * 0.15)}" cy="${f1(y - ry * 0.05)}" r="${f1(rad * 0.16)}" fill="${pick(rc.pal)}" stroke="${rc.dark}" stroke-width="2"/>`);
  }

  // Layer 4: hero asymmetric motif
  HERO[rc.hero](rc, r, noise, add, pick);

  // Layer 5: specks and edge detail (detail right to the borders)
  {
    let dots = '';
    for (let i = 0; i < 260; i++) {
      const rad = 3 + r() * 11;
      dots += `<circle cx="${f1(r() * W)}" cy="${f1(r() * H)}" r="${f1(rad)}" fill="${r() < 0.5 ? rc.light : pick(rc.pal)}" stroke="${rc.dark}" stroke-width="1.8"/>`;
    }
    add(dots);
    // clipped edge blobs hugging each border
    for (let i = 0; i < 26; i++) {
      const side = i % 4;
      const t = r();
      const x = side === 0 ? t * W : side === 1 ? W : side === 2 ? t * W : 0;
      const y = side === 0 ? 0 : side === 1 ? t * H : side === 2 ? H : t * H;
      const rad = 30 + r() * 70;
      add(`<path d="${blobPath(x, y, rad, rad * (0.6 + r() * 0.5), r() * 3, 0.2, r, 9)}" fill="${pick(rc.pal)}" stroke="${rc.light}" stroke-width="${3 + r() * 3}"/>`);
      add(`<path d="${blobPath(x, y, rad * 0.5, rad * 0.4, r() * 3, 0.2, r, 8)}" fill="${rc.dark}" stroke="${rc.light}" stroke-width="2"/>`);
    }
    // high-contrast frame ticks irregular around the border
    let tick = '';
    for (let x = 0; x < W; x += 22 + r() * 30) { const l = 8 + r() * 26; tick += `M${f1(x)} 0v${f1(l)}M${f1(x + 9)} ${H}v${-f1(l)}`; }
    for (let y = 0; y < H; y += 22 + r() * 30) { const l = 8 + r() * 26; tick += `M0 ${f1(y)}h${f1(l)}M${W} ${f1(y + 9)}h${-f1(l)}`; }
    add(`<path d="${tick}" stroke="${rc.light}" stroke-width="4" fill="none"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><clipPath id="c"><rect width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#c)">${out.join('\n')}</g></svg>`;
}

const HERO = {
  whorl(rc, r, noise, add) { // off-centre log spiral, thick, with satellite rings
    const cx = W * 0.32, cy = H * 0.34;
    for (let arm = 0; arm < 3; arm++) {
      const off = arm * (Math.PI * 2 / 3);
      let prev = null;
      for (let t = 0; t < 7.2 * Math.PI; t += 0.07) {
        const rad = 14 * Math.exp(0.17 * t / 1.0) * (1 + 0.06 * Math.sin(t * 3));
        const a = t + off;
        const p = [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.9];
        if (prev) {
          const w = 4 + rad * 0.045;
          add(`<line x1="${f1(prev[0])}" y1="${f1(prev[1])}" x2="${f1(p[0])}" y2="${f1(p[1])}" stroke="${arm === 1 ? rc.pal[0] : rc.light}" stroke-width="${f1(w + 5)}" stroke-linecap="round" opacity="0.98"/>`);
          add(`<line x1="${f1(prev[0])}" y1="${f1(prev[1])}" x2="${f1(p[0])}" y2="${f1(p[1])}" stroke="${arm === 1 ? rc.light : rc.dark}" stroke-width="${f1(w * 0.45)}" stroke-linecap="round"/>`);
        }
        prev = p;
      }
    }
    add(`<circle cx="${cx}" cy="${cy}" r="30" fill="${rc.pal[4]}" stroke="${rc.dark}" stroke-width="6"/>`);
  },
  branch(rc, r, noise, add, pick) { // branching tree from bottom right
    const grow = (x, y, ang, len, w, depth) => {
      if (depth > 7 || len < 18) {
        add(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(10 + r() * 14)}" fill="${pick(rc.pal)}" stroke="${rc.dark}" stroke-width="3"/>`);
        return;
      }
      const bend = (r() - 0.5) * 0.5;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      const mx = (x + x2) / 2 + Math.cos(ang + 1.57) * len * bend, my = (y + y2) / 2 + Math.sin(ang + 1.57) * len * bend;
      add(`<path d="M${f1(x)} ${f1(y)}Q${f1(mx)} ${f1(my)} ${f1(x2)} ${f1(y2)}" fill="none" stroke="${rc.dark}" stroke-width="${f1(w + 8)}" stroke-linecap="round"/>`);
      add(`<path d="M${f1(x)} ${f1(y)}Q${f1(mx)} ${f1(my)} ${f1(x2)} ${f1(y2)}" fill="none" stroke="${depth % 2 ? rc.light : rc.pal[1]}" stroke-width="${f1(w)}" stroke-linecap="round"/>`);
      const n = depth < 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        grow(x2, y2, ang + (i - (n - 1) / 2) * (0.7 + r() * 0.5) + (r() - 0.5) * 0.3, len * (0.68 + r() * 0.14), w * 0.7, depth + 1);
      }
    };
    grow(W * 0.9, H * 1.02, -2.2, 330, 34, 0);
    grow(W * 0.04, H * 0.2, 0.4, 210, 20, 2);
  },
  topo(rc, r, noise, add) { // nested noisy contour set, centred low-right
    const cx = W * 0.64, cy = H * 0.64;
    const rings = 15;
    for (let k = rings; k >= 1; k--) {
      const t = k / rings;
      const rad = 60 + t * 700;
      const pts = [];
      const n = 40;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const nz = noise(Math.cos(a) * 1.3 + 5 + t * 0.6, Math.sin(a) * 1.3 + 5 + t * 0.6);
        const rr = rad * (0.62 + nz * 0.8) * (1 + 0.22 * Math.cos(a - 0.8));
        pts.push([cx + Math.cos(a) * rr * 1.1, cy + Math.sin(a) * rr * 0.9]);
      }
      add(`<path d="${closedSpline(pts)}" fill="${k % 3 === 0 ? rc.pal[0] : k % 3 === 1 ? rc.dark : rc.pal[1]}" fill-opacity="0.78" stroke="${k % 2 ? rc.light : rc.dark}" stroke-width="${k % 5 === 0 ? 14 : 6}"/>`);
    }
    add(`<circle cx="${cx}" cy="${cy}" r="26" fill="${rc.pal[4]}" stroke="${rc.dark}" stroke-width="6"/>`);
  },
  fibre(rc, r, noise, add, pick) { // sweeping bundle of curved strands + knot
    const strands = 110;
    for (let i = 0; i < strands; i++) {
      const u = i / strands;
      const sx = -100, sy = H * (0.9 - 0.15 * u) + (r() - 0.5) * 60;
      const ex = W + 100, ey = H * (0.12 + 0.3 * u) + (r() - 0.5) * 60;
      const c1x = W * 0.35, c1y = H * (0.95 - 0.5 * u) + (r() - 0.5) * 90;
      const c2x = W * 0.62, c2y = H * (0.1 + 0.5 * u) + (r() - 0.5) * 90;
      const w = 4 + r() * 10;
      const col = i % 7 === 0 ? rc.pal[4] : i % 3 === 0 ? rc.light : pick(rc.pal.slice(0, 3));
      add(`<path d="M${sx} ${f1(sy)}C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${ex} ${f1(ey)}" fill="none" stroke="${rc.dark}" stroke-width="${f1(w + 4)}" stroke-linecap="round"/>`);
      add(`<path d="M${sx} ${f1(sy)}C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${ex} ${f1(ey)}" fill="none" stroke="${col}" stroke-width="${f1(w)}" stroke-linecap="round"/>`);
    }
    // asymmetric knot
    const kx = W * 0.3, ky = H * 0.27;
    for (let k = 0; k < 6; k++) {
      add(`<path d="${blobPath(kx, ky, 190 - k * 28, 120 - k * 18, 0.5, 0.25, rng(99), 10)}" fill="${k % 2 ? rc.pal[4] : rc.dark}" fill-opacity="0.9" stroke="${k % 2 ? rc.dark : rc.light}" stroke-width="7"/>`);
    }
  },
};

const outDir = path.join(ROOT, 'markers');
fs.mkdirSync(path.join(outDir, 'src'), { recursive: true });
for (let i = 0; i < RECIPES.length; i++) {
  const svg = build(RECIPES[i]);
  const n = SHEETS[i].n;
  fs.writeFileSync(path.join(outDir, 'src', `sheet-${n}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 72 }).resize(W, H).flatten({ background: RECIPES[i].bg }).png({ compressionLevel: 9 }).toFile(path.join(outDir, `sheet-${n}.png`));
  console.log(`sheet-${n}.png  ${W}x${H}  svg ${(svg.length / 1e6).toFixed(2)} MB`);
}
