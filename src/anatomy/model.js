// Assembles the pelvis model: parts, caps, lights, view presets, cutaway, deformation uniforms, droplets, arrows.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as P from './parts.js';
import { SHARED, setFields, injectClip } from './materials.js';
import { loadBones, loadFetus } from './bones.js';
import { computeFields, newFields, warpPoint } from './warp.js';

export const SCALE = 1 / 29;                       // 1 unit = pelvis width (29 cm)
export const VIEWS = {
  '3d':    { euler: [0.66, -0.3, 0], cut: false },
  side:    { euler: [0.07, -Math.PI / 2, 0], cut: true },              // straight lateral, looking at the midsagittal cut face
  above:   { euler: [Math.PI / 2 - 0.42, Math.PI, 0], cut: false },
  below:   { euler: [-Math.PI / 2 + 0.38, 0, 0], cut: false },
};
const FRAME = { '3d': { y: 3.0, z: -1.0, zoom: 0.9 }, side: { y: 2.4, z: -1.5, zoom: 1.6 }, above: { y: 4.2, z: 0, zoom: 1.0 }, below: { y: 2.6, z: 0.4, zoom: 1.15 } };
export const PART_IDS = ['pubicBone', 'sacrum', 'coccyx', 'bladder', 'urethra', 'uterus', 'vagina', 'rectum', 'pubococcygeus',
  'puborectalis', 'iliococcygeus', 'coccygeus', 'perinealBody', 'fascia'];
const BONE_ALPHA = { '3d': 0.74, side: 0.22, above: 0.7, below: 0.42 };
const ORGANS = ['bladder', 'urethra', 'uterus', 'vagina', 'rectum'];
const PIN_HIDE = { '3d': [], side: [], above: ['urethra', 'perinealBody', 'coccyx', 'vagina'], below: ['bladder', 'uterus', 'sacrum'] };

