// sw.js — Service Worker for Homework Tracker PWA
//
// Cache-first with a network fallback, plus a navigation fallback so a cold
// offline start still loads the app shell.
//
// NOTE: bump CACHE_NAME whenever a cached asset changes, otherwise returning
// visitors keep the old copy. `skipWaiting()` + `clients.claim()` let the new
// worker activate immediately; app.js still toasts to prompt a refresh so the
// in-memory state is rebuilt from the new scripts.

var CACHE_NAME = 'hw-tracker-v11';

// Core shell entries. JS/CSS bundles built by Vite are hashed, so they are
// cached on demand by the fetch handler (stale-while-revalidate) instead of
// being listed here.
var APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Third-party assets the app needs in order to run fully offline. The only
// external dependency left is the Google Fonts stylesheet — everything else
// is same-origin. Cached best-effort.
var CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Manrope:wght@300;400;500;600;700&display=swap',
];

// Only these origins are served through the cache. Everything else (and every
// non-GET request) falls through to the browser untouched.
function isCacheable(url) {
  return (
    url.origin === self.location.origin ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  );
}

// ── Install: pre-cache the shell + CDN deps, then activate immediately ──
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Fetch each entry independently: a single flaky asset must not reject
      // the whole install the way cache.addAll() would.
      var pending = APP_SHELL.concat(CDN_ASSETS).map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function (err) {
          console.warn('[sw] could not precache', url, err);
        });
      });
      return Promise.all(pending);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// ── Activate: drop stale caches and take over open pages ──
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ── Fetch ──
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (!isCacheable(url)) return;

  // Page navigations: prefer the network, fall back to the cached shell so an
  // offline cold start still renders the app instead of the browser error page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME)
          .then(function (cache) { return cache.put('/index.html', copy); })
          .catch(function () {});
        return response;
      }).catch(function () {
        return caches.match('/index.html').then(function (cached) {
          return cached || caches.match('/');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;

      return fetch(request).then(function (response) {
        // Cache successful same-origin and CORS responses. Opaque (no-cors)
        // responses would make cache.put() reject, so skip those.
        if (response && response.status === 200 && response.type !== 'opaque') {
          var copy = response.clone();
          caches.open(CACHE_NAME)
            .then(function (cache) { return cache.put(request, copy); })
            .catch(function () {});
        }
        return response;
      });
    })
  );
});
