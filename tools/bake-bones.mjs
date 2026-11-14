// Bakes the bony pelvis from a hand-authored signed distance field into a compact binary mesh.
//   node tools/bake-bones.mjs            -> src/anatomy/bones.bin
// Units: centimetres, anatomical axes (x right, y up, z anterior). Female proportions: wide inlet,
// wide subpubic arch, flared iliac wings. The midsagittal cut face (x = 0) is baked too.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'anatomy');

// ---------------------------------------------------------------- helpers
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
function capsule(x, y, z, a, b, ra, rb) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const px = x - a[0], py = y - a[1], pz = z - a[2];
  const h = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz), 0, 1);
  return Math.hypot(px - bx * h, py - by * h, pz - bz * h) - mix(ra, rb, h);
}
function ellipsoid(x, y, z, c, r) {
  const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
  const k0 = Math.hypot(px, py, pz), k1 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(r[0], r[1], r[2]);
}
// value noise for subtle surface irregularity
function hash3(i, j, k) { let n = (i * 374761393 + j * 668265263 + k * 2147483647) | 0; n = (n ^ (n >> 13)) * 1274126177 | 0; return ((n ^ (n >> 16)) >>> 0) / 4294967295; }
function noise3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  let fx = x - i, fy = y - j, fz = z - k; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(i, j, k), hash3(i + 1, j, k), fx), L(hash3(i, j + 1, k), hash3(i + 1, j + 1, k), fx), fy),
    L(L(hash3(i, j, k + 1), hash3(i + 1, j, k + 1), fx), L(hash3(i, j + 1, k + 1), hash3(i + 1, j + 1, k + 1), fx), fy), fz);
}
// Catmull-Rom through points (uniform), t in [0,1]
function crPoint(P, t) {
  const n = P.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(Math.floor(x), n - 1), f = x - i;
  const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(i + 2, n)];
  return p1.map((_, d) => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * f + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * f * f + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * f * f * f));
}

// ---------------------------------------------------------------- iliac wing (blade) as a thick curved patch
const CREST = [[11.4, 8.0, 7.2], [13.5, 10.4, 4.6], [14.5, 12.0, 1.2], [13.7, 12.7, -2.6], [11.4, 12.2, -6.0], [8.3, 10.8, -8.7], [5.7, 8.7, -9.9]];
const LOWER = [[10.2, 5.2, 5.2], [9.3, 4.1, 2.4], [8.3, 3.3, -0.4], [7.2, 2.6, -2.6], [6.7, 2.5, -4.5], [6.1, 4.3, -7.1], [5.4, 6.5, -9.1]];
const WING = [];
{
  const NS = 72, NT = 44;
  for (let i = 0; i <= NS; i++) for (let j = 0; j <= NT; j++) {
    const s = i / NS, t = j / NT;
    const a = crPoint(LOWER, s), b = crPoint(CREST, s);
    // fossa: concave on the inner face, so the blade bows outward (lateral) between lower edge and crest
    const bow = 1.25 * Math.sin(Math.PI * t) * Math.pow(Math.sin(Math.PI * clamp(s * 1.08, 0, 1)), 0.7);
    // crest rolls slightly outward (iliac tubercle) and the ASIS hooks forward
    const lip = 0.45 * sstep(0.82, 1, t);
    const p = [mix(a[0], b[0], t) + bow * 0.92 + lip * 0.8, mix(a[1], b[1], t) - bow * 0.25 + lip * 0.1, mix(a[2], b[2], t) + bow * 0.12 * (0.5 - s)];
    const post = sstep(0.62, 1, s);                       // thick posterior part (iliac tuberosity, auricular area)
    let r = 0.3 + 0.55 * Math.pow(1 - t, 3) + 0.3 * sstep(0.8, 1, t) + post * (0.75 - 0.35 * t);
    r += 0.18 * sstep(0.12, 0, s);                        // ASIS / AIIS thickening
    r *= 1 + 0.12 * (noise3(p[0] * 0.6, p[1] * 0.6, p[2] * 0.6) - 0.5);
    WING.push(p[0], p[1], p[2], r);
  }
}
const WB = { lo: [3.5, 1.0, -11.5], hi: [16.5, 14.5, 9.0] };
function wingSDF(x, y, z) {
  const m = 1.6;
  const ox = Math.max(WB.lo[0] - x, 0, x - WB.hi[0]), oy = Math.max(WB.lo[1] - y, 0, y - WB.hi[1]), oz = Math.max(WB.lo[2] - z, 0, z - WB.hi[2]);
  const out = Math.hypot(ox, oy, oz);
  if (out > m) return out;                                // far from the blade: a safe lower bound is enough
  let best = 1e9;
  for (let k = 0; k < WING.length; k += 4) {
    const dx = x - WING[k], dy = y - WING[k + 1], dz = z - WING[k + 2];
    const d2 = dx * dx + dy * dy + dz * dz, rr = best + WING[k + 3];
    if (rr > 0 && d2 < rr * rr) best = Math.sqrt(d2) - WING[k + 3];
  }
  return best;
}

