import { isStandalone } from "./display-mode"

/**
 * `window.open(path, "_blank")` for pages on THIS site.
 *
 * In a browser tab it opens a new tab as before. In the installed app it
 * navigates the app window instead: a new "tab" there leaves the app — on
 * Android into a Chrome tab, on iOS into Safari, which has separate storage, so
 * the visitor lands on an empty cart and a logged-out session.
 *
 * External URLs (WhatsApp, Maps) must keep using `window.open` directly — they
 * are meant to leave the app. See docs/14-pwa.md §6.
 */
export function openInternal(path: string): void {
  if (isStandalone()) {
    window.location.assign(path)
    return
  }
  window.open(path, "_blank")
}
