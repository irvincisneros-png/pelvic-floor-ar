// Standalone orbit viewer: the same experience object the AR page uses, without a camera feed.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createExperience, SCENE_IDS } from './scenes.js';

const stage = document.getElementById('stage');
const uiRoot = document.getElementById('ui-root');
const tabsEl = document.getElementById('tabs');
const params = new URLSearchParams(location.search);

function sorry(msg) {
  document.body.insertAdjacentHTML('beforeend', `<p role="alert" style="position:fixed;top:72px;left:16px;right:16px;color:#fff;font:16px/1.4 system-ui,sans-serif">${msg}</p>`);
}
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 not available');
} catch (e) {
  console.error(e);
  sorry('Sorry, this browser cannot show the 3D model. Try updating your phone, or open this page in a current version of Safari or Chrome.');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 40);
const TARGET = new THREE.Vector3(0, 0.34, 0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TARGET); controls.enablePan = true; controls.screenSpacePanning = true; controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 0.9; controls.maxDistance = 7; controls.rotateSpeed = 0.8;

let exp = null, userMoved = false, layout = { bottom: 0, top: 0 };
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
// distance that fits the model (radius R) in the area left above the sheet
function dist() {
  const W = innerWidth, H = innerHeight, hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const avail = Math.max(240, H - layout.bottom - layout.top - 52);
  const R = 0.56;
  return clamp(Math.max(R / (hh * (W / H)), R / (hh * (avail / H))), 1.6, 6.5);
}
function homeCamera() {
  const d = dist();
  camera.position.set(0, TARGET.y + d * 0.02, d); controls.target.copy(TARGET); camera.lookAt(TARGET); controls.update(); userMoved = false;
}
function applyOffset() {
  const W = innerWidth, H = innerHeight;
  const shift = (layout.bottom - layout.top - 52) / 2;
  camera.setViewOffset(W, H, 0, Math.round(shift), W, H);
}
function resize() {
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
  applyOffset(); if (!userMoved) homeCamera();
}
controls.addEventListener('start', () => { userMoved = true; });
window.addEventListener('resize', resize);

// tap on the canvas (not a drag) -> label hit-test
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || !exp) return;
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
    const r = renderer.domElement.getBoundingClientRect();
    exp.onPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  }
  down = null;
});

const TAB = { before: '1 Meet it', pregnancy: '2 Pregnancy', birth: '3 Birth', solutions: '4 Train' };
function buildTabs() {
  for (const id of SCENE_IDS) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = TAB[id]; b.dataset.id = id;
    b.addEventListener('click', () => go(id));
    tabsEl.appendChild(b);
  }
}
function go(id) {
  exp.setScene(id);
  for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.id === id);
  const u = new URL(location.href); u.searchParams.set('scene', id); history.replaceState(null, '', u);
  homeCamera();
}

async function main() {
  buildTabs();
  exp = await createExperience({ uiRoot, camera, domElement: renderer.domElement });
  scene.add(exp.root, exp.lights);
  exp.onLayoutChange = (l) => { layout = l; applyOffset(); if (!userMoved) homeCamera(); };
  exp.onViewPreset = () => homeCamera();
  resize();
  const first = SCENE_IDS.includes(params.get('scene')) ? params.get('scene') : 'before';
  go(first);
  if (params.get('notice') === 'camera') exp.debug.ui.sayToast('Camera not available, so here is the 3D viewer instead.', 6000);
  window.__pf = { exp, renderer, scene, camera, controls };
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    controls.update();
    exp.update(clock.getDelta());
    renderer.render(scene, camera);
    window.__pf.info = { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls };
  });
}
main().catch((e) => { console.error(e); sorry('Sorry, the 3D viewer could not start on this device.'); });
