// Factory functions for every anatomical part. Each returns a THREE.Mesh (or Group) in centimetre,
// anatomical axes. A scanned mesh can replace any of them by providing the same factory.
import * as THREE from 'three';
import { Mesher, addTube, addSheet, ellipse, V } from './geom.js';
import { makeMaterial } from './materials.js';
import { fbm3, smoothstep, clamp01, lerp } from './noise.js';

const CR = (pts, closed = false) => new THREE.CatmullRomCurve3(pts.map((p) => V(...p)), closed, 'centripetal');
const sag = (pts) => CR(pts.map(([y, z]) => [0, y, z]));          // path in the sagittal plane from (y,z)
const arr = (a, t, periodic = false) => {                          // smooth interpolation of an array over t in [0,1]
  const n = a.length; const x = periodic ? t * n : t * (n - 1);
  const i = Math.floor(x), f = smoothstep(0, 1, x - i);
  const i0 = periodic ? i % n : Math.min(i, n - 1), i1 = periodic ? (i + 1) % n : Math.min(i + 1, n - 1);
  return a[i0] + (a[i1] - a[i0]) * f;
};

// colours (muted clinical palette)
export const COL = {
  bone: 0xf1e6cf, pr: 0x8c1d36, pcm: 0xc6483c, ic: 0xe3957d, cocc: 0xb07a52, bladder: 0xdcc079, urethra: 0xe0a64a,
  uterus: 0xc98494, vagina: 0xd9808a, rectum: 0xb98468, perineal: 0xe3c9bd, fascia: 0xf0dccf, head: 0xeac0a6, obt: 0x9a5546,
};

export function createObturator() {
  // thin muscle lining the inner side wall (obturator internus) so the levator shelf has a visible origin
  const m = new Mesher();
  const build = (sgn) => addSheet(m, 20, 20, (u, v) => {
    const a = (u - 0.5) * 2, b = (v - 0.5) * 2;
    const rr = Math.sqrt(a * a + b * b);
    const x = sgn * (6.15 - 0.5 * (1 - Math.min(rr, 1)) + 0.15 * fbm3(u * 4, v * 4, 3));
    return { p: [x, 0.2 - 2.3 * b * 0.92 - 1.0, 1.6 + 3.1 * a], mob: 0, rad: 0, th: 0.25 * Math.sqrt(Math.max(0, 1 - rr * rr)) + 0.001, uv: [u * 6, v * 5] };
  }, { dense: 0.4, flip: sgn < 0 });
  build(1); build(-1);
  return m.build();
}

// ------------------------------------------------------------------ levator ani (one continuous bowl, split into parts)
export const U0 = 0.1;                                    // front cut (u = theta/pi)
const HAX = 1.75, HAZ = 3.15, HZc = 1.0;
const PERI = [[0.10, [1.75, -0.2, 5.5]], [0.18, [3.9, 0.1, 4.7]], [0.30, [5.9, 0.5, 3.2]], [0.45, [6.3, 0.7, 0.9]], [0.58, [6.1, 0.6, -1.4]],
  [0.70, [5.1, 0.3, -3.3]], [0.80, [3.7, -0.4, -4.9]], [0.90, [2.1, -1.0, -5.3]], [1.0, [0, -1.6, -4.9]]];
