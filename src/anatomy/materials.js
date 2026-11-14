// Shared uniforms + shader-injected MeshStandardMaterial used by every anatomical part.
// Adds: GPU deformation (warp.js), fibre striations, vein/rugae/bone detail, wet specular,
// fresnel rim, cough-wave glow, own clip plane (no renderer.localClippingEnabled needed) and flat
// "cut surface" shading on back faces so a clipped solid reads as a cross-section.
import * as THREE from 'three';
import { FIELD_NAMES, newFields, warpGLSL } from './warp.js';

export const SHARED = {
  uClipN: { value: new THREE.Vector3(1, 0, 0) },
  uClipD: { value: 100 },
  uAnatInv: { value: new THREE.Matrix4() },
  uTime: { value: 0 },
};
for (const n of FIELD_NAMES) SHARED['F_' + n] = { value: n === 'wave' ? -99 : 0 };

export function setFields(F) { for (const n of FIELD_NAMES) SHARED['F_' + n].value = F[n]; }

const NOISE = `
float pfHash(vec3 p){ p = fract(p*0.3183099+vec3(.1,.2,.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float pfNoise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(pfHash(i),pfHash(i+vec3(1,0,0)),f.x),mix(pfHash(i+vec3(0,1,0)),pfHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(pfHash(i+vec3(0,0,1)),pfHash(i+vec3(1,0,1)),f.x),mix(pfHash(i+vec3(0,1,1)),pfHash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float pfFbm(vec3 p){ return 0.5*pfNoise(p)+0.25*pfNoise(p*2.03)+0.125*pfNoise(p*4.1); }
`;

const CLIP_VERT_DECL = `uniform mat4 uAnatInv; varying vec3 vLocal;`;
const CLIP_FRAG_DECL = `uniform vec3 uClipN; uniform float uClipD; varying vec3 vLocal;`;

/** Clip-only hook for helper materials (depth pre-pass). */
export function injectClip(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uAnatInv = SHARED.uAnatInv; shader.uniforms.uClipN = SHARED.uClipN; shader.uniforms.uClipD = SHARED.uClipD;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + CLIP_VERT_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vLocal = (uAnatInv * modelMatrix * vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CLIP_FRAG_DECL)
      .replace('void main() {', 'void main() {\n if (dot(uClipN, vLocal) > uClipD) discard;');
  };
  material.customProgramCacheKey = () => 'pfclip';
}

let matId = 0;
/**
 * opts: kind (0 static,1 muscle,2 uterus,3 bladder,4 tube), color, roughness, cap (colour of cut/inside faces),
 * rim, rimAmt, fibre, veins, rugae, bone, skin, fascia, opacity, tube {k,w}, hotK, side
 */
