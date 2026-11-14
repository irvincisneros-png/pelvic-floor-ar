// Registers the service worker and applies a waiting update only while it is safe: before the visitor has started.
// Classic script (not a module) so the shell still gets cached if the module graph fails.
(function () {
  if (!('serviceWorker' in navigator)) return;
  var q = new URLSearchParams(location.search);
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (local && q.get('sw') !== '1') return;
  var hadController = !!navigator.serviceWorker.controller;
  var touched = false, asked = false;
  window.addEventListener('pointerdown', function () { touched = true; }, { capture: true, once: true });
  function apply(worker) {
    if (!worker || !hadController || touched || asked) return; // mid-session: the update waits for the next visit
    asked = true; worker.postMessage('skipWaiting');
  }
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (asked) location.reload(); });
  navigator.serviceWorker.register('sw.js').then(function (reg) {
    if (reg.waiting) apply(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var w = reg.installing; if (!w) return;
      w.addEventListener('statechange', function () { if (w.state === 'installed') apply(reg.waiting || w); });
    });
  }).catch(function () {});
})();