const periCurve = CR(PERI.map(([, p]) => p));
function periPt(ue) {                                       // approx by index-interpolation of keyed u
  let i = 0; while (i < PERI.length - 2 && ue > PERI[i + 1][0]) i++;
  const f = clamp01((ue - PERI[i][0]) / (PERI[i + 1][0] - PERI[i][0]));
  const t = (i + f) / (PERI.length - 1);
  return periCurve.getPoint(t);
}
export function rhoC(ue) { return 1 - 0.4 * Math.pow(smoothstep(0.7, 0.93, ue), 0.9); }
/** Mid-surface point of the levator sheet. uFull in [U0, 2-U0] (>1 = left side), rho 0 = hiatus edge, 1 = bony perimeter. */
export function levatorPoint(uFull, rho, yLift = 0) {
  const sgn = uFull <= 1 ? 1 : -1, ue = uFull <= 1 ? uFull : 2 - uFull;
  const th = ue * Math.PI;
  const hx = HAX * Math.sin(th) * (1 - 0.25 * Math.cos(th)), hz = HZc + HAZ * Math.cos(th);
  const hy = -0.9 - 1.0 * smoothstep(0.1, 0.95, ue);
  const P = periPt(ue);
  const r = rho;
  const x = sgn * lerp(hx, P.x, r), z = lerp(hz, P.z, r);
  let y = hy + (P.y - hy) * Math.pow(r, 1.5) + 0.12 * fbm3(ue * 6 + sgn, r * 5, 7) + yLift;
  const ext = (ue - U0) / (1 - U0);
  const mob = Math.pow(1 - r, 0.85) * smoothstep(0, 0.5, ext);
  return { p: [x, y, z], pf: [mob, r, ext, 0], ext, ue, sgn };
}
const thBase = (rho) => 0.14 + 0.42 * Math.exp(-Math.pow(rho / 0.22, 2));
const rim = (s, d) => (s < d ? Math.sqrt(Math.max(0, 1 - Math.pow(1 - s / d, 2))) : 1);
function bandSheet(m, uA, uB, rhoLo, rhoHi, nu, nv, thMul = 1, across = (u, rho) => rho * 6) {
  addSheet(m, nu, nv, (a, b) => {
    const uF = lerp(uA, uB, a);
    const ue = uF <= 1 ? uF : 2 - uF;
    const lo = typeof rhoLo === 'function' ? rhoLo(ue) : rhoLo, hi = typeof rhoHi === 'function' ? rhoHi(ue) : rhoHi;
    const rho = lerp(lo, hi, b);
    const L = levatorPoint(uF, rho);
    const th = thBase(rho) * thMul * rim(Math.min(a, 1 - a), 0.07) * rim(Math.min(b, 1 - b), 0.18 + 0.0);
    return { p: L.p, mob: L.pf[0], rad: L.pf[1], extra: L.pf[2], th: th + 0.0005, uv: [uF * 14, across(ue, rho)] };
  }, { dense: 0.55, flip: false });
}
export function createLevatorPart(name) {
  const m = new Mesher();
  const UA = U0, UB = 2 - U0;
  if (name === 'puborectalis') bandSheet(m, UA, UB, 0, 0.26, 56, 9, 1.2);
  else if (name === 'pubococcygeus') bandSheet(m, UA, UB, 0.26, 0.6, 56, 10, 0.95);
  else if (name === 'iliococcygeus') {
    const hi = (ue) => (ue < 0.7 ? 1 : rhoC(ue)), ac = (ue, rho) => rho * 6 - ue * 2;
    bandSheet(m, UA, 0.93, 0.6, hi, 28, 10, 0.8, ac);
    bandSheet(m, 0.93, 1.07, 0.6, 1, 6, 10, 0.8, ac);
    bandSheet(m, 1.07, UB, 0.6, hi, 28, 10, 0.8, ac);
  } else if (name === 'coccygeus') {
    for (const [a, b] of [[0.7, 0.93], [1.07, 1.3]]) {
      const lo = (ue) => rhoC(ue);
      addSheet(m, 14, 10, (s, t) => {
        const uF = lerp(a, b, s), ue = uF <= 1 ? uF : 2 - uF;
        const rho = lerp(lo(ue), 1, t);
        const L = levatorPoint(uF, rho);
        const th = 0.2 * rim(Math.min(s, 1 - s), 0.08) * rim(Math.min(t, 1 - t), 0.2);
        return { p: L.p, mob: L.pf[0], rad: L.pf[1], extra: L.pf[2], th: th + 0.0005, uv: [uF * 14, rho * 5 + ue * 3] };
      }, { dense: 0.55 });
    }
  }
  return m.build();
}
export function createFascia() {
  const m = new Mesher();
  addSheet(m, 44, 12, (a, b) => {
    const uF = lerp(U0 - 0.02, 2 - U0 + 0.02, a);
    const L = levatorPoint(Math.min(Math.max(uF, U0), 2 - U0), b, 0.55 + 0.35 * Math.sin(Math.PI * b));
    return { p: L.p, mob: L.pf[0], rad: L.pf[1], extra: L.pf[2], uv: [uF * 14, b * 6] };
  }, { thick: false });
  return m.build();
}

