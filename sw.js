// Service worker: precache shell + vendor + targets (cache-first), network-first for everything else.
// Bump CACHE_VERSION whenever deployed files change so old caches are dropped.
const CACHE_VERSION = 'v2';
const CACHE = `pelvic-floor-ar-${CACHE_VERSION}`;
const BASE = new URL('./', self.registration.scope); // works under any subpath

// Immutable-ish heavy files: pure cache-first.
const STATIC = [
  'markers/targets.mind',
  'vendor/three/three.module.js',
  'vendor/three/addons/renderers/CSS3DRenderer.js',
  'vendor/three/addons/controls/OrbitControls.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js',
  'vendor/mindar/mindar-image-three.prod.js',
  'vendor/mindar/controller-mGt1s8dJ.js',
  'vendor/mindar/ui-fBadYuor.js',
];
// App shell: served from cache, refreshed in the background (so a deploy shows up on the next visit).
const SHELL = [
  './', 'index.html', 'viewer.html', 'styles.css', 'src/ar.css', 'src/ar.js',
  'src/scenes.js', 'src/ui.js', 'src/viewer.js', 'src/content.js',
  'src/anatomy/model.js', 'src/anatomy/parts.js', 'src/anatomy/geom.js', 'src/anatomy/materials.js', 'src/anatomy/warp.js',
  'src/anatomy/noise.js', 'src/anatomy/bones.js', 'src/anatomy/bones.bin', 'src/anatomy/fetus.bin',
];
const url = (p) => new URL(p, BASE).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Tolerant: a file that does not exist (yet) must not fail the install.
    await Promise.allSettled([...STATIC, ...SHELL].map(async (p) => {
      const res = await fetch(url(p), { cache: 'reload' });
      if (res.ok) await cache.put(url(p), res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('pelvic-floor-ar-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin || !u.pathname.startsWith(BASE.pathname)) return;
  const rel = u.pathname.slice(BASE.pathname.length); // query string ignored for routing
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (STATIC.includes(rel)) {
      const hit = await cache.match(url(rel));
      if (hit) return hit;
      return networkFirst(req);
    }
    if (SHELL.includes(rel) || rel === '') {
      const hit = await cache.match(rel === '' ? url('index.html') : url(rel), { ignoreSearch: rel === '' || rel === 'index.html' || rel === 'viewer.html' });
      const refresh = fetch(req).then((res) => { if (res.ok && res.type === 'basic') cache.put(rel === '' ? url('index.html') : url(rel), res.clone()); return res; });
      if (hit) { refresh.catch(() => {}); return hit; }
      return refresh;
    }
    return networkFirst(req);
  })());
});
