const CACHE = "notiz-cache-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./note.html",
  "./styles.css",
  "./app.js",
  "./note.js",
  "./backup.js",
  "./ui.js",
  "./db.js",
  "./manifest.webmanifest",
  "./icon/notes.ico",
  "./icon/notes32.png",
  "./icon/notes72.png",
  "./icon/notes96.png",
  "./icon/notes128.png",
  "./icon/notes180.png",
  "./icon/notes192.png",
  "./icon/notes256.png",
  "./icon/notes512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => res))
  );
});