// ------------------------------------------------------------------ organs
const prof = (a, t) => arr(a, t);


// ------------------------------------------------------------------ tube specs (shared by shells and midsagittal caps)
const pw = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);
const Z4 = () => [0, 0, 0, 0];
let _specs = null;
function specs() {
  if (_specs) return _specs;
  const S = {};
  S.urethra = { path: sag([[0.75, 4.4], [-0.2, 4.72], [-1.6, 4.85], [-3.0, 4.6], [-3.9, 4.25]]), opts: { nAlong: 20, nAround: 12 },
    section: ellipse((t) => [arr([0.85, 0.6, 0.52, 0.5, 0.46], t), arr([0.9, 0.65, 0.58, 0.55, 0.5], t)], 0.05, 0.9, 3),
    attr: (t) => [0.5 + 0.1 * Math.sin(t * 3), 0, 0, 0],
    cap: { kind: 4, wall: () => 0.6, fill: [0.93, 0.74, 0.38], layer: 3, n: 24, lumen: true } };
  S.bladder = { path: sag([[0.6, 4.35], [1.9, 3.95], [3.4, 3.5], [4.8, 3.2], [5.5, 3.1]]), opts: { nAlong: 22, nAround: 18, capEnd: true },
    section: ellipse((t) => { const p = Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * t)), 0.62); return [2.45 * p, 3.05 * p]; }, 0.07, 0.25, 4),
    attr: (t) => [lerp(0.9, 0.4, t), 0, 0, 0],
    cap: { kind: 3, wall: () => 0.3, fill: [0.93, 0.8, 0.5], layer: 1, n: 30 } };
  { const ra = [1.1, 1.18, 0.95, 1.25, 1.6, 1.62, 1.25, 0.02], rb = [1.2, 1.28, 1.1, 1.85, 2.5, 2.65, 2.1, 0.02];
    const k = (t) => (t > 0.9 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.9) / 0.1, 2))) : 1);
    S.uterus = { path: sag([[1.45, -1.8], [2.5, -1.3], [3.5, -0.6], [4.7, 0.4], [5.9, 1.6], [6.8, 2.6], [7.3, 3.3]]), opts: { nAlong: 28, nAround: 18, capEnd: true, capStart: true },
      section: ellipse((t) => [arr(ra, t * 0.93) * k(t), arr(rb, t * 0.93) * k(t)], 0.05, 0.3, 6),
      attr: (t) => [lerp(0.8, 0.15, t), 0, t, 0],
      cap: { kind: 2, wall: (t) => (t < 0.2 ? 0.8 : 0.9), fill: [0.88, 0.58, 0.66], layer: 4, n: 40, lumen: true } }; }
  { const ra = [0.55, 0.62, 0.7, 0.95, 1.6], rb = [0.95, 1.1, 1.25, 1.6, 2.0];
    const k = (t) => (t > 0.88 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.88) / 0.12, 2))) : 1);
    S.vagina = { path: sag([[-3.5, 3.1], [-2.1, 2.45], [-0.5, 1.4], [1.0, 0.0], [2.1, -1.7]]), opts: { nAlong: 22, nAround: 16, capEnd: true },
      section: ellipse((t) => [arr(ra, t * 0.95) * k(t), arr(rb, t * 0.95) * k(t)], 0.04, 0.5, 8),
      attr: (t) => [lerp(0.9, 0.35, t), 0, 0, 0],
      cap: { kind: 4, wall: (t) => lerp(0.88, 0.32, smoothstep(0.5, 0.92, t)), fill: [0.93, 0.6, 0.6], layer: 2, n: 30, lumen: true } }; }
  { const r = [0.95, 0.92, 1.0, 1.3, 1.75, 2.0, 1.9, 1.6, 1.3];
    const k = (t) => (t > 0.94 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.94) / 0.06, 2))) : 1);
    S.rectum = { path: sag([[-3.9, -1.35], [-2.9, -1.05], [-1.8, -0.7], [-0.75, -0.75], [0.35, -2.2], [1.7, -4.1], [3.6, -5.6], [5.9, -6.1], [8.0, -5.5], [9.6, -4.3]]), opts: { nAlong: 30, nAround: 16, capEnd: true, uvLen: 1 },
      section: ellipse((t) => [arr(r, t) * k(t), arr(r, t) * k(t) * 1.08], 0.05, 0.45, 9),
      attr: (t) => [Math.max(0.1, 0.95 - t * 1.0), 0, 0, 0],
      cap: { kind: 4, wall: (t) => (t < 0.32 ? 0.66 : 0.32), fill: [0.82, 0.62, 0.5], layer: 3, n: 40, lumen: true } }; }
  S.perineal = { path: sag([[-3.3, 0.85], [-2.3, 0.9], [-1.1, 0.85]]), opts: { nAlong: 10, nAround: 14, capStart: true, capEnd: true, uvLen: 2 },
    section: ellipse((t) => [0.7 * Math.pow(Math.sin(Math.PI * (0.05 + 0.9 * t)), 0.4), lerp(1.3, 0.8, t)], 0.05, 0.8, 11),
    attr: () => [1, 0, 0, 0], cap: { kind: 4, solid: true, fill: [0.95, 0.84, 0.78], layer: 5, n: 12 } };
  S.head = { path: CR([[0, -1.1, 0], [0, 0, 0], [0, 1.1, 0]]), opts: { nAlong: 18, nAround: 22, capStart: true, capEnd: true, up: V(1, 0, 0) },
    section: ellipse((t) => { const p = Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2))); const e = 1 + 0.05 * Math.cos(t * 6.28); return [0.94 * p * e, 0.88 * p * e]; }, 0, 1.2, 12),
    attr: Z4, cap: { kind: 0, solid: true, fill: [0.9, 0.7, 0.58], layer: 0, n: 22 } };
  _specs = S; return S;
}
function shell(name) { const sp = specs()[name]; const m = new Mesher(); addTube(m, sp.path, sp.section, sp.attr, sp.opts); return m.build(); }
export const createUrethra = () => shell('urethra');
export const createBladder = () => shell('bladder');
export const createUterus = () => shell('uterus');
export const createVagina = () => shell('vagina');
export const createRectum = () => shell('rectum');
export const createPerinealBody = () => shell('perineal');
export function createHead() {
  // smooth egg-shaped scalp form: scaled sphere (same outline as the cut face in specs().head)
  const g = new THREE.SphereGeometry(1, 36, 26);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + 0.05 * Math.cos((y * 0.5 + 0.5) * 6.28) + 0.02 * fbm3(x * 1.4, y * 1.4, z * 1.4, 2);
    pos.setXYZ(i, x * 0.88 * k, y * 1.1 * k, z * 0.94 * k);
  }
  g.computeVertexNormals();
  g.setAttribute('aOff', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  g.setAttribute('aPf', new THREE.BufferAttribute(new Float32Array(pos.count * 4), 4));
  g.setAttribute('aAxis', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  return g;
}

// ------------------------------------------------------------------ midsagittal cut faces (real caps, authored on the x = 0 plane)
// They carry the same deformation attributes as the walls, so they move with the tissue. x = 0 is preserved by the warp.
function triPlus(m, a, b, c) {                      // add triangle whose normal faces +x
  const P = m.pos, ay = P[a * 3 + 1] + m.off[a * 3 + 1], az = P[a * 3 + 2] + m.off[a * 3 + 2];
  const by = P[b * 3 + 1] + m.off[b * 3 + 1], bz = P[b * 3 + 2] + m.off[b * 3 + 2];
  const cy = P[c * 3 + 1] + m.off[c * 3 + 1], cz = P[c * 3 + 2] + m.off[c * 3 + 2];
  const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
  if (nx >= 0) m.tri(a, b, c); else m.tri(a, c, b);
}
function stripCap(m, rows, getA, getB, colA, colB, layer, wFlagB, attrAt) {
  const base = [];
  for (const r of rows) {
    const mk = (off, col, flag) => {
      const p = [layer * 0.004, r.C.y + r.N.y * off, r.C.z + r.N.z * off];
      const at = attrAt(r.t); at[3] = flag;
      return m.vert(p, null, at, [0, r.C.y, r.C.z], [0, 0], col);
    };
    base.push([mk(getA(r), colA, 0), mk(getB(r), colB, wFlagB ? 1 : 0)]);
  }
  for (let i = 0; i < base.length - 1; i++) {
    const [a0, b0] = base[i], [a1, b1] = base[i + 1];
    triPlus(m, a0, b0, a1); triPlus(m, b0, b1, a1);
  }
}
function tubeCapRows(sp) {
  const up = sp.opts.up || V(1, 0, 0), n = sp.cap.n || 24, rows = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, C = sp.path.getPointAt(t), T = sp.path.getTangentAt(t).normalize();
    const N = new THREE.Vector3().crossVectors(up, T).normalize(), B = new THREE.Vector3().crossVectors(T, N).normalize();
    const ctx = { C, T, N, B };
    rows.push({ t, C, N, a0: sp.section(t, 0, ctx)[0], a1: sp.section(t, Math.PI, ctx)[0] });
  }
  return rows;
}
function capTube(m, sp) {
  const c = sp.cap, rows = tubeCapRows(sp), at = (t) => sp.attr(t, 0, [0, 0, 0], {});
  if (c.solid) {
    stripCap(m, rows, (r) => r.a1, (r) => r.a0, c.fill, c.fill, c.layer, false, at);
    if (c.cortex) {
      stripCap(m, rows, (r) => r.a0, (r) => r.a0 * (1 - c.cortex), c.edge, c.edge, c.layer + 1, false, at);
      stripCap(m, rows, (r) => r.a1, (r) => r.a1 * (1 - c.cortex), c.edge, c.edge, c.layer + 1, false, at);
    }
  } else {
    const dark = c.fill.map((v) => v * 0.78);
    stripCap(m, rows, (r) => r.a0, (r) => r.a0 * (1 - c.wall(r.t)), c.fill, dark, c.layer, !!c.lumen, at);
    stripCap(m, rows, (r) => r.a1, (r) => r.a1 * (1 - c.wall(r.t)), c.fill, dark, c.layer, !!c.lumen, at);
  }
}
function capLevator(m) {
  const bands = [[0, 0.26, 1.2, [0.62, 0.12, 0.2]], [0.26, 0.6, 0.95, [0.82, 0.3, 0.26]], [0.6, 1, 0.8, [0.9, 0.58, 0.48]]];
  for (const [lo, hi, mul, col] of bands) {
    const ids = [], N = 16;
    for (let i = 0; i <= N; i++) {
      const b = i / N, bd = b - 0.17 * Math.sin(Math.PI * 2 * b) / (Math.PI * 2) * 3.0;
      const rho = lerp(lo, hi, Math.min(1, Math.max(0, b - 0.55 * Math.sin(Math.PI * 2 * b) / (Math.PI * 2))));
      const L = levatorPoint(1.0, rho), L2 = levatorPoint(1.0, Math.min(1, rho + 0.01)), L1 = levatorPoint(1.0, Math.max(0, rho - 0.01));
      const U2 = levatorPoint(1.01, rho), U1 = levatorPoint(0.99, rho);
      const dv = [L2.p[0] - L1.p[0], L2.p[1] - L1.p[1], L2.p[2] - L1.p[2]], du = [U2.p[0] - U1.p[0], U2.p[1] - U1.p[1], U2.p[2] - U1.p[2]];
      let nx = du[1] * dv[2] - du[2] * dv[1], ny = du[2] * dv[0] - du[0] * dv[2], nz = du[0] * dv[1] - du[1] * dv[0];
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const th = thBase(rho) * mul * rim(Math.min(b, 1 - b), 0.18) + 0.0005;
      const mk = (sgn) => m.vert([0.006, L.p[1], L.p[2]], [0, ny * th * sgn, nz * th * sgn], [L.pf[0], L.pf[1], L.pf[2], 0], null, [0, 0], col);
      ids.push([mk(1), mk(-1)]);
    }
    for (let i = 0; i < N; i++) { const [a0, b0] = ids[i], [a1, b1] = ids[i + 1]; triPlus(m, a0, b0, a1); triPlus(m, b0, b1, a1); }
  }
}
/** Cap geometries: one per deformation class (tubes keep their own material parameters). */
export function createCaps() {
  const S = specs(), out = {};
  const mk = () => new Mesher();
  const m0 = mk(), m2 = mk(), m3 = mk(), m1 = mk();
  const byName = { 0: m0, 2: m2, 3: m3 };
  for (const [name, sp] of Object.entries(S)) {
    if (name === 'head') continue;
    if (sp.cap.kind === 4) { const mm = mk(); capTube(mm, sp); out[name] = mm; } else capTube(byName[sp.cap.kind], sp);
  }
  capLevator(m1);
  out.static = m0; out.uterus = m2; out.bladder = m3; out.muscle = m1;
  for (const k of Object.keys(out)) out[k] = out[k].build();
  return out;
}
export function createHeadCap() { const m = new Mesher(); capTube(m, specs().head); return m.build(); }

