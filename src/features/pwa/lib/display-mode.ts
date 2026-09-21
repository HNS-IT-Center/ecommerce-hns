/**
 * True when the site is running as the installed app (any platform), not in a
 * browser tab. Client-only — call it from effects or event handlers.
 *
 * iOS does not reliably match the `display-mode` media query in older
 * versions; `navigator.standalone` is its own flag for the same thing.
 */
export function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
}
