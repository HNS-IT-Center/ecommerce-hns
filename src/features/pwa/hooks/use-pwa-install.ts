"use client"

import { useSyncExternalStore } from "react"
import {
  getInstallMode,
  getServerInstallMode,
  promptInstall,
  subscribeInstallMode,
  type InstallMode,
} from "../lib/install-state"

/**
 * Current install mode plus the native prompt trigger. Returns `unavailable`
 * during SSR and the first client render, so install UI never causes a
 * hydration mismatch — it simply appears after hydration when it applies.
 */
export function usePwaInstall(): { mode: InstallMode; promptInstall: typeof promptInstall } {
  const mode = useSyncExternalStore(subscribeInstallMode, getInstallMode, getServerInstallMode)
  return { mode, promptInstall }
}
