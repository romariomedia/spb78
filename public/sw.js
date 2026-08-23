/* SportBuddy78 service worker — conservative network-first cache.
 * Never blocks the app on a stale cache: network is always tried first,
 * cache is only a fallback for same-origin GET failures. */

const CACHE_NAME = 'sportbuddy78-v2';
const MEDIA_CACHE = 'sportbuddy78-media-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== MEDIA_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Медиа с Cloudinary иммутабельны (в URL версия+трансформация): cache-first.
  if (url.hostname === 'res.cloudinary.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok || response.type === 'opaque') {
            const copy = response.clone();
            caches.open(MEDIA_CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return response;
        });
      })
    );
    return;
  }

  // Never cache API, Firestore, media uploads or auth traffic.
  if (
    !sameOrigin ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('api.cloudinary.com') ||
    url.hostname.includes('vk.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
