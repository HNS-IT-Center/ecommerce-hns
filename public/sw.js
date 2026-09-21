/**
 * Service worker HNS IT Center — see docs/14-pwa.md before changing anything.
 *
 * THE ONE RULE: pages and API responses are NEVER cached. They carry prices and
 * stock (CLAUDE.md §2.7); a cached product page would show a price staff have
 * already changed, and that stale number would reach the cart and the WhatsApp
 * checkout message. So this worker only:
 *
 *   1. caches content-hashed static assets (`/_next/static/*`) and the app
 *      icons — cache-first, safe because a new build means new file names;
 *   2. shows `/offline.html` when a page navigation fails for lack of network.
 *
 * Everything else (pages, `/api/*`, `/admin/*`, images from R2/WordPress,
 * cross-origin requests) passes straight through to the network untouched.
 *
 * Bump CACHE_VERSION whenever this file or offline.html changes meaningfully;
 * old caches are deleted on activate.
 */
const CACHE_VERSION = "v1"
const STATIC_CACHE = `hns-static-${CACHE_VERSION}`
const OFFLINE_URL = "/offline.html"

const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"]

// Hashed chunks from old builds are never requested again but would otherwise
// stay forever. Cache keys come back in insertion order, so trimming from the
// front drops the oldest first.
const MAX_STATIC_ENTRIES = 300

function trimCache(cache) {
  return cache.keys().then((keys) => {
    const excess = keys.length - MAX_STATIC_ENTRIES
    if (excess <= 0) return
    return Promise.all(
      keys
        .slice(0, excess)
        .filter((key) => !PRECACHE.includes(new URL(key.url).pathname))
        .map((key) => cache.delete(key)),
    )
  })
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("hns-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isCacheableStatic(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Page navigations: always the network. Only when the network is gone do we
  // answer with the offline page — and that page is never a stale copy of
  // real content.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached || Response.error()),
      ),
    )
    return
  }

  if (isCacheableStatic(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached
          return fetch(request).then((response) => {
            if (response.ok) {
              event.waitUntil(cache.put(request, response.clone()).then(() => trimCache(cache)))
            }
            return response
          })
        }),
      ),
    )
  }
  // Anything else: no respondWith → the browser handles it normally.
})
