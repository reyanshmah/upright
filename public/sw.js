/*
 * Upright service worker: the PWA shell.
 *  - Navigations: network first, last good copy when offline.
 *  - Static files (built JS/CSS, icons, pose models, MediaPipe wasm, audio): cache first.
 * Deliberately NOT done yet (MASTER.md schedules it for Nov 13): precaching the
 * whole app + model so a first offline test is guaranteed.
 * A new worker waits until every tab closes: it never takes over during a test.
 */
const CACHE = "upright-shell-v1";
const STATIC = [/^\/_next\/static\//, /^\/icons\//, /^\/fonts\//, /^\/models\//, /^\/mediapipe\//, /^\/audio\//];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(["/", "/start", "/icons/icon-192.png"].map((u) => c.add(u))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
    return;
  }

  if (STATIC.some((re) => re.test(url.pathname))) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