// ---------------------------------------------------------------- hip bone (x >= 0 side; mirrored through |x|)
function hipSDF(x, y, z) {
  let d = ellipsoid(x, y, z, [1.3, 0.55, 6.05], [1.5, 2.05, 1.0]);                                   // pubic body (meets its twin at the symphysis)
  d = smin(d, capsule(x, y, z, [1.9, 1.6, 5.95], [6.9, 2.5, 2.3], 0.78, 1.15), 0.7);                 // superior pubic ramus
  d = smin(d, capsule(x, y, z, [2.9, 2.4, 5.7], [3.0, 2.5, 5.6], 0.5, 0.5), 0.6);                    // pubic tubercle
  d = smin(d, capsule(x, y, z, [1.7, -1.0, 5.75], [4.7, -4.3, 1.9], 0.62, 0.72), 0.6);               // inferior pubic ramus (wide arch)
  d = smin(d, capsule(x, y, z, [4.7, -4.3, 1.9], [6.0, -5.3, -0.9], 0.72, 1.2), 0.6);                // ischial ramus
  d = smin(d, ellipsoid(x, y, z, [6.4, -5.2, -1.9], [1.35, 1.75, 2.15]), 0.8);                       // ischial tuberosity
  d = smin(d, capsule(x, y, z, [6.6, -4.2, -2.0], [7.7, -0.4, -1.0], 1.35, 1.7), 0.8);               // body of ischium
  let acet = ellipsoid(x, y, z, [8.75, 0.6, 0.4], [2.65, 3.0, 3.0]);                                 // acetabular mass
  acet = smax(acet, -(Math.hypot(x - 11.1, y - 0.35, z - 0.7) - 2.5), 0.35);                         // socket, opens laterally
  acet = smax(acet, -capsule(x, y, z, [10.2, -1.9, 1.3], [11.6, -3.4, 1.9], 0.8, 0.9), 0.3);         // acetabular notch
  d = smin(d, acet, 0.8);
  d = smin(d, capsule(x, y, z, [8.4, 2.2, -0.2], [8.9, 4.4, -1.1], 2.15, 1.55), 1.0);                // body of ilium
  d = smin(d, capsule(x, y, z, [6.9, -0.9, -2.5], [5.35, 0.1, -3.95], 0.8, 0.2), 0.5);               // ischial spine
  d = smin(d, capsule(x, y, z, [10.2, 5.2, 5.2], [10.5, 4.6, 5.6], 0.7, 0.55), 0.6);                 // AIIS
  d = smin(d, wingSDF(x, y, z), 0.9);                                                                // iliac blade + crest
  return d;
}

// ---------------------------------------------------------------- sacrum + coccyx
const SAC = [[9.6, -6.1], [7.3, -8.5], [4.7, -9.6], [2.3, -9.35], [0.7, -8.5]];                      // (y, z) centre line, base -> apex
const SAC_S = [];
for (let i = 0; i <= 80; i++) { const t = i / 80; const p = crPoint(SAC, t), q = crPoint(SAC, Math.min(1, t + 0.01)), q0 = crPoint(SAC, Math.max(0, t - 0.01));
  let ty = q[0] - q0[0], tz = q[1] - q0[1]; const l = Math.hypot(ty, tz); ty /= l; tz /= l;
  SAC_S.push({ t, y: p[0], z: p[1], ty, tz, ny: -tz, nz: ty }); }                                    // n = tangent rotated: points to the pelvic (front) side
