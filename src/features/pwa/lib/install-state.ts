/**
 * Install state for the PWA, shared by every install entry point (footer,
 * profile card, home chip) through `usePwaInstall`.
 *
 * Kept as a module-level store rather than React state because the browser's
 * `beforeinstallprompt` event fires once, early, and not necessarily while any
 * install button is mounted. The listener is attached when this module is first
 * evaluated (it is imported by `PwaRegister` in the root layout), so the event
 * is caught no matter which page the visitor lands on.
 */

/** Chromium-only event; not in the DOM lib typings. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * - `prompt`      — Chromium (Android, desktop): we hold the native prompt.
 * - `ios`         — iOS/iPadOS: no prompt API exists; show manual instructions.
 * - `installed`   — already running as an installed app, or just installed.
 * - `unavailable` — not installable here (Firefox desktop, not yet eligible, SSR).
 */
export type InstallMode = "prompt" | "ios" | "installed" | "unavailable"

import { isStandalone } from "./display-mode"

let deferredPrompt: BeforeInstallPromptEvent | null = null
let justInstalled = false
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppress Chrome's automatic mini-infobar on Android — the whole point of
    // our own entry points is to NOT interrupt the visitor unasked.
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    justInstalled = true
    notify()
  })
}

function isIos(): boolean {
  const { userAgent, platform, maxTouchPoints } = window.navigator
  // iPadOS 13+ reports itself as "MacIntel"; touch support gives it away.
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)
}

export function getInstallMode(): InstallMode {
  if (justInstalled || isStandalone()) return "installed"
  if (deferredPrompt) return "prompt"
  if (isIos()) return "ios"
  return "unavailable"
}

export function getServerInstallMode(): InstallMode {
  return "unavailable"
}

export function subscribeInstallMode(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Opens the native install prompt. A prompt event can only be used once, so it
 * is dropped afterwards regardless of the outcome; Chrome fires a fresh
 * `beforeinstallprompt` later if the visitor declined.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferredPrompt
  if (!event) return "unavailable"

  deferredPrompt = null
  await event.prompt()
  const { outcome } = await event.userChoice
  notify()
  return outcome
}
