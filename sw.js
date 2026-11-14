// Service worker: one complete, versioned copy of the site per release.
// - Install downloads EVERY file below into a new cache and fails if any is missing, so a release is never half-cached.
// - Precached files are then served only from that cache (no per-file background refresh), so old and new files never mix.
// - A new release waits until the page asks for it (sw-register.js does so before the visitor has started) or until
//   every tab is closed. Bump CACHE_VERSION on EVERY deploy that changes a listed file.
const CACHE_VERSION = 'v3';
const CACHE = `pelvic-floor-ar-${CACHE_VERSION}`;
const BASE = new URL('./', self.registration.scope); // works under any subpath

const PRECACHE = [
  'index.html', 'viewer.html', 'styles.css', 'sw-register.js', 'src/ar.css', 'src/ar.js',
  'src/scenes.js', 'src/ui.js', 'src/viewer.js', 'src/content.js',
  'src/anatomy/model.js', 'src/anatomy/parts.js', 'src/anatomy/geom.js', 'src/anatomy/materials.js', 'src/anatomy/warp.js',
  'src/anatomy/noise.js', 'src/anatomy/bones.js', 'src/anatomy/bones.bin', 'src/anatomy/fetus.bin',
  'markers/targets.mind',
  'vendor/three/three.module.js',
  'vendor/three/addons/renderers/CSS3DRenderer.js',
  'vendor/three/addons/controls/OrbitControls.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js',
  'vendor/mindar/mindar-image-three.prod.js',
  'vendor/mindar/controller-mGt1s8dJ.js',
  'vendor/mindar/ui-fBadYuor.js',
];
const url = (p) => new URL(p, BASE).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async (p) => {
      const res = await fetch(url(p), { cache: 'reload' });
      if (!res.ok) throw new Error(`precache ${p}: ${res.status}`);
      await cache.put(url(p), res);
    }));
    // First ever install: nothing older to clash with, so take over straight away.
    if (!self.registration.active) await self.skipWaiting();
  })().catch(async (e) => { await caches.delete(CACHE); throw e; }));
});

self.addEventListener('message', (event) => { if (event.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('pelvic-floor-ar-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin || !u.pathname.startsWith(BASE.pathname)) return;
  let rel = u.pathname.slice(BASE.pathname.length); // query string ignored for routing
  if (rel === '') rel = 'index.html';
  if (!PRECACHE.includes(rel)) return;              // everything else: plain network
  event.respondWith((async () => {
    const hit = await (await caches.open(CACHE)).match(url(rel));
    return hit || fetch(req);
  })());
});
