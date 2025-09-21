const CACHE_NAME = '$$CACHE_NAME$$';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '$$BUNDLE_FILENAME$$'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Opened cache:', CACHE_NAME);
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(err => {
        console.error('[Service Worker] Failed to cache resources during install:', err);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // For navigation requests, always try the network first, then fall back to the cache (the "/" entry).
  // This is a "Network falling back to cache" strategy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  // For all other requests (assets like JS, CSS), use a "Cache falling back to network" strategy.
  // This is good for performance.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).then(fetchResponse => {
          // Optional: You could dynamically cache new assets here if needed,
          // but for this build process, pre-caching is sufficient.
          return fetchResponse;
        });
      })
  );
});