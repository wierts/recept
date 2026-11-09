const CACHE_NAME = 'recepten-checklist-v20';
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./theme.css",
  "./theme.js",
  "./js/app.js",
  "./js/boodschappenlijst.js",
  "./js/index.js",
  "./js/kookinstructies.js",
  "./js/opslag.js",
  "./js/porties.js",
  "./js/schalen.js",
  "./js/versie.js",
  "./js/zoeken.js",
  "./recipes-data.js",
  "./versie.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./avgolemono_boodschappenlijst.html",
  "./avgolemono_kookinstructies.html",
  "./butter_chicken_boodschappenlijst.html",
  "./butter_chicken_kookinstructies.html",
  "./chow_mein_boodschappenlijst.html",
  "./chow_mein_kookinstructies.html",
  "./citroen_risotto_kip_boodschappenlijst.html",
  "./citroen_risotto_kip_kookinstructies.html",
  "./general_tsos_chicken_boodschappenlijst.html",
  "./general_tsos_chicken_kookinstructies.html",
  "./gratin_dauphinois_boodschappenlijst.html",
  "./gratin_dauphinois_kookinstructies.html",
  "./indiase_chicken_biriyani_boodschappenlijst.html",
  "./indiase_chicken_biriyani_kookinstructies.html",
  "./kantonese_kip_boodschappenlijst.html",
  "./kantonese_kip_kookinstructies.html",
  "./kip_piccata_boodschappenlijst.html",
  "./kip_piccata_kookinstructies.html",
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
  "./paella_valenciana_boodschappenlijst.html",
  "./paella_valenciana_kookinstructies.html",
  "./ravioli_spinazie_citroen_boodschappenlijst.html",
  "./ravioli_spinazie_citroen_kookinstructies.html",
  "./risotto_sbirraglia_boodschappenlijst.html",
  "./risotto_sbirraglia_kookinstructies.html",
  "./sate_boodschappenlijst.html",
  "./sate_kookinstructies.html",
  "./spaghetti_al_limone_boodschappenlijst.html",
  "./spaghetti_al_limone_kookinstructies.html",
  "./spaghetti_al_limone_romig_boodschappenlijst.html",
  "./spaghetti_al_limone_romig_kookinstructies.html",
  "./sticky_chicken_boodschappenlijst.html",
  "./sticky_chicken_kookinstructies.html",
  "./thaise_groene_curry_boodschappenlijst.html",
  "./thaise_groene_curry_kookinstructies.html",
  "./thaise_rode_curry_boodschappenlijst.html",
  "./thaise_rode_curry_kookinstructies.html",
  "./tikka_masala_boodschappenlijst.html",
  "./tikka_masala_kookinstructies.html"
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

// Netwerk eerst: met internet altijd de nieuwste versie (en de cache wordt bijgewerkt),
// zonder internet de opgeslagen versie. Zo is een update direct zichtbaar na het openen.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
      }
      return resp;
    }).catch(() =>
      caches.match(e.request, { ignoreSearch: true }).then(cached =>
        cached || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
      )
    )
  );
});
