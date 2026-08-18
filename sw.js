const CACHE_NAME = 'recepten-checklist-v9';
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./theme.css",
  "./theme.js",
  "./recipe.js",
  "./recipes-data.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./butter_chicken_boodschappenlijst.html",
  "./butter_chicken_kookinstructies.html",
  "./chow_mein_boodschappenlijst.html",
  "./chow_mein_kookinstructies.html",
  "./general_tsos_chicken_boodschappenlijst.html",
  "./general_tsos_chicken_kookinstructies.html",
  "./indiase_chicken_biriyani_boodschappenlijst.html",
  "./indiase_chicken_biriyani_kookinstructies.html",
  "./kantonese_kip_boodschappenlijst.html",
  "./kantonese_kip_kookinstructies.html",
  "./korma_boodschappenlijst.html",
  "./korma_kookinstructies.html",
  "./kung_pao_chicken_boodschappenlijst.html",
  "./kung_pao_chicken_kookinstructies.html",
  "./maple_bourbon_bbq_saus_boodschappenlijst.html",
  "./maple_bourbon_bbq_saus_kookinstructies.html",
  "./massaman_curry_boodschappenlijst.html",
  "./massaman_curry_kookinstructies.html",
  "./mongolian_beef_boodschappenlijst.html",
  "./mongolian_beef_kookinstructies.html",
  "./nasi_boodschappenlijst.html",
  "./nasi_kookinstructies.html",
  "./padthai_boodschappenlijst.html",
  "./padthai_kookinstructies.html",
  "./sate_boodschappenlijst.html",
  "./sate_kookinstructies.html",
  "./sticky_chicken_boodschappenlijst.html",
  "./sticky_chicken_kookinstructies.html",
  "./thaise_groene_curry_boodschappenlijst.html",
  "./thaise_groene_curry_kookinstructies.html",
  "./thaise_rode_curry_boodschappenlijst.html",
  "./thaise_rode_curry_kookinstructies.html",
  "./tikka_masala_boodschappenlijst.html",
  "./tikka_masala_kookinstructies.html",
  "./ravioli_spinazie_citroen_boodschappenlijst.html",
  "./ravioli_spinazie_citroen_kookinstructies.html",
  "./kip_piccata_boodschappenlijst.html",
  "./kip_piccata_kookinstructies.html",
  "./avgolemono_boodschappenlijst.html",
  "./avgolemono_kookinstructies.html",
  "./spaghetti_al_limone_boodschappenlijst.html",
  "./spaghetti_al_limone_kookinstructies.html",
  "./spaghetti_al_limone_romig_boodschappenlijst.html",
  "./spaghetti_al_limone_romig_kookinstructies.html",
  "./gratin_dauphinois_boodschappenlijst.html",
  "./gratin_dauphinois_kookinstructies.html"
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