if (SAC_S[40].nz < 0) for (const s of SAC_S) { s.ny = -s.ny; s.nz = -s.nz; }
const arrI = (a, t) => { const x = clamp(t, 0, 1) * (a.length - 1), i = Math.min(Math.floor(x), a.length - 2); return mix(a[i], a[i + 1], sstep(0, 1, x - i)); };
const SAC_H = [1.9, 1.55, 1.2, 0.95, 0.7], SAC_W = [5.7, 5.1, 3.7, 2.4, 1.35];
function sacrumSDF(x, y, z) {
  let bi = 0, bd = 1e9;
  for (let i = 0; i < SAC_S.length; i++) { const s = SAC_S[i]; const d = (y - s.y) * (y - s.y) + (z - s.z) * (z - s.z); if (d < bd) { bd = d; bi = i; } }
  const s = SAC_S[bi], t = s.t;
  const a = (y - s.y) * s.ny + (z - s.z) * s.nz, along = (y - s.y) * s.ty + (z - s.z) * s.tz;
  const Hh = arrI(SAC_H, t), W = arrI(SAC_W, t);
  // front (pelvic) surface is gently concave side to side; back surface carries the crests
  const af = a + 0.28 * Hh * (1 - Math.pow(Math.min(1, Math.abs(x) / W), 2)) * (a > 0 ? 1 : 0);
  const e = 2.6;
  const f = Math.pow(Math.pow(Math.abs(af) / Hh, e) + Math.pow(Math.abs(x) / W, e), 1 / e);
  let d = (f - 1) * Math.min(Hh, W) * 0.85;
  if (bi === 0 && along < 0) d = smax(d, -along - 0.0, 0.5);                                         // flat S1 end plate
  if (bi === SAC_S.length - 1 && along > 0) d = Math.hypot(Math.max(d, 0), along) + Math.min(d, 0);
  // alae: wings of the sacrum sweep back and out to the sacroiliac joint
  d = smin(d, ellipsoid(Math.abs(x), y, z, [4.3, 8.2, -7.9], [2.3, 2.0, 1.6]), 0.9);
  // sacral foramina (4 pairs, front and back) and transverse ridges between fused vertebrae
  const FT = [0.2, 0.4, 0.58, 0.75];
  for (const ft of FT) {
    const q = SAC_S[Math.round(ft * 80)], w = arrI(SAC_W, ft), hh = arrI(SAC_H, ft), fx = 0.42 * w + 0.35;
    const cyF = q.y + q.ny * hh * 0.8, czF = q.z + q.nz * hh * 0.8, cyB = q.y - q.ny * hh * 0.9, czB = q.z - q.nz * hh * 0.9;
    d = smax(d, -(Math.hypot(Math.abs(x) - fx, y - cyF, z - czF) - 0.5), 0.3);
    d = smax(d, -(Math.hypot(Math.abs(x) - fx * 0.9, y - cyB, z - czB) - 0.38), 0.25);
    d -= 0.07 * Math.exp(-Math.pow((t - (ft - 0.1)) / 0.03, 2)) * (a > 0 ? 1 : 0);                   // transverse ridge
  }
  // median sacral crest (spinous tubercles) on the back
  for (const ct of [0.12, 0.3, 0.48, 0.64]) { const q = SAC_S[Math.round(ct * 80)], hh = arrI(SAC_H, ct);
    d = smin(d, ellipsoid(x, y, z, [0, q.y - q.ny * (hh + 0.25), q.z - q.nz * (hh + 0.25)], [0.45, 0.75, 0.6]), 0.5); }
  return d;
}
const COC = [[0.25, -8.15, 1.2, 0.62, 0.5], [-0.55, -7.4, 0.95, 0.52, 0.42], [-1.1, -6.55, 0.7, 0.46, 0.36], [-1.42, -5.75, 0.48, 0.4, 0.3]];   // y, z, rx, r along, r thick
function coccyxSDF(x, y, z) {
  let d = 1e9;
  for (let i = 0; i < COC.length; i++) {
    const c = COC[i], n = COC[Math.min(i + 1, COC.length - 1)], p = COC[Math.max(i - 1, 0)];
    let ty = n[0] - p[0], tz = n[1] - p[1]; const l = Math.hypot(ty, tz); ty /= l; tz /= l;
    const al = (y - c[0]) * ty + (z - c[1]) * tz, ac = -(y - c[0]) * tz + (z - c[1]) * ty;
    const k0 = Math.hypot(x / c[2], al / c[3], ac / c[4]), k1 = Math.hypot(x / (c[2] * c[2]), al / (c[3] * c[3]), ac / (c[4] * c[4]));
    d = smin(d, k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -c[4], 0.22);
  }
  return d;
}

