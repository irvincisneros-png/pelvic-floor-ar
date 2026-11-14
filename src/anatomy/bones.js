// Loads the baked bony pelvis (tools/bake-bones.mjs -> bones.bin): surface mesh + midsagittal cut face.
import * as THREE from 'three';

const zeros = (n, size) => new THREE.BufferAttribute(new Float32Array(n * size), size);
function withDeformAttrs(g, n) {
  g.setAttribute('aOff', zeros(n, 3)); g.setAttribute('aPf', zeros(n, 4)); g.setAttribute('aAxis', zeros(n, 3)); g.setAttribute('uv', zeros(n, 2));
  return g;
}

async function loadBaked(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' ' + res.status);
  const buf = await res.arrayBuffer();
  const head = new Uint32Array(buf, 0, 8);
  if (head[0] !== 0x50464231) throw new Error('bones.bin: bad header');
  const nV = head[1], nI = head[2], cV = head[3], cI = head[4];
  const pad4 = (n) => (n + 3) & ~3;
  let o = 32;
  const bb = new Float32Array(buf, o, 6); o += 24;
  const q = new Int16Array(buf, o, nV * 3); o += pad4(nV * 6);
  const nq = new Int8Array(buf, o, nV * 3); o += pad4(nV * 3);
  const idx = new Uint16Array(buf, o, nI); o += pad4(nI * 2);
  const cpos = new Float32Array(buf, o, cV * 3); o += cV * 12;
  const ccol = new Uint8Array(buf, o, cV * 3); o += pad4(cV * 3);
  const cidx = new Uint16Array(buf, o, cI);

  const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3);
  for (let i = 0; i < nV * 3; i++) {
    const a = i % 3;
    pos[i] = bb[a] + ((q[i] + 32768) / 65535) * (bb[a + 3] - bb[a]);
    nor[i] = nq[i] / 127;
  }
  const bone = new THREE.BufferGeometry();
  bone.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  bone.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  bone.setIndex(new THREE.BufferAttribute(idx.slice(), 1));
  withDeformAttrs(bone, nV); bone.computeBoundingSphere();

  const cap = new THREE.BufferGeometry();
  const cp = cpos.slice(); for (let i = 0; i < cV; i++) cp[i * 3] = 0.004;
  cap.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  const cn = new Float32Array(cV * 3); for (let i = 0; i < cV; i++) cn[i * 3] = 1;
  cap.setAttribute('normal', new THREE.BufferAttribute(cn, 3));
  const cc = new Float32Array(cV * 3); for (let i = 0; i < cV * 3; i++) cc[i] = ccol[i] / 255;
  cap.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  cap.setIndex(new THREE.BufferAttribute(cidx.slice(), 1));
  withDeformAttrs(cap, cV); cap.computeBoundingSphere();
  return { bone, cap };
}

export const loadBones = () => loadBaked(new URL('./bones.bin', import.meta.url));
export const loadFetus = async () => (await loadBaked(new URL('./fetus.bin', import.meta.url))).bone;
