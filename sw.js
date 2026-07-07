const CACHE_NAME = 'recepten-checklist-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './nasi.html',
  './nasi_kookinstructies.html',
  './stickychicken.html',
  './sticky_chicken_kookinstructies.html',
  './korma.html',
  './korma_boodschappenlijst.html',
  './sate_boodschappenlijst.html',
  './sate_kookinstructies.html',
  './tikka_masala_boodschappenlijst.html',
  './tikka_korma_kookinstructies.html',
  './thaise_groene_curry_boodschappenlijst.html',
  './thaise_kookinstructies.html',
  './mongolian_beef_boodschappenlijst.html',
  './mongolian_beef_kookinstructies.html',
  './indiase_chicken_biriyani_boodschappenlijst.html',
  './indiase_chicken_biriyani_kookinstructies.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k.startsWith('recepten-checklist-v') && k!==CACHE_NAME).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
          return resp;
        })
      ).catch(() => caches.match('./index.html'))
    );
  }
});