// ------------------------------------------------------------------ materials per part
export function makeMaterials() {
  const bone = { color: COL.bone, roughness: 0.55, cap: 0xcdbfa6, opacity: 0.62, transparent: true, depthWrite: false, bone: true, rim: 0xfff4dc, rimAmt: 0.35 };
  const capM = (kind, tube, nopush, urOpen, lumenLo) => makeMaterial({ kind, color: 0xffffff, roughness: 0.85, vertexColors: true, capFace: true, tube, nopush, urOpen, lumen: tube ? 1 : 0, lumenLo });
  return {
    bone: makeMaterial(bone),
    pr: makeMaterial({ kind: 1, color: COL.pr, roughness: 0.4, cap: 0x5e1220, fibre: true, rim: 0xffb0a0, rimAmt: 0.3, hotK: 1 }),
    pcm: makeMaterial({ kind: 1, color: COL.pcm, roughness: 0.42, cap: 0x7a2a24, fibre: true, rim: 0xffb8a8, rimAmt: 0.28, hotK: 0.9 }),
    ic: makeMaterial({ kind: 1, color: COL.ic, roughness: 0.48, cap: 0x9a5a48, fibre: true, arcus: true, rim: 0xffd6c8, rimAmt: 0.25, hotK: 0.2 }),
    cocc: makeMaterial({ kind: 1, color: COL.cocc, roughness: 0.46, cap: 0x7a4a2c, fibre: true, arcus: true, rim: 0xffc8a8, rimAmt: 0.25 }),
    fascia: makeMaterial({ kind: 1, color: COL.fascia, roughness: 0.35, cap: 0xd8c0b4, fascia: true, transparent: true, opacity: 0.12, depthWrite: false, rim: 0xffffff, rimAmt: 0.4 }),
    bladder: makeMaterial({ kind: 3, color: COL.bladder, roughness: 0.3, cap: 0xa88a48, veins: true, rim: 0xfff0c0, rimAmt: 0.5 }),
    urethra: makeMaterial({ kind: 4, color: COL.urethra, roughness: 0.34, cap: 0x8a5a20, tube: { k: 0.55, w: 0.15 }, urOpen: 0.5, lumen: 1, rim: 0xffe0a0, rimAmt: 0.5 }),
    uterus: makeMaterial({ kind: 2, color: COL.uterus, roughness: 0.34, cap: 0x8a4c5e, veins: true, rim: 0xffd0dc, rimAmt: 0.5 }),
    vagina: makeMaterial({ kind: 4, color: COL.vagina, roughness: 0.3, cap: 0x9c4852, rugae: true, tube: { k: 0.25, w: 0.35 }, rim: 0xffd0d0, rimAmt: 0.5 }),
    rectum: makeMaterial({ kind: 4, color: COL.rectum, roughness: 0.36, cap: 0x7a4c38, ridges: true, tube: { k: 0.12, w: 0.25 }, rim: 0xffd8c0, rimAmt: 0.45 }),
    perineal: makeMaterial({ kind: 4, color: COL.perineal, roughness: 0.5, cap: 0xb89488, fibre: true, nopush: true, rim: 0xffffff, rimAmt: 0.2 }),
    head: makeMaterial({ kind: 0, color: COL.head, roughness: 0.6, cap: 0xa87a68, skin: true, rim: 0xffd8c8, rimAmt: 0.3 }),
    fetus: makeMaterial({ kind: 0, color: COL.head, roughness: 0.58, cap: 0xe8b8a0, skin: true, noclip: true, rim: 0xffdccc, rimAmt: 0.4 }),
    caps: { static: capM(0), muscle: capM(1), uterus: capM(2), bladder: capM(3),
      urethra: capM(4, { k: 0.55, w: 0.15 }, false, 0.5), vagina: capM(4, { k: 0.25, w: 0.35 }), rectum: capM(4, { k: 0.12, w: 0.25 }, false, 0, 0.45), perineal: capM(4, { k: 0, w: 0 }, true), head: capM(0) },
  };
}

