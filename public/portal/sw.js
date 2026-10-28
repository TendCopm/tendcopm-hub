/* TendCo Hub service worker. Cache name includes the portal version. */
var CACHE = 'tendco-hub-20261027residential1';

var SHELL = [
  '/portal/app.html',
  '/portal/index.html',
  '/portal/manifest.webmanifest',
  '/portal/assets/portal.css',
  '/portal/assets/app.js',
  '/portal/assets/houses.js',
  '/portal/assets/pwa.js',
  '/portal/assets/tendy.js',
  '/portal/assets/TendCo-T-Mark-TM.svg',
  '/portal/assets/TendCo-Wordmark-TM.svg',
  '/portal/assets/icons/icon-192.png',
  '/portal/assets/icons/icon-512.png',
  '/portal/assets/icons/apple-touch-icon.png',
  '/portal/assets/vendor/leaflet/leaflet.css',
  '/portal/assets/vendor/leaflet/leaflet.js',
  '/portal/assets/vendor/leaflet/images/layers.png',
  '/portal/assets/vendor/leaflet/images/layers-2x.png',
  '/portal/assets/vendor/leaflet/images/marker-icon.png',
  '/portal/assets/vendor/leaflet/images/marker-icon-2x.png',
  '/portal/assets/vendor/leaflet/images/marker-shadow.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/portal/api') === 0) return;
  if (url.pathname === '/portal/assets/maps-config.js') return;

  event.respondWith((async function () {
    try {
      var res = await fetch(req);
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        var cache = await caches.open(CACHE);
        cache.put(req, copy);
      }
      return res;
    } catch (err) {
      var cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        var shell = await caches.match('/portal/app.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
