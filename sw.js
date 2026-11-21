'use strict';
// Stok Portal servis çalışanı: uygulamayı çevrimdışı açılabilir yapar ve Chrome'da "Yükle" düğmesini sağlar.
// Strateji: önce ağ (güncel sürüm), ağ yoksa önbellek. Böylece yeni sürüm yayınlanınca ilk açılışta gelir.
const ONBELLEK = 'stok-portal-v1';
const TEMEL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(ONBELLEK).then(c => c.addAll(TEMEL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(l => Promise.all(l.filter(k => k !== ONBELLEK).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r, { cache: 'no-store' }).then(res => { if (res && res.ok) { const k = res.clone(); caches.open(ONBELLEK).then(c => c.put(r, k)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
});
