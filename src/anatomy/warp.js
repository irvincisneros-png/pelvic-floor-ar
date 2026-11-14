// Deformation model. One set of scalar "fields" is derived from the model state; the same maths
// runs in the vertex shader (see materials.js) and in JS (warpPoint) so HTML labels and droplets
// can follow the tissue. Units: centimetres, anatomical axes (x right, y up, z anterior).
import { smoothstep } from './noise.js';

export const HZ = 1.0;                 // hiatus centre z
export const UT_B = [0, 3.3, -1.0];    // uterus base point (internal os)
export const UT_ALPHA = 0.95;          // uterus axis angle from +y towards +z (radians)
export const BL_C = [0, 2.9, 3.6];     // bladder centre

export const FIELD_NAMES = ['sag', 'lift', 'liftZ', 'hx', 'hz', 'thin', 'dome', 'ugx', 'ugy', 'ugz', 'utilt',
  'bsq', 'headR', 'headY', 'headZ', 'avul', 'sq', 'open', 'uopen', 'wave', 'waveAmp', 'hot', 'cav'];

export function newFields() { const f = {}; for (const n of FIELD_NAMES) f[n] = 0; f.wave = -99; return f; }

/** Map the model state (plus transient extras) to deformation fields. */
export function computeFields(s, ex, F = newFields()) {
  const c = s.contraction, cp = Math.max(c, 0), cn = Math.max(-c, 0);
  const preg = s.pregnancy, lax = s.laxity, st = s.stretch, p = s.pressure;
  F.sag = 2.7 * preg + 3.0 * lax + 3.8 * cn + 1.5 * p * (1 + 0.8 * lax + 0.45 * preg);
  F.lift = 2.6 * cp;
  F.liftZ = 1.7 * cp - 0.5 * cn;
  F.hx = 1.5 * st + 0.6 * lax + 0.2 * preg + 0.4 * cn - 0.42 * cp + 0.22 * s.avulsion;
  F.hz = 0.45 * st + 0.28 * lax + 0.08 * preg + 0.15 * cn - 0.22 * cp;
  F.thin = 1.15 * st + 0.28 * lax + 0.1 * preg;
  F.dome = 2.7 * st + 0.55 * cn + 0.35 * lax;
  F.ugx = 2.7 * preg; F.ugy = 4.6 * preg; F.ugz = 5.0 * preg; F.utilt = -0.45 * preg;
  F.cav = smoothstep(0.0, 0.5, preg);                 // uterine cavity opens as the wall thins
  F.bsq = 0.85 * preg + 0.3 * p;
  const h = s.head || 0;
  const into = Math.min(1, h);                       // 0..1 approach, 1 = crowning
  const out = Math.max(0, h - 1);                    // 1..2 delivered
  F.headR = 4.4 * smoothstep(0.0, 0.45, into) * (1 - smoothstep(0.55, 0.95, out));
  F.headY = 2.4 + (-4.3 - 2.4) * smoothstep(0, 1, into) + (-14) * smoothstep(0, 1, out);
  F.headZ = 0.8 + 0.6 * smoothstep(0, 1, into) + 4.5 * smoothstep(0, 1, out);
  F.avul = s.avulsion;
  F.sq = cp; F.open = 0.55 * lax + 0.45 * st + 0.3 * cn + (ex && ex.open ? ex.open : 0);
  F.uopen = ex && ex.uopen ? ex.uopen : 0;
  F.wave = ex ? ex.wave : -99; F.waveAmp = ex ? ex.waveAmp : 0; F.hot = ex ? ex.hot : 0;
  // fetus placement (not a shader field): head centre, scale and axis angle (from +y towards +z)
  {
    const sP = Math.pow(Math.max(preg, 0), 1.4), aP = UT_ALPHA + F.utilt, L = 2.4 + 7.6 * sP;
    const py = UT_B[1] + Math.cos(aP) * L + Math.sin(aP) * 0.6 * sP, pz = UT_B[2] + Math.sin(aP) * L - Math.cos(aP) * 0.6 * sP;
    const k = smoothstep(0, 0.6, into);
    F.fet = { s: (sP + (1 - sP) * k) * (1 - smoothstep(0.1, 0.7, out)) * (preg > 0.02 || h > 0 ? 1 : 0),
      y: py + (F.headY - py) * k, z: pz + (F.headZ - pz) * k, a: aP + (0.1 - aP) * k };
  }
  return F;
}

