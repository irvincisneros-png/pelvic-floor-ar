// AR layer: MindAR image tracking (4 targets) + the Three.js experience from src/scenes.js.
// Anchor space (verified in vendor/mindar controller + three wrapper): 1 unit = target width, origin = target centre,
// the sheet lies in the XY plane (x right, y up the printed art), +Z points out of the paper toward the viewer.
import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const STUB = params.get('stub') === '1';
const GRACE_MS = 400;        // hold last pose after tracking is lost
const MODEL_FRACTION = 0.8;  // model width as a fraction of sheet width
const FROZEN_FRACTION = 0.8; // model width as a fraction of screen width when frozen
const TARGETS_URL = new URL('../markers/targets.mind', import.meta.url).href;
const VIEWER_FALLBACK = 'viewer.html?notice=camera';

window.__arBooted = true;

// ---------- in-app browser detection ----------
const IN_APP = /Instagram|FBAN|FBAV|MicroMessenger|Line\/|TikTok|musical_ly|BytedanceWebview/i.test(navigator.userAgent) || params.get('inapp') === '1';

function setupInAppOverlay() {
  const overlay = $('inapp');
  overlay.hidden = false;
  const link = location.origin + location.pathname;
  $('copy-link').addEventListener('click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(link); ok = true; } catch (e) { /* fall back below */ }
    if (!ok) {
      try {
        const ta = document.createElement('textarea'); ta.value = link; ta.style.cssText = 'position:fixed;top:0;opacity:0';
        document.body.appendChild(ta); ta.focus(); ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch (e) { ok = false; }
    }
    $('copy-state').textContent = ok ? 'Link copied. Paste it into Safari or Chrome.' : link;
  });
  $('inapp-try').addEventListener('click', () => { overlay.hidden = true; });
}
if (IN_APP) setupInAppOverlay();

// ---------- failure handling ----------
let failed = false;
function fail(err) {
  if (failed) return;
  failed = true;
  console.warn('AR failed, falling back to viewer:', err);
  try { releaseWakeLock(); } catch (e) { /* ignore */ }
  if (!params.get('nofallback')) location.replace(VIEWER_FALLBACK);
}
window.addEventListener('unhandledrejection', (e) => { if (started) fail(e.reason); });

// Coming back through the back-forward cache (after opening a source link, say) restores a page whose camera was
// stopped on pagehide. Reload so the visitor gets a working Start button instead of a dead view.
window.addEventListener('pageshow', (e) => { if (e.persisted && started) location.reload(); });

// ---------- wake lock ----------
let wakeLock = null;
async function requestWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* not critical */ }
}
function releaseWakeLock() { try { wakeLock && wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && started) requestWakeLock(); });

// ---------- experience module (preloaded while the intro is shown) ----------
let started = false;
let mod = null;
const modPromise = (async () => {
  mod = await import(STUB ? '../tools/stub-experience.js' : './scenes.js');
  if (!Array.isArray(mod.SCENE_IDS) || typeof mod.createExperience !== 'function') throw new Error('scenes.js interface missing');
})();
modPromise.then(() => {
  const b = $('start'); b.disabled = false; b.textContent = 'Start AR';
}).catch(fail);

// ---------- start (must run inside the tap handler) ----------
$('start').addEventListener('click', () => {
  if (started || !mod) return;
  started = true;
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no getUserMedia');
    // MindARThree.start() calls getUserMedia synchronously, so the camera request happens inside this user gesture.
    const mindar = new MindARThree({
      container: $('ar-stage'),
      imageTargetSrc: TARGETS_URL,
      maxTrack: 1,
      uiLoading: 'no', uiScanning: 'no', uiError: 'no',
      filterMinCF: 0.0005, filterBeta: 500, warmupTolerance: 3, missTolerance: 8,
    });
    if (!mindar.renderer.capabilities.isWebGL2) throw new Error('WebGL2 not available');
    mindar.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const startPromise = mindar.start();
    $('starting').hidden = false;
    run(mindar, startPromise).catch(fail);
  } catch (e) { fail(e); }
});