export function sdf(x, y, z) {
  const ax = Math.abs(x);
  let d = hipSDF(ax, y, z);
  const sc = smin(sacrumSDF(x, y, z), coccyxSDF(x, y, z), 0.3);
  d = Math.min(d, sc);                                           // hard union: the sacroiliac joint line stays visible
  // faint cortical irregularity
  d += 0.035 * (noise3(x * 1.1 + 7, y * 1.1, z * 1.1) - 0.5) + 0.02 * (noise3(x * 3.1, y * 3.1 + 3, z * 3.1) - 0.5);
  return d;
}


// ---------------------------------------------------------------- fetus (smooth curled form, no features)
// Local frame: origin = centre of the head, +y towards the rump, +z = ventral (the side the limbs fold onto).
export function fetusSDF(x, y, z) {
  const ax = Math.abs(x);
  let d = ellipsoid(x, y, z, [0, 0, 0.3], [4.45, 4.9, 5.2]);                                   // head
  d = smin(d, capsule(x, y, z, [0, 4.2, -0.6], [0, 6.0, -1.2], 2.9, 3.6), 1.6);                // neck into shoulders
  d = smin(d, capsule(ax, y, z, [1.2, 7.0, -1.6], [1.0, 13.6, -1.2], 3.9, 4.3), 1.8);          // curved back and trunk
  d = smin(d, ellipsoid(x, y, z, [0, 15.2, 0.2], [4.6, 3.6, 4.2]), 1.6);                       // rump
  d = smin(d, capsule(ax, y, z, [2.6, 14.6, 1.6], [2.9, 9.4, 5.2], 2.3, 1.9), 1.3);            // thighs folded up
  d = smin(d, capsule(ax, y, z, [2.9, 9.4, 5.2], [1.6, 13.4, 6.0], 1.7, 1.3), 1.0);            // shins crossing back
  d = smin(d, ellipsoid(ax, y, z, [1.3, 14.3, 6.2], [0.9, 1.2, 1.0]), 0.9);                    // feet tucked in
  d = smin(d, capsule(ax, y, z, [4.1, 6.6, 0.4], [3.9, 9.6, 3.6], 1.5, 1.3), 1.1);             // upper arms
  d = smin(d, capsule(ax, y, z, [3.9, 9.6, 3.6], [1.6, 5.4, 5.0], 1.25, 1.05), 0.9);           // forearms, hands near the chin
  return d;
}

