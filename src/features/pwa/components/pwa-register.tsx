"use client"

import { useEffect } from "react"
// Imported for its side effect: attaches the `beforeinstallprompt` listener as
// early as possible. See the module comment there.
import "../lib/install-state"

/**
 * Prefix of the caches `public/sw.js` creates (`hns-static-${CACHE_VERSION}`).
 */
const SW_CACHE_PREFIX = "hns-static-"

/**
 * Dev only: remove a worker left behind by a local `npm start`, then reload once.
 *
 * Registering is production-only, but a registration outlives the server that
 * made it. Testing the PWA with `npm run build:app && npm start` on
 * localhost:3000 leaves `sw.js` installed for that origin, and it keeps
 * answering `/_next/static/*` cache-first after switching back to `next dev`.
 * Dev chunk names are NOT content-hashed (`src_1eksbi6._.js` stays the same
 * while its contents change), so the worker serves stale code: pages crash with
 * "module factory is not available", CSS lacks newly added classes, and
 * hydration mismatches appear. Ctrl+Shift+R bypasses the worker, which is why
 * it only ever looked like a flaky first load.
 *
 * The reload happens only when this page was actually controlled by a worker.
 * An unregistered worker stops matching new navigations immediately, so the
 * reloaded page is uncontrolled and this never loops.
 */
function removeLeftoverWorker() {
  const controlled = navigator.serviceWorker.controller !== null

  Promise.all([
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((r) => r.unregister()))),
    "caches" in window
      ? caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys.filter((key) => key.startsWith(SW_CACHE_PREFIX)).map((key) => caches.delete(key)),
            ),
          )
      : Promise.resolve([]),
  ])
    .then(() => {
      if (controlled) window.location.reload()
    })
    .catch((error: unknown) => {
      console.error("Failed to remove the leftover service worker", error)
    })
}

/**
 * Registers `public/sw.js`. Mounted once in the root layout; renders nothing.
 *
 * Production only: in `next dev` the worker would cache dev chunks and fight
 * with hot reload — and one left over from a local production run is removed
 * (see `removeLeftoverWorker`). To test the PWA locally, use
 * `npm run build:app && npm start`.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") {
      removeLeftoverWorker()
      return
    }

    // Registered after `load` so the worker's own fetch does not compete with
    // the first page's resources.
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
        console.error("Service worker registration failed", error)
      })
    }

    if (document.readyState === "complete") {
      register()
      return
    }
    window.addEventListener("load", register, { once: true })
    return () => window.removeEventListener("load", register)
  }, [])

  return null
}
