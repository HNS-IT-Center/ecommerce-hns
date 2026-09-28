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

/**
 * Same as `openInternal`, but for a destination that is only known AFTER an
 * await — a server action that mints the URL, for example.
 *
 * Call this synchronously inside the click handler, then call the returned
 * function once the path is known. Browsers only allow `window.open` while a
 * user gesture is still being handled; calling it after an await makes the
 * popup blocker swallow the tab, and the button then feels broken with nothing
 * in the console to explain it.
 *
 * In the installed app there is no popup to block, so nothing opens up front
 * and the app window is navigated as usual (docs/14-pwa.md §6).
 *
 * `cancel()` closes the placeholder when the work fails, so a blank tab is not
 * left behind on top of an error message the visitor cannot see.
 */
export function prepareInternalOpen(): { go: (path: string) => void; cancel: () => void } {
  if (isStandalone()) {
    return { go: (path) => window.location.assign(path), cancel: () => {} }
  }

  const placeholder = window.open("", "_blank")

  return {
    go: (path) => {
      // A blocked `window.open` returns null. Falling back to same-window
      // navigation is better than doing nothing: the visitor still gets the
      // document, just not in a new tab.
      if (placeholder && !placeholder.closed) placeholder.location.replace(path)
      else window.location.assign(path)
    },
    cancel: () => {
      if (placeholder && !placeholder.closed) placeholder.close()
    },
  }
}