// ---------------------------------------------------------------- meshing (surface nets + simplify)
async function meshSDF(sdfFn, LO, HI, H, targetTris) {
  const N = [0, 1, 2].map((a) => Math.ceil((HI[a] - LO[a]) / H) + 1);
  const F = new Float32Array(N[0] * N[1] * N[2]);
  const gi = (i, j, k) => i + N[0] * (j + N[1] * k);
  const t0 = Date.now();
  for (let k = 0; k < N[2]; k++) for (let j = 0; j < N[1]; j++) for (let i = 0; i < N[0]; i++) F[gi(i, j, k)] = sdfFn(LO[0] + i * H, LO[1] + j * H, LO[2] + k * H);
  console.log('grid', N.join('x'), 'sampled in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  const cx = N[0] - 1, cy = N[1] - 1, cz = N[2] - 1;
  const cell = new Int32Array(cx * cy * cz).fill(-1);
  const ci = (i, j, k) => i + cx * (j + cy * k);
  const P = [], I = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { v[c] = F[gi(i + C[c][0], j + C[c][1], k + C[c][2])]; if (v[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    cell[ci(i, j, k)] = P.length / 3;
    P.push(LO[0] + (i + sx / n) * H, LO[1] + (j + sy / n) * H, LO[2] + (k + sz / n) * H);
  }
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I.push(a, c, b, a, d, c); else I.push(a, b, c, a, c, d); };
  for (let k = 1; k < cz; k++) for (let j = 1; j < cy; j++) for (let i = 1; i < cx; i++) {
    const f0 = F[gi(i, j, k)] < 0;
    if (f0 !== (F[gi(i + 1, j, k)] < 0)) quad(cell[ci(i, j - 1, k - 1)], cell[ci(i, j, k - 1)], cell[ci(i, j, k)], cell[ci(i, j - 1, k)], !f0);
    if (f0 !== (F[gi(i, j + 1, k)] < 0)) quad(cell[ci(i - 1, j, k - 1)], cell[ci(i - 1, j, k)], cell[ci(i, j, k)], cell[ci(i, j, k - 1)], !f0);
    if (f0 !== (F[gi(i, j, k + 1)] < 0)) quad(cell[ci(i - 1, j - 1, k)], cell[ci(i, j - 1, k)], cell[ci(i, j, k)], cell[ci(i - 1, j, k)], !f0);
  }
  let pos = new Float32Array(P), idx = new Uint32Array(I);
  const grad = (x, y, z, e = 0.06) => {
    const gx = sdfFn(x + e, y, z) - sdfFn(x - e, y, z), gy = sdfFn(x, y + e, z) - sdfFn(x, y - e, z), gz = sdfFn(x, y, z + e) - sdfFn(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1; return [gx / l, gy / l, gz / l];
  };
  let agree = 0, tot = 0;                                       // make triangles face outward (along the gradient)
  for (let t = 0; t < idx.length; t += 3 * 97) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const g = grad(pos[a], pos[a + 1], pos[a + 2]);
    if ((uy * vz - uz * vy) * g[0] + (uz * vx - ux * vz) * g[1] + (ux * vy - uy * vx) * g[2] > 0) agree++; tot++;
  }
  if (agree < tot / 2) for (let t = 0; t < idx.length; t += 3) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
  await MeshoptSimplifier.ready;
  const [ni, err] = MeshoptSimplifier.simplify(idx, pos, 3, targetTris * 3, 0.004);
  console.log('raw', idx.length / 3, 'tris -> simplified', ni.length / 3, 'error', err.toFixed(5));
  const remap = new Int32Array(pos.length / 3).fill(-1); const np = []; const out = new Uint32Array(ni.length);
  for (let t = 0; t < ni.length; t++) { const o = ni[t]; if (remap[o] < 0) { remap[o] = np.length / 3; np.push(pos[o * 3], pos[o * 3 + 1], pos[o * 3 + 2]); } out[t] = remap[o]; }
  pos = new Float32Array(np); idx = out;
  const nV = pos.length / 3;
  if (nV > 65535) throw new Error('too many vertices for 16-bit indices: ' + nV);
  const nor = new Int8Array(nV * 3);
  for (let i = 0; i < nV; i++) { const g = grad(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); nor[i * 3] = Math.round(g[0] * 127); nor[i * 3 + 1] = Math.round(g[1] * 127); nor[i * 3 + 2] = Math.round(g[2] * 127); }
  return { pos, idx, nor };
}

// ---------------------------------------------------------------- midsagittal cut face of the bones (x = 0)
function boneCap() {
  const cap = { pos: [], col: [], idx: [] };
  const h = 0.11, y0 = -3, y1 = 11.2, z0 = -11.6, z1 = 7.6;
  const ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1;
  const f2 = (y, z) => sdf(0, y, z);
  const val = new Float32Array(ny * nz), id = new Int32Array(ny * nz).fill(-1);
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) val[j + ny * k] = f2(y0 + j * h, z0 + k * h);
  const vert = (j, k) => {
    const q = j + ny * k; if (id[q] >= 0) return id[q];
    let y = y0 + j * h, z = z0 + k * h, d = val[q];
    for (let it = 0; it < 3 && d > 0; it++) {                    // pull outside corners back onto the outline
      const e = 0.03, gy = (f2(y + e, z) - f2(y - e, z)) / (2 * e), gz = (f2(y, z + e) - f2(y, z - e)) / (2 * e), g2 = gy * gy + gz * gz || 1;
      y -= d * gy / g2; z -= d * gz / g2; d = f2(y, z);
    }
    const depth = Math.max(0, -d), pubic = z > 2;
    const cortex = 1 - sstep(0.12, 0.3, depth);
    // spongy bone: mottled trabecular fill, darker fusion lines between sacral segments, dense cortical rim
    const tr = noise3(y * 5.5, z * 5.5, 1.3) * 0.6 + noise3(y * 12, z * 12, 4.1) * 0.4;
    let fill = pubic ? [0.8, 0.86, 0.9] : [0.93 - 0.2 * tr, 0.84 - 0.2 * tr, 0.68 - 0.2 * tr];
    if (!pubic) { let bi = 0, bd = 1e9; for (let i = 0; i < SAC_S.length; i++) { const s = SAC_S[i], dd = (y - s.y) ** 2 + (z - s.z) ** 2; if (dd < bd) { bd = dd; bi = i; } }
      const tt = SAC_S[bi].t; let line = 0; for (const lt of [0.2, 0.4, 0.58, 0.75]) line = Math.max(line, Math.exp(-(((tt - lt) / 0.012) ** 2)));
      if (y > 0.4) fill = fill.map((c) => c * (1 - 0.3 * line)); }
    const edge = pubic ? [0.56, 0.62, 0.68] : [0.6, 0.48, 0.32];
    id[q] = cap.pos.length / 3; cap.pos.push(0, y, z);
    cap.col.push(mix(fill[0], edge[0], cortex), mix(fill[1], edge[1], cortex), mix(fill[2], edge[2], cortex));
    return id[q];
  };
  for (let j = 0; j < ny - 1; j++) for (let k = 0; k < nz - 1; k++) {
    const n = (val[j + ny * k] < 0) + (val[j + 1 + ny * k] < 0) + (val[j + ny * (k + 1)] < 0) + (val[j + 1 + ny * (k + 1)] < 0);
    if (n < 2) continue;
    const A = vert(j, k), B = vert(j + 1, k), Cc = vert(j, k + 1), D = vert(j + 1, k + 1);
    cap.idx.push(A, B, D, A, D, Cc);                             // faces +x
  }
  return cap;
}

// ---------------------------------------------------------------- write
// layout: Uint32[8] header | Float32[6] bbox | Int16 pos | Int8 nor (padded to 4) | Uint16 idx (padded) | Float32 cap pos | Uint8 cap col (padded) | Uint16 cap idx
function write(name, { pos, idx, nor }, cap = { pos: [], col: [], idx: [] }) {
  const nV = pos.length / 3;
  const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nV; i++) for (let a = 0; a < 3; a++) { bb[a] = Math.min(bb[a], pos[i * 3 + a]); bb[a + 3] = Math.max(bb[a + 3], pos[i * 3 + a]); }
  const q = new Int16Array(nV * 3);
  for (let i = 0; i < nV; i++) for (let a = 0; a < 3; a++) q[i * 3 + a] = Math.round(((pos[i * 3 + a] - bb[a]) / (bb[a + 3] - bb[a])) * 65535 - 32768);
  const pad4 = (n) => (n + 3) & ~3;
  const capV = cap.pos.length / 3;
  const parts = [
    new Uint8Array(new Uint32Array([0x50464231, nV, idx.length, capV, cap.idx.length, 0, 0, 0]).buffer),
    new Uint8Array(new Float32Array(bb).buffer),
    new Uint8Array(q.buffer), new Uint8Array(pad4(q.byteLength) - q.byteLength),
    new Uint8Array(nor.buffer), new Uint8Array(pad4(nor.byteLength) - nor.byteLength),
    new Uint8Array(new Uint16Array(idx).buffer), new Uint8Array(pad4(idx.length * 2) - idx.length * 2),
    new Uint8Array(new Float32Array(cap.pos).buffer),
    new Uint8Array(cap.col.map((c) => Math.round(clamp(c, 0, 1) * 255))), new Uint8Array(pad4(cap.col.length) - cap.col.length),
    new Uint8Array(new Uint16Array(cap.idx).buffer),
  ];
  const total = parts.reduce((a, p) => a + p.byteLength, 0), buf = new Uint8Array(total);
  let o = 0; for (const p of parts) { buf.set(p, o); o += p.byteLength; }
  writeFileSync(join(DIR, name), buf);
  console.log('wrote', name, (total / 1024).toFixed(0), 'KB;', nV, 'verts', idx.length / 3, 'tris; cap', cap.idx.length / 3, 'tris; bbox', bb.map((v) => v.toFixed(1)).join(' '));
}

const only = process.argv[2];
if (!only || only === 'bones') write('bones.bin', await meshSDF(sdf, [-17.2, -7.6, -12.2], [17.2, 14.2, 9.2], 0.22, 13000), boneCap());
if (!only || only === 'fetus') write('fetus.bin', await meshSDF(fetusSDF, [-7, -6.5, -7.5], [7, 20.5, 10], 0.25, 3200));
