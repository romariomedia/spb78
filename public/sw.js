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
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== MEDIA_CACHE && k !== 'sportbuddy-push-identity-v1').map((k) => caches.delete(k)))
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


// FCM data messages are rendered here so account ownership is checked first.
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload;try {payload=event.data.json().data;}catch{return;}
    if(!payload?.recipient || !payload.eventId)return;
    const cache=await caches.open('sportbuddy-push-identity-v1');
    const owner=await cache.match('/__push_identity');
    if(!owner || await owner.text()!==payload.recipient)return;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const link=typeof payload.link==='string'&&payload.link.startsWith('#')?payload.link:'#notifications';
    // An actively visible chat already displays the message.
    if(windows.some(w=>w.visibilityState==='visible'&&new URL(w.url).hash===link&&link.startsWith('#chat=')))return;
    await self.registration.showNotification(String(payload.title||'SportBuddy'),{body:String(payload.body||''),tag:String(payload.tag||payload.eventId),data:{link,recipient:payload.recipient},renotify:false});
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const cache=await caches.open('sportbuddy-push-identity-v1'),owner=await cache.match('/__push_identity');
    if(!owner||await owner.text()!==event.notification.data?.recipient)return;
    const raw=event.notification.data?.link,link=typeof raw==='string'&&raw.startsWith('#')?raw:'#notifications';
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(w=>new URL(w.url).origin===self.location.origin);
    if(existing){existing.postMessage({type:'sportbuddy-open-notification',link});await existing.focus();}
    else await self.clients.openWindow('/'+link);
  })());
});
