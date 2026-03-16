const CACHE_NAME = 'nefroped-v28'; // <--- ACUÉRDATE DE CAMBIAR ESTO AL SUBIR

const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './scripts.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ── INSTALL ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// ── MESSAGE (Toast "Actualizar ahora") ────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia híbrida ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Analytics → Network Only (nunca cachear)
  if (url.hostname.includes('goatcounter')) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Assets estáticos propios → Cache First
  const esAssetEstatico =
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.jpg');

  if (esAssetEstatico) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // 3. HTML → Network First con fallback a caché
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then(cached => {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // 4. CDNs externos → Stale-While-Revalidate
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(response => {
            cache.put(request, response.clone());
            return response;
          });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // 5. Resto → Network First con fallback
  event.respondWith(
    fetch(request).then(response => {
      if (!response || response.status !== 200) return response;
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      return response;
    }).catch(() => {
      return caches.match(request).then(res => {
        return res || caches.match('./index.html');
      });
    })
  );
});
