const sstep = smoothstep;
/**
 * JS mirror of the vertex shader warp (position only).
 * kind: 0 static, 1 muscle sheet, 2 uterus, 3 bladder, 4 tube.  push: soft tissue pushed by the head.
 */
export function warpPoint(kind, p, pf, axis, F, tube = { k: 0, w: 0, lum: 0 }, push = true) {
  const mob = pf[0], rad = pf[1], ext = pf[2];
  let x = p[0], y = p[1], z = p[2];
  if (kind === 1) {
    const w = Math.pow(Math.max(1 - rad, 0), 1.6);
    x *= 1 + F.hx * w;
    z = HZ + (z - HZ) * (1 + F.hz * w);
    y -= F.dome * Math.pow(Math.max(1 - rad, 0), 1.5);
  } else if (kind === 2) {
    const wg = sstep(0.02, 0.42, ext);
    const dx0 = x - UT_B[0], dy0 = y - UT_B[1], dz0 = z - UT_B[2];
    const ca = Math.cos(UT_ALPHA), sa = Math.sin(UT_ALPHA);
    let da = dy0 * ca + dz0 * sa, dt = -dy0 * sa + dz0 * ca, dx = dx0;
    da *= 1 + F.ugy * wg; dt *= 1 + F.ugz * wg; dx *= 1 + F.ugx * wg;
    const ang = F.utilt * wg, cA = Math.cos(ang), sA = Math.sin(ang);
    const da2 = da * cA - dt * sA, dt2 = da * sA + dt * cA;
    x = UT_B[0] + dx; y = UT_B[1] + da2 * ca - dt2 * sa; z = UT_B[2] + da2 * sa + dt2 * ca;
  } else if (kind === 3) {
    let dx = x - BL_C[0], dy = y - BL_C[1], dz = z - BL_C[2];
    dy *= 1 - 0.45 * F.bsq; dz *= 1 + 0.25 * F.bsq; dx *= 1 + 0.3 * F.bsq;
    x = BL_C[0] + dx; y = BL_C[1] + dy - 0.7 * F.bsq; z = BL_C[2] + dz + 0.5 * F.bsq;
  } else if (kind === 4) {
    const ts = 1 - tube.k * F.sq + tube.w * F.open + (tube.u || 0) * F.uopen;
    x = axis[0] + (x - axis[0]) * ts; y = axis[1] + (y - axis[1]) * ts; z = axis[2] + (z - axis[2]) * ts;
  }
  if (kind) {
    y += (F.lift - F.sag) * mob;
    z += F.liftZ * mob;
  }
  if (kind && push) {
    const dx = x, dy = y - F.headY, dz = z - F.headZ;
    const r = Math.hypot(dx, dy, dz), R = F.headR + 0.15, k = 0.7;
    const rn = 0.5 * (r + R + Math.sqrt((r - R) * (r - R) + k * k));
    const wgt = sstep(0.3, 1.2, F.headR);
    const s = r > 1e-3 ? rn / r : 1;
    x = x + (dx * s - dx) * wgt; y = y + (dy * s - dy) * wgt; z = z + (dz * s - dz) * wgt;
  }
  if (kind === 1) {
    const av = F.avul * (1 - sstep(0, 0.35, ext)) * sstep(0, 1.5, -p[0]) * (1 - sstep(0.35, 1, rad));
    x -= 1.7 * av; y -= 1.5 * av; z -= 3.3 * av;
  }
  return [x, y, z];
}

