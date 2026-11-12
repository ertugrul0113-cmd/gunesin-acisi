// Önce ağ, olmazsa önbellek: yeni sürüm telefona kendiliğinden gelir.
const ONBELLEK = 'gunesin-acisi-v3';
const DOSYALAR = ['./', 'index.html', 'style.css', 'app.js', 'astro.js', 'drone.js', 'harita.js', 'manifest.webmanifest', 'veri/havalimanlari.json',
  'ikon-180.png', 'ikon-192.png', 'ikon-512.png', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(ONBELLEK).then(c => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== ONBELLEK).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // harita karoları, hava vb. doğrudan ağdan
  e.respondWith(
    // cache:'no-cache' -> GitHub'ın 10 dakikalık önbelleğini atla, her açılışta sunucuya sor
    fetch(e.request.url, { cache: 'no-cache' }).then(r => {
      const kopya = r.clone();
      caches.open(ONBELLEK).then(c => c.put(e.request, kopya));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
