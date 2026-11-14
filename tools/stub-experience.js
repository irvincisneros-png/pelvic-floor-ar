// Stand-in for src/scenes.js, used only when index.html is opened with ?stub=1.
// Obeys the same interface and unit-box convention: root is y-up, sits on its XZ plane, ~1 unit wide, centred at origin.
import * as THREE from 'three';

export const SCENE_IDS = ['before', 'pregnancy', 'birth', 'solutions'];
const COLOURS = { before: 0x2fb5b0, pregnancy: 0xe0457f, birth: 0xf09a2c, solutions: 0x58c26a };
const NAMES = { before: '1 BEFORE', pregnancy: '2 PREGNANCY', birth: '3 BIRTH', solutions: '4 SOLUTIONS' };

function labelTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function createExperience({ uiRoot, camera, domElement }) {
  const root = new THREE.Group();
  root.name = 'stub-root';
  const lights = new THREE.Group();
  lights.add(new THREE.AmbientLight(0xffffff, 1.2));
  const dir = new THREE.DirectionalLight(0xffffff, 2.2); dir.position.set(0.5, 1.5, 1); lights.add(dir);

  const mat = new THREE.MeshStandardMaterial({ color: 0x2fb5b0, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.7), mat);
  body.position.y = 0.3; root.add(body);
  body.add(new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: 0x000000 })));
  // +Y marker (UP) and +Z marker (FRONT)
  const up = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  up.position.set(0, 0.75, 0); root.add(up);
  const front = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff2020 }));
  front.position.set(0, 0.3, 0.4); root.add(front);
  const right = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ color: 0x2060ff }));
  right.position.set(0.55, 0.3, 0); root.add(right);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture('...'), depthTest: false }));
  sprite.scale.set(0.8, 0.2, 1); sprite.position.set(0, 0.45, 0.45); root.add(sprite);

  // HTML overlay: bottom sheet + one projected label (exercises projection + tap forwarding)
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:absolute;left:0;right:0;bottom:0;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:rgba(15,20,25,.88);color:#fff;font:16px/1.3 system-ui,sans-serif;pointer-events:auto;border-radius:16px 16px 0 0';
  const title = document.createElement('div'); title.style.cssText = 'font-weight:700;font-size:18px';
  const note = document.createElement('div'); note.textContent = 'STUB experience (not the real model)'; note.style.opacity = '.75';
  const btn = document.createElement('button'); btn.textContent = 'Spin test'; btn.style.cssText = 'margin-top:8px;min-height:44px;padding:0 16px;border-radius:10px;border:0;font:inherit';
  let spin = false; btn.addEventListener('click', () => { spin = !spin; });
  sheet.append(title, note, btn); uiRoot.appendChild(sheet);
  const label = document.createElement('div');
  label.textContent = 'label';
  label.style.cssText = 'position:absolute;left:0;top:0;padding:6px 10px;border-radius:12px;background:#fff;color:#000;font:14px system-ui;pointer-events:auto;transform:translate(-50%,-50%)';
  let labelTaps = 0; label.addEventListener('click', () => { labelTaps++; label.textContent = 'tapped ' + labelTaps; });
  uiRoot.appendChild(label);

  const ray = new THREE.Raycaster(); const v = new THREE.Vector3();
  let id = null;
  const exp = {
    root, lights, id: () => id, taps: 0,
    setScene(next) {
      id = next; mat.color.setHex(COLOURS[next]);
      sprite.material.map = labelTexture(NAMES[next]); sprite.material.needsUpdate = true;
      title.textContent = NAMES[next]; root.rotation.y = 0; exp.setSceneCalls = (exp.setSceneCalls || 0) + 1;
    },
    update(dt) {
      if (spin) root.rotation.y += dt;
      root.updateWorldMatrix(true, false);
      v.set(0, 0.95, 0).applyMatrix4(root.matrixWorld).project(camera);
      const w = domElement.clientWidth, h = domElement.clientHeight;
      const vis = v.z < 1 && root.parent && root.parent.visible !== false && root.visible;
      label.style.display = vis ? '' : 'none';
      label.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px,${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%,-50%)`;
    },
    onPointer(x, y) {
      ray.setFromCamera({ x, y }, camera);
      if (ray.intersectObject(body, false).length) { exp.taps++; window.__stubTaps = exp.taps; return true; }
      return false;
    },
    dispose() { sheet.remove(); label.remove(); },
  };
  window.__stubExp = exp;
  return exp;
}
