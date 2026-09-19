"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Smartphone, X } from "lucide-react"
import { usePwaInstall } from "../hooks/use-pwa-install"
import { IosInstallDialog } from "./ios-install-dialog"

const STORAGE_KEY = "hns:pwa-chip-shown-at"
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000
const DELAY_MS = 20_000

function wasShownRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw !== null && Date.now() - Number(raw) < SNOOZE_MS
  } catch {
    // Storage blocked (private mode, disabled site data): treat as "shown" so
    // the chip cannot reappear on every single visit.
    return true
  }
}

function markShown() {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    // Ignore — see wasShownRecently.
  }
}

/**
 * The one active install suggestion, kept deliberately quiet:
 *
 * - mobile only (`md:hidden`) — desktop browsers already show an install icon
 *   in the address bar, and the footer link covers the rest;
 * - home page only, and only after the visitor has been on the site for
 *   {@link DELAY_MS} — never on product, cart, or checkout pages, where it
 *   would compete with the buying flow;
 * - at most once per 30 days: the timestamp is written the moment it appears,
 *   so ignoring it counts the same as dismissing it.
 *
 * Positioned left of the floating WhatsApp button (`right-20`) and just above
 * the mobile dock, so it covers neither.
 */
export function InstallChip() {
  const pathname = usePathname()
  const { mode, promptInstall } = usePwaInstall()
  const [visible, setVisible] = useState(false)
  const [iosOpen, setIosOpen] = useState(false)

  const isHome = pathname === "/"
  const canInstall = mode === "prompt" || mode === "ios"

  useEffect(() => {
    if (!isHome || !canInstall || wasShownRecently()) return

    const timer = window.setTimeout(() => {
      markShown()
      setVisible(true)
    }, DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [isHome, canInstall])

  const handleInstall = () => {
    if (mode === "ios") {
      setIosOpen(true)
      return
    }
    setVisible(false)
    void promptInstall()
  }

  return (
    <>
      {visible && isHome && canInstall && (
        <div
          role="region"
          aria-label="Pasang aplikasi"
          className="no-print print:hidden md:hidden fixed left-4 right-20 bottom-[calc(68px+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full border bg-background/95 py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-2"
        >
          <Smartphone className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">Pasang aplikasi HNS</span>
          <button
            type="button"
            onClick={handleInstall}
            className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Pasang
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label="Tutup"
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <IosInstallDialog
        open={iosOpen}
        onOpenChange={(open) => {
          setIosOpen(open)
          if (!open) setVisible(false)
        }}
      />
    </>
  )
}