export async function createPelvisModel() {
  const [baked, fetusGeo] = await Promise.all([loadBones(), loadFetus()]);
  const root = new THREE.Group(); root.name = 'pelvis-root';
  const pivot = new THREE.Group(); pivot.position.y = 0.34; root.add(pivot);
  const anatomy = new THREE.Group(); anatomy.scale.setScalar(SCALE); pivot.add(anatomy);
  const M = P.makeMaterials();
  const mesh = (geo, mat, order = 0) => { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = order; anatomy.add(m); return m; };
  const meshes = {}, capMeshes = {};

  // bones: merged, with a depth pre-pass so only the nearest bone surface blends (clean ghost bone)
  const boneGeo = baked.bone;
  const prepass = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  injectClip(prepass);
  mesh(boneGeo, prepass, 8);
  meshes.bone = mesh(boneGeo, M.bone, 9);

  meshes.puborectalis = mesh(P.createLevatorPart('puborectalis'), M.pr);
  meshes.pubococcygeus = mesh(P.createLevatorPart('pubococcygeus'), M.pcm);
  meshes.iliococcygeus = mesh(P.createLevatorPart('iliococcygeus'), M.ic);
  meshes.coccygeus = mesh(P.createLevatorPart('coccygeus'), M.cocc);
  meshes.fascia = mesh(P.createFascia(), M.fascia, 5);
  meshes.bladder = mesh(P.createBladder(), M.bladder, 6);
  meshes.urethra = mesh(P.createUrethra(), M.urethra, 6);
  meshes.uterus = mesh(P.createUterus(), M.uterus, 6);
  meshes.vagina = mesh(P.createVagina(), M.vagina, 6);
  meshes.rectum = mesh(P.createRectum(), M.rectum, 6);
  meshes.perinealBody = mesh(P.createPerinealBody(), M.perineal);
  meshes.head = mesh(P.createHead(), M.head); meshes.head.visible = false;
  meshes.fetus = mesh(fetusGeo, M.fetus, 6); meshes.fetus.visible = false;
  // cut faces
  const caps = P.createCaps(); caps.static.dispose(); caps.static = baked.cap;
  for (const k of Object.keys(caps)) capMeshes[k] = mesh(caps[k], M.caps[k], 7);
  capMeshes.head = mesh(P.createHeadCap(), M.caps.head, 7); capMeshes.head.visible = false;
  const capOf = { bladder: ['bladder'], urethra: ['urethra'], uterus: ['uterus'], vagina: ['vagina'], rectum: ['rectum'], perinealBody: ['perineal'] };

  const mats = { sacrum: M.bone, pubicBone: M.bone, coccyx: M.bone, bladder: M.bladder, urethra: M.urethra, uterus: M.uterus, vagina: M.vagina, rectum: M.rectum,
    pubococcygeus: M.pcm, puborectalis: M.pr, iliococcygeus: M.ic, coccygeus: M.cocc, perinealBody: M.perineal, fascia: M.fascia };
  const matCaps = { sacrum: ['static'], pubicBone: ['static'], coccyx: ['static'], bladder: ['bladder'], urethra: ['urethra'], uterus: ['uterus'], vagina: ['vagina'], rectum: ['rectum'],
    pubococcygeus: ['muscle'], puborectalis: ['muscle'], iliococcygeus: ['muscle'], coccygeus: ['muscle'], perinealBody: ['perineal'], fascia: [] };

  // droplets + pressure arrows
  const NDROP = 6;
  const dropMat = new THREE.MeshStandardMaterial({ color: 0xf6e58a, roughness: 0.1, transparent: true, opacity: 0.92, emissive: 0x6a5410 });
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.46, 12, 9), dropMat, NDROP); drops.frustumCulled = false; drops.count = 0; drops.renderOrder = 12; anatomy.add(drops);
  const dropState = Array.from({ length: NDROP }, () => ({ t: -1, delay: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.0, depthWrite: false });
  const NARR = 5;
  const arrowHead = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 1.7, 12), arrowMat, NARR);
  const arrowShaft = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 8), arrowMat, NARR);
  for (const a of [arrowHead, arrowShaft]) { a.frustumCulled = false; a.renderOrder = 13; a.visible = false; anatomy.add(a); }
  const dummy = new THREE.Object3D();

  // lights (the caller adds this group to its scene)
  const lights = new THREE.Group(); lights.name = 'pelvis-lights';
  lights.add(new THREE.HemisphereLight(0xe6edf8, 0x8d7f86, 1.7));
  const key = new THREE.DirectionalLight(0xfff2e6, 2.4); key.position.set(1.4, 2.4, 3); lights.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xa9bfe0, 0.9); fill.position.set(-2.5, 0.8, 1.2); lights.add(fill, fill.target);
  const under = new THREE.DirectionalLight(0xffe8dc, 1.1); under.position.set(0, -2.2, 2.2); lights.add(under, under.target);
  const back = new THREE.DirectionalLight(0xffe0d0, 1.0); back.position.set(0.5, 2, -3); lights.add(back, back.target);

  const anchors = P.labelAnchors();
  let F = newFields();
  const viewQ = new THREE.Quaternion(), targetQ = new THREE.Quaternion();
  let viewName = '3d', cutT = 100, started = false, organMode = 'solid', fasciaOn = false, selected = null, headHide = false;
  const frame = { cur: { y: 3.2, z: 0.4, zoom: 1.12 }, tgt: { y: 3.2, z: 0.4, zoom: 1.12 }, custom: null };
  const applyFrame = (snap) => {
    const b = (frame.custom && frame.custom[viewName]) || FRAME[viewName] || FRAME['3d'];
    frame.tgt = { y: b.y, z: b.z || 0, zoom: b.zoom };
    if (snap) frame.cur = { ...frame.tgt };
  };
  const setFraming = (o) => { frame.custom = o; applyFrame(false); };
  const setView = (name, snap) => {
    const v = VIEWS[name] || VIEWS['3d']; viewName = name;
    targetQ.setFromEuler(new THREE.Euler(v.euler[0], v.euler[1], v.euler[2], 'XYZ'));
    cutT = v.cut ? 0 : 30; applyFrame(snap || !started);
    if (snap || !started) { viewQ.copy(targetQ); pivot.quaternion.copy(viewQ); SHARED.uClipD.value = cutT; started = true; }
  };
  setView('3d', true);

  function setOrganMode(mode) {
    organMode = mode;
    const ghost = mode === 'ghost';
    for (const id of ORGANS) {
      const m = mats[id], u = m.userData.u;
      m.transparent = ghost; m.depthWrite = !ghost; m.side = ghost ? THREE.FrontSide : THREE.DoubleSide;
      u.uOpacity.value = ghost ? 0.3 : 1;
      u.uRim.value.copy(u.uRimBase.value).multiplyScalar(ghost ? 2.6 : 1);
      m.needsUpdate = true;
      meshes[id].visible = mode !== 'hide';
    }
    refreshCaps();
  }
  function refreshCaps() {
    const hide = organMode === 'hide';
    for (const id of ORGANS) for (const c of capOf[id]) capMeshes[c].visible = !hide;
    capMeshes.perineal.visible = true;
  }
  const isOrganHidden = () => organMode === 'hide';

  function applyState(state, extras, dt = 0.016) {
    F = computeFields(state, extras, F);
    setFields(F);
    meshes.head.visible = capMeshes.head.visible = false;
    { const f = meshes.fetus, t = F.fet;                                // baked fetal form: head-down, facing the mother's back
      f.visible = t.s > 0.03;
      f.position.set(0, t.y, t.z); f.scale.setScalar(Math.max(t.s, 0.001)); f.rotation.set(t.a, Math.PI, 0, 'XYZ'); }
    const k = 1 - Math.exp(-dt * 6);
    viewQ.slerp(targetQ, k); pivot.quaternion.copy(viewQ);
    { const tgt = BONE_ALPHA[viewName] ?? 0.74, u = M.bone.userData.u.uAlpha; u.value += (tgt - u.value) * (1 - Math.exp(-dt * 5)); }
    SHARED.uClipD.value += (cutT - SHARED.uClipD.value) * (1 - Math.exp(-dt * 5));
    if (Math.abs(SHARED.uClipD.value - cutT) < 0.02) SHARED.uClipD.value = cutT;
    { const kf = 1 - Math.exp(-dt * 5), c = frame.cur, t = frame.tgt; c.y += (t.y - c.y) * kf; c.z += (t.z - c.z) * kf; c.zoom += (t.zoom - c.zoom) * kf;
      anatomy.position.set(0, -c.y * SCALE, -c.z * SCALE); pivot.scale.setScalar(c.zoom); }
    root.updateWorldMatrix(true, true);
    SHARED.uAnatInv.value.copy(anatomy.matrixWorld).invert();
    SHARED.uTime.value += dt;
    // pressure arrows follow the wave
    const a = extras && extras.waveAmp > 0.03;
    arrowHead.visible = arrowShaft.visible = !!a;
    if (a) {
      arrowMat.opacity = Math.min(0.9, extras.waveAmp);
      for (let i = 0; i < NARR; i++) {
        const x = (i - 2) * 2.5, z = 0.5 - Math.abs(i - 2) * 0.5;
        dummy.rotation.set(Math.PI, 0, 0); dummy.scale.set(1, 1, 1);
        dummy.position.set(x, extras.wave + 1.3, z); dummy.updateMatrix(); arrowHead.setMatrixAt(i, dummy.matrix);
        dummy.rotation.set(0, 0, 0); dummy.position.set(x, extras.wave + 3.4, z); dummy.updateMatrix(); arrowShaft.setMatrixAt(i, dummy.matrix);
      }
      arrowHead.instanceMatrix.needsUpdate = arrowShaft.instanceMatrix.needsUpdate = true;
    }
  }

  const _v = new THREE.Vector3();
  function anchorLocal(id) {
    const a = anchors[id]; if (!a) return null;
    const w = warpPoint(a.kind, a.p, a.pf, a.axis || a.p, F, a.tube || { k: 0, w: 0 }, !a.nopush);
    const o = a.off || [0, 0, 0];
    return [w[0] + o[0], w[1] + o[1], w[2] + o[2]];
  }
  function projectAnchor(id, camera, out = new THREE.Vector3()) {
    const l = anchorLocal(id); if (!l) return null;
    out.set(l[0], l[1], l[2]).applyMatrix4(anatomy.matrixWorld).project(camera);
    return out;
  }
  function pinVisible(id) {
    if (ORGANS.includes(id) && organMode === 'hide') return false;
    if (id === 'fascia' && !fasciaOn) return false;
    return !(PIN_HIDE[viewName] || []).includes(id);
  }
  function isVisible() { let o = root; while (o) { if (!o.visible) return false; o = o.parent; } return true; }

  function leak(count) {
    const m = warpPoint(4, [0, -3.9, 4.25], [0.55, 0, 0], [0, -3.9, 4.25], F, { k: 0.55, w: 0.15, u: 0.5 });
    for (let i = 0; i < NDROP; i++) {
      const d = dropState[i];
      if (i < count) { d.t = 0; d.delay = i * 0.17; d.x = (Math.random() - 0.5) * 0.3; d.y = m[1]; d.z = m[2]; d.vx = (Math.random() - 0.5) * 0.5; d.vy = -2 - Math.random(); d.vz = 2.0 + Math.random() * 1.2; }
      else d.t = -1;
    }
  }
  function updateDrops(dt) {
    let n = 0;
    for (let i = 0; i < NDROP; i++) {
      const d = dropState[i]; if (d.t < 0) continue;
      d.t += dt;
      const tt = d.t - d.delay; if (tt < 0) continue;
      if (tt > 1.7) { d.t = -1; continue; }
      const y = d.y + d.vy * tt - 0.5 * 24 * tt * tt, z = d.z + d.vz * tt, x = d.x + d.vx * tt;
      dummy.rotation.set(0, 0, 0); dummy.position.set(x, y, z); dummy.scale.set(1, 1.3, 1); dummy.updateMatrix(); drops.setMatrixAt(n++, dummy.matrix);
    }
    drops.count = n; drops.instanceMatrix.needsUpdate = true;
  }

  /** Select a part: it glows, everything else dims. null clears. */
  function setSelected(id) {
    selected = id;
    const all = [...new Set([...Object.values(mats), ...Object.values(M.caps), M.head, M.fetus])];
    const keep = new Set(id ? [mats[id], ...(matCaps[id] || []).map((c) => M.caps[c])] : []);
    for (const m of all) { const u = m.userData.u; u.uDim.value = id && !keep.has(m) ? 0.62 : 0; u.uGlow.value = id && keep.has(m) ? 1 : 0; }
  }
  function setFasciaVisible(v) { fasciaOn = v; meshes.fascia.visible = v; }
  function dispose() { anatomy.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); prepass.dispose(); }
  const setGlow = (id, v) => { if (!id) setSelected(null); else setSelected(id); };

  return { root, pivot, anatomy, lights, meshes, capMeshes, mats, anchors, setView, setFraming, applyState, projectAnchor, anchorLocal, isVisible, leak, updateDrops,
    setSelected, setGlow, setFasciaVisible, setOrganMode, pinVisible, dispose, capOf,
    get fields() { return F; }, get viewName() { return viewName; }, get organMode() { return organMode; }, get selected() { return selected; } };
}