async function run(mindar, startPromise) {
  const { SCENE_IDS, createExperience } = mod;
  const { renderer, scene, camera } = mindar;
  const uiRoot = $('ui-root');

  // Experience + camera start in parallel
  const [experience] = await Promise.all([
    createExperience({ uiRoot, camera, domElement: renderer.domElement }),
    startPromise.catch((e) => { throw e || new Error('camera failed'); }),
  ]);

  // holder (pose) > placer (orientation + scale) > experience.root
  const holder = new THREE.Group();
  holder.matrixAutoUpdate = false;
  holder.visible = false;
  const placer = new THREE.Group();
  holder.add(placer);
  placer.add(experience.root);
  scene.add(holder);
  if (experience.lights) scene.add(experience.lights);

  const TRACK_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); // root up (+Y) -> sheet normal (+Z)
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  let tilt = 0;                // 0 = standing on the sheet, PI/2 = lying on the page facing up
  function placeForTracking() { placer.quaternion.setFromAxisAngle(X_AXIS, Math.PI / 2 - tilt); placer.scale.setScalar(MODEL_FRACTION); placer.position.set(0, 0, 0); }
  function placeForFrozen() { placer.quaternion.identity(); placer.scale.setScalar(MODEL_FRACTION); placer.position.set(0, 0, 0); }
  placeForTracking();

  // state
  let currentScene = -1;      // index of the scene shown
  let trackedIndex = -1;      // index of the anchor currently tracked (or last tracked while in grace)
  let frozen = false;
  let lostTimer = 0;
  let lastDistance = 0;       // camera distance of the model when last tracked (world units)
  const hint = $('hint');
  const freezeBtn = $('freeze');

  function showHint(on) { hint.classList.toggle('off', !on); }

  function showScene(i) {
    if (i === currentScene) return;
    currentScene = i;
    experience.setScene(SCENE_IDS[i]);
  }

  // anchors
  const anchors = [];
  for (let i = 0; i < SCENE_IDS.length; i++) {
    const a = mindar.addAnchor(i);
    a.onTargetFound = () => {
      if (frozen) return;
      clearTimeout(lostTimer);
      trackedIndex = i;
      showScene(i);
      showHint(false);
    };
    a.onTargetLost = () => {
      if (frozen || trackedIndex !== i) return;
      clearTimeout(lostTimer);
      lostTimer = setTimeout(() => { if (!frozen && trackedIndex === i) { holder.visible = false; showHint(true); } }, GRACE_MS);
    };
    anchors.push(a);
  }

  // ---------- freeze ----------
  const frozenQ = new THREE.Quaternion();
  let frozenZoom = 1, frozenDist = 1, frozenBase = 1, frozenY = 0;
  const TOP_INSET = 56; // px reserved for the AR bar; mirrored by --pf-top-inset in ar.css
  const tmp = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

  // Centre the frozen model in the free area between the AR bar / experience header and the bottom sheet.
  function layoutFrozen() {
    const H = window.innerHeight, W = window.innerWidth;
    const lay = experience.layout || {};
    const topPx = TOP_INSET + (lay.top || 0), botPx = lay.bottom || 0;
    const freeH = Math.max(120, H - topPx - botPx);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const worldPerPx = (2 * frozenDist * tanHalf) / H;   // vertical world units per CSS pixel at the model's distance
    const sizePx = Math.min(W * FROZEN_FRACTION, freeH * 0.85);
    frozenBase = (sizePx * worldPerPx) / MODEL_FRACTION;  // holder scale: model width = sizePx on screen
    const centreY = topPx + freeH / 2;                    // px from top
    frozenY = (H / 2 - centreY) * worldPerPx;
  }
  const prevLayoutHook = experience.onLayoutChange;
  experience.onLayoutChange = (l) => { if (typeof prevLayoutHook === 'function') prevLayoutHook(l); if (frozen) layoutFrozen(); };
  window.addEventListener('resize', () => { if (frozen) layoutFrozen(); });

  function setFrozen(on) {
    if (on === frozen) return;
    frozen = on;
    freezeBtn.setAttribute('aria-pressed', String(on));
    freezeBtn.textContent = on ? 'Unfreeze' : 'Freeze';
    clearTimeout(lostTimer);
    if (on) {
      if (currentScene < 0) showScene(0);
      // distance in world units: reuse the tracked distance (so the model does not jump), else a point inside the frustum
      const near = camera.near, far = camera.far;
      frozenDist = lastDistance > near * 2 && lastDistance < far * 0.9 ? lastDistance : Math.min(Math.max(near * 20, (near + far) / 50), far * 0.5);
      layoutFrozen();
      frozenZoom = 1;
      frozenQ.setFromEuler(new THREE.Euler(-0.35, 0, 0)); // gentle look-down so the model reads as 3D
      placeForFrozen();
      showHint(false);
      holder.visible = true;
    } else {
      placeForTracking();
      holder.visible = false;
      // adopt whichever sheet is in view right now, else prompt
      const live = anchors.findIndex((a) => a.group.visible);
      if (live >= 0) { trackedIndex = live; showScene(live); showHint(false); } else { trackedIndex = -1; showHint(true); }
    }
  }
  freezeBtn.addEventListener('click', () => setFrozen(!frozen));

  // ---------- touch: tap -> labels, drag -> rotate (frozen), pinch -> zoom (frozen) ----------
  const stage = $('ar-stage');
  const pointers = new Map();
  let gesture = null;
  const rotY = new THREE.Quaternion(), rotX = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
  function forwardTap(clientX, clientY) {
    if (!experience.onPointer) return;
    const r = stage.getBoundingClientRect();
    try { experience.onPointer(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1)); } catch (e) { console.warn('onPointer failed', e); }
  }
  stage.addEventListener('pointerdown', (e) => {
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already-released pointer */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture = { moved: pointers.size > 1, t: performance.now(), sx: e.clientX, sy: e.clientY, pinch: pointers.size === 2 ? dist2() : 0, zoom0: frozenZoom };
    if (pointers.size === 2) { gesture.pinch = dist2(); gesture.zoom0 = frozenZoom; gesture.moved = true; }
  });
  stage.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (gesture && Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > 8) gesture.moved = true;
    if (!frozen) return;
    if (pointers.size >= 2 && gesture && gesture.pinch > 0) {
      frozenZoom = THREE.MathUtils.clamp(gesture.zoom0 * (dist2() / gesture.pinch), 0.4, 3);
    } else if (pointers.size === 1) {
      rotY.setFromAxisAngle(AY, dx * 0.008); rotX.setFromAxisAngle(AX, dy * 0.008);
      frozenQ.premultiply(rotY).premultiply(rotX);
    }
  });
  function endPointer(e, cancelled) {
    if (!pointers.has(e.pointerId)) return;
    const wasTap = gesture && !gesture.moved && pointers.size === 1 && performance.now() - gesture.t < 500 && !cancelled;
    pointers.delete(e.pointerId);
    if (pointers.size < 2 && gesture) { gesture.pinch = 0; }
    if (wasTap) forwardTap(e.clientX, e.clientY);
    if (pointers.size === 0) gesture = null;
  }
  stage.addEventListener('pointerup', (e) => endPointer(e, false));
  stage.addEventListener('pointercancel', (e) => endPointer(e, true));
  function dist2() { const v = [...pointers.values()]; return v.length < 2 ? 0 : Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y); }

  // ---------- render loop ----------
  const clock = new THREE.Clock();
  const frameMs = []; // CPU time of experience.update + render per frame (rough, headless indicator)
  const gaps = []; let lastFrameAt = 0, quality = 2, qualityAt = performance.now();
  renderer.setAnimationLoop(() => {
    const f0 = performance.now();
    const dt = Math.min(clock.getDelta(), 0.1);
    if (frozen) {
      tmpV.set(0, frozenY, -frozenDist);
      tmpS.setScalar(frozenBase * frozenZoom);
      holder.matrix.compose(tmpV, frozenQ, tmpS);
    } else {
      const a = anchors[trackedIndex];
      if (a && a.group.visible) {
        holder.matrix.copy(a.group.matrix); // anchor-space pose; kept as-is during the grace period
        holder.visible = true;
        tmpV.setFromMatrixPosition(holder.matrix);
        lastDistance = tmpV.length();
        // Adaptive tilt: seen from the side the model stands on the paper; hovering straight above, it lies back
        // on the page so the viewer still looks at its front rather than down on top of it.
        const e = holder.matrix.elements, L = lastDistance || 1;
        const cn = -(tmpV.x * e[8] + tmpV.y * e[9] + tmpV.z * e[10]) / (L * Math.hypot(e[8], e[9], e[10])); // camera direction along the sheet normal
        const elev = Math.asin(Math.min(1, Math.abs(cn)));               // height above the sheet plane, whichever edge the viewer stands at: 0 = level, PI/2 = straight above
        const want = THREE.MathUtils.smoothstep(elev, 0.52, 1.36) * (Math.PI / 2);
        tilt += (want - tilt) * (1 - Math.exp(-dt * 5));
        placer.quaternion.setFromAxisAngle(X_AXIS, Math.PI / 2 - tilt);
        placer.position.set(0, -0.34 * MODEL_FRACTION * Math.sin(tilt), 0.02 * Math.sin(tilt));
      }
    }
    holder.matrixWorldNeedsUpdate = true;
    try { experience.update(dt); } catch (e) { console.warn('experience.update', e); }
    renderer.render(scene, camera);
    frameMs.push(performance.now() - f0); if (frameMs.length > 120) frameMs.shift();
    // Adaptive quality: if the phone cannot keep up (tracker + model share the GPU), render at a lower pixel ratio.
    const now = performance.now();
    if (lastFrameAt) { gaps.push(now - lastFrameAt); if (gaps.length > 90) gaps.shift(); }
    lastFrameAt = now;
    if (gaps.length === 90 && quality > 0 && now - qualityAt > 4000) {
      const sorted = [...gaps].sort((x, y) => x - y), median = sorted[45];
      if (median > 36) { quality--; qualityAt = now; gaps.length = 0; renderer.setPixelRatio(quality === 1 ? Math.min(window.devicePixelRatio || 1, 1.15) : 0.85); }
    }
  });

  // ---------- ready ----------
  $('starting').hidden = true;
  $('intro').hidden = true;
  $('ar-chrome').hidden = false;
  showHint(true);
  requestWakeLock();
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('portrait').catch(() => {}); } catch (e) { /* needs fullscreen on most browsers */ }
  window.addEventListener('pagehide', () => { try { mindar.stop(); } catch (e) { /* ignore */ } releaseWakeLock(); });
  // The camera stream can be ended by the browser (another app took it, permission revoked): start again cleanly.
  try { for (const t of (mindar.video && mindar.video.srcObject ? mindar.video.srcObject.getVideoTracks() : [])) t.addEventListener('ended', () => { if (document.visibilityState === 'visible') location.reload(); }); } catch (e) { /* ignore */ }

  // read-only state for tests/debugging
  window.__arState = () => ({
    scene: currentScene, sceneId: SCENE_IDS[currentScene] || null, tracked: trackedIndex, frozen,
    visible: holder.visible, hint: !hint.classList.contains('off'),
    anchorVisible: anchors.map((a) => a.group.visible), matrix: holder.matrix.elements.slice(),
    camera: { fov: camera.fov, aspect: camera.aspect, near: camera.near, far: camera.far }, lastDistance,
    frozenDist, frozenBase, frozenZoom, frozenY, frozenQ: frozenQ.toArray(),
    frameMs: frameMs.length ? frameMs.reduce((a, b) => a + b, 0) / frameMs.length : 0,
    info: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: (renderer.info.programs || []).length },
  });
  window.__ar = { THREE, renderer, mindar, holder, placer, experience, camera, scene, setFrozen };
}
