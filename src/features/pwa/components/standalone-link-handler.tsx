"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { isStandalone } from "../lib/display-mode"

/**
 * In the installed app ONLY, turns `target="_blank"` links to this site into
 * normal in-app navigation. Mounted once in the root layout; renders nothing.
 *
 * Why: a new tab leaves the app window — into a Chrome tab on Android, into
 * Safari on iOS. iOS keeps the installed app's storage separate from Safari's,
 * so the visitor would see an empty cart and be logged out.
 *
 * What it deliberately leaves alone:
 * - browser tabs (not standalone) — `_blank` behaves exactly as written;
 * - links to other origins (WhatsApp, Maps, Instagram) — those SHOULD leave
 *   the app and open their own app;
 * - downloads, and clicks with a modifier key or non-primary button.
 *
 * Programmatic `window.open` is not covered here; internal callers use
 * `openInternal()` from `../lib/open-internal`. See docs/14-pwa.md §6.
 */
export function StandaloneLinkHandler() {
  const router = useRouter()

  useEffect(() => {
    if (!isStandalone()) return

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!(event.target instanceof Element)) return

      const anchor = event.target.closest("a")
      if (!anchor || anchor.target !== "_blank" || anchor.hasAttribute("download")) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return

      event.preventDefault()
      router.push(`${url.pathname}${url.search}${url.hash}`)
    }

    // Bubble phase on `document`: runs after React's own handlers, so a
    // component that already called `preventDefault()` keeps control.
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [router])

  return null
}
