"use client"

import { useEffect } from "react"
// Imported for its side effect: attaches the `beforeinstallprompt` listener as
// early as possible. See the module comment there.
import "../lib/install-state"

/**
 * Registers `public/sw.js`. Mounted once in the root layout; renders nothing.
 *
 * Production only: in `next dev` the worker would cache dev chunks and fight
 * with hot reload. To test the PWA locally, use `npm run build:app && npm start`.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

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
