const CACHE_NAME = "minha-pressao-v17";

const STATIC_FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/database.js",
  "./js/charts.js",
  "./js/export.js",
  "./manifest.json",
  "./assets/docs/Manual_do_Usuario_Minha_Pressao.pdf",
  "./assets/icons/icon-192.svg",
  "./assets/icons/icon-512.svg",

  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then(networkResponse => {
          const responseCopy = networkResponse.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseCopy);
          });

          return networkResponse;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