// ------------------------------------------------------------------ label anchors (rest positions + deformation class)
export function labelAnchors() {
  const lev = (u, r, yl = 0) => levatorPoint(u, r, yl);
  const mus = (u, r) => { const L = lev(u, r); return { kind: 1, p: L.p, pf: L.pf, off: [0, 0.35, 0] }; };
  return {
    pubicBone: { kind: 0, p: [0, 0.8, 7.0], pf: [0, 0, 0] },
    sacrum: { kind: 0, p: [0, 5.6, -8.15], pf: [0, 0, 0] },
    coccyx: { kind: 0, p: [0, -0.9, -6.5], pf: [0, 0, 0] },
    bladder: { kind: 3, p: [0, 3.3, 3.8], pf: [0.65, 0, 0] },
    urethra: { kind: 4, p: [0, -1.4, 4.8], pf: [0.55, 0, 0], axis: [0, -1.4, 4.8], tube: { k: 0.55, w: 0.15, u: 0.5 } },
    uterus: { kind: 2, p: [0, 5.9, 1.6], pf: [0.4, 0, 0.7] },
    vagina: { kind: 4, p: [0, -0.5, 1.35], pf: [0.62, 0, 0], axis: [0, -0.5, 1.4], tube: { k: 0.25, w: 0.35 } },
    rectum: { kind: 4, p: [0, 3.6, -5.6], pf: [0.4, 0, 0], axis: [0, 3.6, -5.6], tube: { k: 0.12, w: 0.25 } },
    pubococcygeus: mus(1.62, 0.43),
    puborectalis: mus(1.2, 0.12),
    iliococcygeus: mus(1.5, 0.82),
    coccygeus: mus(1.18, 0.86),
    perinealBody: { kind: 4, p: [0, -2.4, 0.9], pf: [1, 0, 0], axis: [0, -2.4, 0.9], tube: { k: 0, w: 0 }, nopush: true },
    fascia: { kind: 1, ...(() => { const L = lev(1.7, 0.55, 0.6); return { p: L.p, pf: L.pf }; })() },
    avulsion: { kind: 0, p: [-1.9, -0.1, 5.35], pf: [0, 0, 0] },
  };
}
