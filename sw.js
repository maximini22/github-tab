/* Retired. Up to v3 the app lived at the site root and registered this worker for the whole site.
 * The app now lives at /app/ (with its own worker, app/sw.js) and the root is a plain page.
 * This version removes the old root worker and its old caches, then reloads any root page it controlled
 * so visitors see the current front page. Your saved projects (localStorage) are not touched. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return /^guitar-tab-v[123]$/.test(k); }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.registration.unregister(); })
    .then(function () { return self.clients.matchAll({ type: 'window' }); })
    .then(function (list) {
      list.forEach(function (c) { if (c.url.indexOf('/app/') < 0 && c.navigate) c.navigate(c.url); });
    }));
});