const f = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
/** GLSL source of the same warp. Needs attributes aOff aPf aAxis, uniforms F_* and uTubeK/uTubeW. */
export function warpGLSL() {
  const ufields = FIELD_NAMES.map((n) => `uniform float F_${n};`).join('\n');
  return `
${ufields}
uniform float uTubeK; uniform float uTubeW; uniform float uLumenK; uniform float uLumenLo; uniform float uUrOpen; uniform float uAvulK;
attribute vec3 aOff; attribute vec4 aPf; attribute vec3 aAxis;
vec3 pfWarp(vec3 p, vec3 off) {
  float mob = aPf.x; float rad = aPf.y; float ext = aPf.z;
  vec3 q = p;
  #if PF_KIND == 1
    float w = pow(max(1.0 - rad, 0.0), 1.6);
    off *= 1.0 / (1.0 + F_thin * w);
    q.x *= 1.0 + F_hx * w;
    q.z = ${f(HZ)} + (q.z - ${f(HZ)}) * (1.0 + F_hz * w);
    q.y -= F_dome * pow(max(1.0 - rad, 0.0), 1.5);
  #elif PF_KIND == 2
    float wg = smoothstep(0.02, 0.42, ext);
    q = aAxis + (q - aAxis) * (1.0 + 8.0 * aPf.w * F_cav * wg);      // cut face: inner edge follows the thinning wall
    vec3 d0 = q - vec3(${UT_B.map(f).join(',')});
    float ca = cos(${f(UT_ALPHA)}); float sa = sin(${f(UT_ALPHA)});
    float da = d0.y * ca + d0.z * sa; float dt = -d0.y * sa + d0.z * ca; float dx = d0.x;
    da *= 1.0 + F_ugy * wg; dt *= 1.0 + F_ugz * wg; dx *= 1.0 + F_ugx * wg;
    float ang = F_utilt * wg; float cA = cos(ang); float sA = sin(ang);
    float da2 = da * cA - dt * sA; float dt2 = da * sA + dt * cA;
    q = vec3(${f(UT_B[0])}, ${f(UT_B[1])}, ${f(UT_B[2])}) + vec3(dx, da2 * ca - dt2 * sa, da2 * sa + dt2 * ca);
  #elif PF_KIND == 3
    vec3 d1 = q - vec3(${BL_C.map(f).join(',')});
    d1.y *= 1.0 - 0.45 * F_bsq; d1.z *= 1.0 + 0.25 * F_bsq; d1.x *= 1.0 + 0.3 * F_bsq;
    q = vec3(${BL_C.map(f).join(',')}) + d1; q.y -= 0.7 * F_bsq; q.z += 0.5 * F_bsq;
  #elif PF_KIND == 4
    float ts = 1.0 - uTubeK * F_sq + uTubeW * F_open + uUrOpen * F_uopen;
    q = aAxis + (q - aAxis) * ts * (1.0 - aPf.w * uLumenK * F_sq * smoothstep(uLumenLo, uLumenLo + 0.3, mob)); off *= ts;
  #endif
  #if PF_KIND > 0
    q.y += (F_lift - F_sag) * mob;
    q.z += F_liftZ * mob;
  #endif
  #if PF_KIND > 0 && !defined(PF_NOPUSH)
    vec3 hd = q - vec3(0.0, F_headY, F_headZ);
    float hr = length(hd); float hR = F_headR + 0.15;
    float hrn = 0.5 * (hr + hR + sqrt((hr - hR) * (hr - hR) + 0.49));
    q += (hd * (hrn / max(hr, 0.001)) - hd) * smoothstep(0.3, 1.2, F_headR);
  #endif
  #if PF_KIND == 1
    // only the muscles that attach to the pubic bone (uAvulK), and only their inner part: the outer rim stays anchored
    float av = F_avul * uAvulK * (1.0 - smoothstep(0.0, 0.35, ext)) * smoothstep(0.0, 1.5, -p.x) * (1.0 - smoothstep(0.35, 1.0, rad));
    q += vec3(-1.7, -1.5, -3.3) * av;
  #endif
  return q + off;
}
`;
}