export function makeMaterial(o) {
  const kind = o.kind || 0;
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(o.color), roughness: o.roughness ?? 0.5, metalness: 0,
    side: o.side ?? THREE.DoubleSide, transparent: !!o.transparent, opacity: 1, vertexColors: !!o.vertexColors,
    depthWrite: o.depthWrite ?? !o.transparent,
  });
  const col = (c) => new THREE.Color(c);
  const u = {
    uGlow: { value: 0 },
    uTubeK: { value: o.tube?.k ?? 0 }, uTubeW: { value: o.tube?.w ?? 0 },
    uHotK: { value: o.hotK ?? 0 },
    uAvulK: { value: o.avulK ?? 0 },
    uAlpha: { value: o.opacity ?? 1 },
    uCap: { value: col(o.color).lerp(col(o.cap ?? o.color), 0.55) },
    uRim: { value: col(o.rim ?? 0xffffff).multiplyScalar(o.rimAmt ?? 0.22) },
    uTint: { value: col(o.color) },
    uNoClip: { value: o.noclip ? 1 : 0 }, uLumenK: { value: o.lumen ?? 0 }, uLumenLo: { value: o.lumenLo ?? -1 }, uUrOpen: { value: o.urOpen ?? 0 }, uDim: { value: 0 }, uOpacity: { value: 1 },
  };
  u.uRimBase = { value: u.uRim.value.clone() };
  mat.userData.u = u;
  const defs = []; if (o.capFace) defs.push('PF_CAP');
  for (const k of ['fibre', 'veins', 'rugae', 'bone', 'skin', 'fascia', 'ridges', 'arcus', 'nopush', 'noclip']) if (o[k]) defs.push('PF_' + k.toUpperCase());
  const key = `pf${kind}-${defs.join('')}-${matId++ % 1}`;
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, SHARED, u);
    const header = `#define PF_KIND ${kind}\n` + defs.map((d) => `#define ${d}`).join('\n') + '\n';
    shader.vertexShader = header + shader.vertexShader
      .replace('#include <common>', `#include <common>
${CLIP_VERT_DECL}
varying vec3 vRest; varying vec4 vPf; varying vec2 vUvF; varying float vUp;
${kind ? warpGLSL() : 'attribute vec3 aOff; attribute vec4 aPf; attribute vec3 aAxis;'}`)
      .replace('#include <beginnormal_vertex>', `
vec3 pfPos = position;
#if PF_KIND > 0
  vec3 pfW0 = pfWarp(position, aOff);
  const float pfE = 0.03;
  mat3 pfJ = mat3(pfWarp(position + vec3(pfE,0.0,0.0), aOff) - pfW0, pfWarp(position + vec3(0.0,pfE,0.0), aOff) - pfW0, pfWarp(position + vec3(0.0,0.0,pfE), aOff) - pfW0) / pfE;
  pfPos = pfW0;
  vec3 objectNormal = abs(determinant(pfJ)) > 1e-4 ? normalize(transpose(inverse(pfJ)) * normal) : normal;
#else
  pfPos = position + aOff;
  vec3 objectNormal = vec3(normal);
#endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = pfPos;
vRest = position; vPf = aPf; vUvF = uv;
vLocal = (uAnatInv * modelMatrix * vec4(pfPos, 1.0)).xyz;`);

    shader.fragmentShader = header + shader.fragmentShader
      .replace('#include <common>', `#include <common>
${CLIP_FRAG_DECL}
uniform float uTime; uniform float uGlow; uniform float uHotK; uniform float uAvulK; uniform float uAlpha;
uniform vec3 uCap; uniform vec3 uRim; uniform vec3 uTint; uniform float uDim; uniform float uOpacity; uniform float uNoClip;
uniform float F_wave; uniform float F_waveAmp; uniform float F_hot; uniform float F_thin; uniform float F_avul;
varying vec3 vRest; varying vec4 vPf; varying vec2 vUvF;
${NOISE}`)
      .replace('void main() {', `void main() {
  #ifdef PF_CAP
    if (uClipD > 0.6) discard;
  #else
    if (uNoClip < 0.5 && dot(uClipN, vLocal) > uClipD) discard;
  #endif
  float pfH = 0.0;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    float mott = pfFbm(vRest * 0.8);
    diffuseColor.rgb *= 0.88 + 0.26 * mott;
    #ifdef PF_FIBRE
      float wob = pfFbm(vec3(vUvF.x * 0.30, vUvF.y * 0.45, 1.7));
      float s1 = sin((vUvF.y * 1.9 + wob * 2.6) * 6.2831);
      float s2 = sin((vUvF.y * 5.3 + wob * 4.0 + vUvF.x * 0.07) * 6.2831);
      float fib = 0.65 * s1 + 0.35 * s2;
      pfH = fib * 0.5 + 0.5;
      float crs = pfNoise(vec3(vUvF.x * 2.2, vUvF.y * 0.6, 4.0));
      diffuseColor.rgb *= 0.72 + 0.34 * pfH + 0.06 * crs;
      float thinMix = clamp(F_thin * pow(max(1.0 - vPf.y, 0.0), 1.6) * 0.45, 0.0, 0.6);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.05, 1.0) + vec3(0.07, 0.04, 0.03), thinMix);
      #if PF_KIND == 1
        // torn (avulsed) end: frayed, pale and bruised where the muscle has come away from the pubic bone
        float torn = F_avul * uAvulK * (1.0 - smoothstep(0.0, 0.32, vPf.z)) * step(vRest.x, 0.0) * (1.0 - smoothstep(0.0, 0.7, vPf.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.12, 0.2) + 0.25 * pfH, torn * 0.8);
      #endif
    #endif
    #ifdef PF_ARCUS
      float arc = smoothstep(0.9, 0.985, vPf.y) * (1.0 - smoothstep(0.995, 1.0, vPf.y)) ;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.88, 0.78), arc * 0.85);
    #endif
    #ifdef PF_VEINS
      float vn = pfFbm(vRest * 0.5 + 3.1);
      float vein = 1.0 - smoothstep(0.0, 0.03, abs(vn - 0.5));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.72, 0.42, 0.46), vein * 0.55);
      pfH = pfFbm(vRest * 2.2) * 0.7;
    #endif
    #ifdef PF_RUGAE
      float rg = 0.5 + 0.5 * sin(vUvF.x * 5.2 + pfFbm(vRest * 0.8) * 5.0);
      pfH = rg;
      diffuseColor.rgb *= 0.9 + 0.12 * rg;
    #endif
    #ifdef PF_RIDGES
      pfH = 0.5 + 0.5 * sin(vUvF.x * 3.4 + pfNoise(vRest) * 3.0);
      diffuseColor.rgb *= 0.92 + 0.1 * pfH;
    #endif
    #ifdef PF_BONE
      float trab = pfFbm(vRest * 2.2);
      float pores = pfNoise(vRest * 9.0);
      diffuseColor.rgb *= 0.93 + 0.1 * trab + 0.04 * pores;
      pfH = trab * 0.35 + pores * 0.12;
      diffuseColor.a = uAlpha;
    #endif
    #ifdef PF_SKIN
      pfH = pfFbm(vRest * 4.0) * 0.4;
    #endif
    #ifdef PF_FASCIA
      float fw = pfFbm(vRest * 1.6);
      diffuseColor.rgb *= 0.9 + 0.2 * fw;
      pfH = fw;
      diffuseColor.a = uAlpha * (0.55 + 0.9 * fw);
    #endif
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.33, uDim);
  }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor * (0.7 + 0.6 * pfFbm(vRest * 2.6)), 0.08, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec3 sx = normalize(dFdx(-vViewPosition)); vec3 sy = normalize(dFdy(-vViewPosition));
    vec3 r1 = cross(sy, normal); vec3 r2 = cross(normal, sx);
    float det = dot(sx, r1) * faceDirection;
    vec3 grad = sign(det) * (dFdx(pfH) * r1 + dFdy(pfH) * r2);
    normal = normalize(abs(det) * normal - grad * 0.55);
  }
  float pfFres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += uRim * pfFres;
  {
    float wv = exp(-pow((vLocal.y - F_wave) / 2.4, 2.0)) * F_waveAmp;
    totalEmissiveRadiance += vec3(1.0, 0.55, 0.2) * wv * 1.25;
    #if PF_KIND == 1
      totalEmissiveRadiance += vec3(1.0, 0.5, 0.15) * F_hot * uHotK * pow(max(1.0 - vPf.y, 0.0), 1.2) * 1.1;
    #endif
    totalEmissiveRadiance += vec3(0.95, 0.85, 0.3) * uGlow * (0.22 + 0.12 * sin(uTime * 6.0));
  }`)
      .replace('#include <opaque_fragment>', `
  #ifdef PF_CAP
    outgoingLight = diffuseColor.rgb * (0.93 + 0.12 * pfFbm(vRest * 5.0)) + vec3(0.95, 0.85, 0.3) * uGlow * 0.2;
  #else
  float cutE = (1.0 - smoothstep(0.0, 0.2, uClipD - vLocal.x)) * step(uClipD, 6.0);
  cutE *= 1.0 - uNoClip;
  if (!gl_FrontFacing) {
    float cv = 0.9 + 0.2 * pfFbm(vLocal * 1.7);
    outgoingLight = uCap * cv * (1.02 + 0.3 * pfFres);
  }
  outgoingLight += vec3(0.95, 0.82, 0.7) * cutE * 0.5;
  #endif
  diffuseColor.a *= uOpacity;
  #ifdef PF_BONE
    diffuseColor.a = clamp(uAlpha * (0.8 + 1.4 * pfFres), 0.0, 0.94);
    if (!gl_FrontFacing) diffuseColor.a = uAlpha * 0.9;
  #endif
  #include <opaque_fragment>`);
  };
  return mat;
}

export { newFields };
