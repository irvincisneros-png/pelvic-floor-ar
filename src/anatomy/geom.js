// Procedural geometry builders: lofted tubes, parametric sheets and thick sheets.
// All geometry is authored in centimetres in anatomical axes (x right, y up, z anterior).
// Every vertex carries the attributes the shared deformation shader needs:
//   position  mid-surface position            aOff   offset from mid-surface to the surface (thick sheets)
//   aPf       (mobility, radial coord, extra, side)   aAxis  centre-line point (tubes)
import * as THREE from 'three';
import { fbm3, smoothstep, clamp01 } from './noise.js';

export class Mesher {
  constructor() { this.pos = []; this.off = []; this.pf = []; this.axis = []; this.uv = []; this.idx = []; this.col = []; this.hasColor = false; }
  vert(p, o, pf, ax, uv, color) {
    const i = this.pos.length / 3;
    this.pos.push(p[0], p[1], p[2]);
    this.off.push(o ? o[0] : 0, o ? o[1] : 0, o ? o[2] : 0);
    this.pf.push(pf[0], pf[1], pf[2] || 0, pf[3] || 0);
    this.axis.push(ax ? ax[0] : p[0], ax ? ax[1] : p[1], ax ? ax[2] : p[2]);
    this.uv.push(uv ? uv[0] : 0, uv ? uv[1] : 0);
    if (color) { this.hasColor = true; this.col.push(color[0], color[1], color[2]); } else this.col.push(1, 1, 1);
    return i;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  /** Mirror all geometry added since `from` triangle-vertex index across x=0 and flip winding. */
  mirrorFrom(vFrom, iFrom) {
    const n0 = this.pos.length / 3;
    for (let i = vFrom; i < n0; i++) {
      this.pos.push(-this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      this.off.push(-this.off[i * 3], this.off[i * 3 + 1], this.off[i * 3 + 2]);
      this.pf.push(...this.pf.slice(i * 4, i * 4 + 4));
      this.axis.push(-this.axis[i * 3], this.axis[i * 3 + 1], this.axis[i * 3 + 2]);
      this.uv.push(this.uv[i * 2], this.uv[i * 2 + 1]);
      this.col.push(this.col[i * 3], this.col[i * 3 + 1], this.col[i * 3 + 2]);
    }
    const shift = n0 - vFrom;
    const end = this.idx.length;
    for (let k = iFrom; k < end; k += 3) {
      this.idx.push(this.idx[k] + shift, this.idx[k + 2] + shift, this.idx[k + 1] + shift);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(this.pos), off = new Float32Array(this.off);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aOff', new THREE.BufferAttribute(off, 3));
    g.setAttribute('aPf', new THREE.BufferAttribute(new Float32Array(this.pf), 4));
    g.setAttribute('aAxis', new THREE.BufferAttribute(new Float32Array(this.axis), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    if (this.hasColor) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    const n = pos.length / 3;
    const nor = new Float32Array(n * 3);
    const I = this.idx;
    for (let k = 0; k < I.length; k += 3) {
      const a = I[k], b = I[k + 1], c = I[k + 2];
      const ax = pos[a * 3] + off[a * 3], ay = pos[a * 3 + 1] + off[a * 3 + 1], az = pos[a * 3 + 2] + off[a * 3 + 2];
      const bx = pos[b * 3] + off[b * 3] - ax, by = pos[b * 3 + 1] + off[b * 3 + 1] - ay, bz = pos[b * 3 + 2] + off[b * 3 + 2] - az;
      const cx = pos[c * 3] + off[c * 3] - ax, cy = pos[c * 3 + 1] + off[c * 3 + 1] - ay, cz = pos[c * 3 + 2] + off[c * 3 + 2] - az;
      const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
      for (const v of [a, b, c]) { nor[v * 3] += nx; nor[v * 3 + 1] += ny; nor[v * 3 + 2] += nz; }
    }
    for (let i = 0; i < n; i++) {
      const l = Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]) || 1;
      nor[i * 3] /= l; nor[i * 3 + 1] /= l; nor[i * 3 + 2] /= l;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------- tubes
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/**
 * Sweep a cross-section along a path.
 * path: THREE.Curve. section(t, th, ctx) -> [a, b] offset in (N,B). attr(t, th, p, ctx) -> [mob, rad, extra, side]
 * opts: nAlong, nAround, up (reference vector), closed (loop path), uvLen (uv.x scale in cm), flip
 */
export function addTube(m, path, section, attr, opts = {}) {
  const nA = opts.nAlong || 24, nR = opts.nAround || 14;
  const up = opts.up || V(1, 0, 0);
  const closed = !!opts.closed;
  const rows = closed ? nA : nA + 1;
  const len = path.getLength();
  const base = m.pos.length / 3;
  for (let i = 0; i < rows; i++) {
    const t = i / nA;
    const tp = closed ? t % 1 : Math.min(t, 1);       // open paths must reach t = 1 (t % 1 would wrap the last ring to the start)
    const C = opts.byParam ? path.getPoint(tp) : path.getPointAt(tp);
    const T = (opts.byParam ? path.getTangent(tp) : path.getTangentAt(tp)).normalize();
    let N = new THREE.Vector3().crossVectors(up, T);
    if (N.lengthSq() < 1e-6) N.set(0, 0, 1);
    N.normalize();
    const B = new THREE.Vector3().crossVectors(T, N).normalize();
    for (let j = 0; j <= nR; j++) {
      const th = (j / nR) * Math.PI * 2;
      const [a, b] = section(t, th, { C, T, N, B });
      const p = [C.x + N.x * a + B.x * b, C.y + N.y * a + B.y * b, C.z + N.z * a + B.z * b];
      const at = attr ? attr(t, th, p, { C, T }) : [1, 0, 0, 0];
      m.vert(p, null, at, [C.x, C.y, C.z], [t * len * (opts.uvLen || 1), (th / (Math.PI * 2)) * (opts.uvAround || 6)]);
    }
  }
  const stride = nR + 1;
  const lastRow = closed ? rows : rows - 1;
  for (let i = 0; i < lastRow; i++) {
    const i1 = closed ? (i + 1) % rows : i + 1;
    for (let j = 0; j < nR; j++) {
      const a = base + i * stride + j, b = base + i * stride + j + 1;
      const c = base + i1 * stride + j, d = base + i1 * stride + j + 1;
      if (opts.flip) { m.tri(a, b, c); m.tri(b, d, c); } else { m.tri(a, c, b); m.tri(b, c, d); }
    }
  }
  addTubeCaps(m, path, attr, opts, base, stride, rows, nR, closed);
}

function addTubeCaps(m, path, attr, opts, base, stride, rows, nR, closed) {
  const addCap = (row, atEnd) => {
    const r0 = base + row * stride;
    const C = path.getPoint(atEnd ? 1 : 0);
    const c = m.vert([C.x, C.y, C.z], null, attr ? attr(atEnd ? 1 : 0, 0, [C.x, C.y, C.z], { C, T: C }) : [1, 0, 0, 0], [C.x, C.y, C.z], [0, 0]);
    for (let j = 0; j < nR; j++) { if (atEnd) m.tri(r0 + j, r0 + j + 1, c); else m.tri(r0 + j + 1, r0 + j, c); }
  };
  if (!closed && opts.capStart) addCap(0, false);
  if (!closed && opts.capEnd) addCap(rows - 1, true);
}

/** Elliptical section helper with organic noise. radii(t) -> [ra, rb]. */
export function ellipse(radii, noiseAmp = 0.06, noiseFreq = 0.35, seed = 0) {
  return (t, th, ctx) => {
    const [ra, rb] = radii(t, th);
    let a = Math.cos(th) * ra, b = Math.sin(th) * rb;
    if (noiseAmp) {
      const p = ctx.C;
      const n = fbm3(p.x * noiseFreq + seed + Math.cos(th) * 1.3, p.y * noiseFreq + Math.sin(th) * 1.3, p.z * noiseFreq + seed * 0.7, 3);
      const s = 1 + noiseAmp * n * 2;
      a *= s; b *= s;
    }
    return [a, b];
  };
}

/**
 * Parametric sheet. fn(u, v) -> { p:[x,y,z], mob, rad, extra, th, uv:[a,b] } (th = half thickness, cm).
 * thick: closed solid with outer/inner surfaces offset along the surface normal (outer faces +n).
 * opts.dense: cluster samples toward the edges (rounded rims).
 */
export function addSheet(m, nu, nv, fn, opts = {}) {
  const thick = opts.thick !== false;
  const eps = 1e-3;
  const dens = (s) => (opts.dense ? s - opts.dense * Math.sin(Math.PI * 2 * s) / (Math.PI * 2) : s);
  const idxO = [], idxI = [];
  const stride = nv + 1;
  for (let i = 0; i <= nu; i++) {
    const u = dens(i / nu);
    for (let j = 0; j <= nv; j++) {
      const v = dens(j / nv);
      const o = fn(u, v);
      let nrm = [0, 1, 0];
      if (thick) {
        const u0 = Math.max(0, u - eps), u1 = Math.min(1, u + eps), v0 = Math.max(0, v - eps), v1 = Math.min(1, v + eps);
        const pu0 = fn(u0, v).p, pu1 = fn(u1, v).p, pv0 = fn(u, v0).p, pv1 = fn(u, v1).p;
        const du = [pu1[0] - pu0[0], pu1[1] - pu0[1], pu1[2] - pu0[2]];
        const dv = [pv1[0] - pv0[0], pv1[1] - pv0[1], pv1[2] - pv0[2]];
        const nx = du[1] * dv[2] - du[2] * dv[1], ny = du[2] * dv[0] - du[0] * dv[2], nz = du[0] * dv[1] - du[1] * dv[0];
        const l = Math.hypot(nx, ny, nz) || 1;
        nrm = [nx / l, ny / l, nz / l];
      }
      const th = thick ? o.th : 0;
      const pf = [o.mob, o.rad, o.extra || 0, o.side || 0];
      const iO = m.vert(o.p, [nrm[0] * th, nrm[1] * th, nrm[2] * th], pf, null, o.uv || [u, v]);
      idxO.push(iO);
      if (thick) {
        const edge = i === 0 || i === nu || j === 0 || j === nv;
        if (th < 1e-3 && edge) idxI.push(iO);
        else idxI.push(m.vert(o.p, [-nrm[0] * th, -nrm[1] * th, -nrm[2] * th], pf, null, o.uv || [u, v]));
      }
    }
  }
  const flip = !!opts.flip;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * stride + j, b = a + 1, c = a + stride, d = c + 1;
    if (!flip) { m.tri(idxO[a], idxO[c], idxO[b]); m.tri(idxO[b], idxO[c], idxO[d]); }
    else { m.tri(idxO[a], idxO[b], idxO[c]); m.tri(idxO[b], idxO[d], idxO[c]); }
    if (thick) {
      if (!flip) { m.tri(idxI[a], idxI[b], idxI[c]); m.tri(idxI[b], idxI[d], idxI[c]); }
      else { m.tri(idxI[a], idxI[c], idxI[b]); m.tri(idxI[b], idxI[c], idxI[d]); }
    }
  }
}

export { V };
