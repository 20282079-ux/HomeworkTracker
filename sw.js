// sw.js — Service Worker for Homework Tracker PWA
// Cache-first strategy: serve from cache, fall back to network.
// Pre-caches all static assets on install, cleans old caches on activate.
//
// NOTE: skipWaiting() is called so SW updates activate immediately
// (no need to close all tabs). The app.js updatefound listener still
// shows a toast to prompt a manual refresh for in-memory state refresh.

var CACHE_NAME = 'hw-tracker-v3';
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/css/styles.css',
  '/css/gamification.css',
  '/css/devmode.css',
  '/js/gamification.js',
  '/js/devmode.js',
  '/js/state.js',
  '/js/util.js',
  '/js/quickadd.js',
  '/js/tasks.js',
  '/js/tests.js',
  '/js/settings.js',
  '/js/command-palette.js',
  '/js/app.js',
];

// ── Install: pre-cache all static assets + activate immediately ──
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// ── Activate: clean old caches ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
});

// ── Fetch: cache-first, network fallback ──
self.addEventListener('fetch', function(event) {
  // Only handle GET requests for same-origin + Google Fonts
  var url = new URL(event.request.url);
  var isGoogleFonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  var isSameOrigin = url.origin === self.location.origin;

  if (event.request.method !== 'GET' || (!isSameOrigin && !isGoogleFonts)) {
    return; // let browser handle non-GET or third-party requests normally
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      // Return cached response, or fetch from network + cache it
      return cached || fetch(event.request).then(function(response) {
        // Cache successful responses (don't filter by type — cross-origin
        // Google Fonts responses come back as 'cors', not 'basic').
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
