"use client"

import { useState } from "react"
import { Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePwaInstall } from "../hooks/use-pwa-install"
import { IosInstallDialog } from "./ios-install-dialog"

type InstallAppButtonProps = {
  /**
   * - `footer` — a plain link-styled line for the dark footer.
   * - `card`   — a bordered card with a short explanation (profile page).
   */
  variant: "footer" | "card"
  className?: string
}

/**
 * Passive install entry point. Renders nothing when the site cannot be
 * installed from this browser or is already installed, so it never shows a
 * button that does nothing.
 */
export function InstallAppButton({ variant, className }: InstallAppButtonProps) {
  const { mode, promptInstall } = usePwaInstall()
  const [iosOpen, setIosOpen] = useState(false)

  if (mode !== "prompt" && mode !== "ios") return null

  const handleClick = () => {
    if (mode === "ios") {
      setIosOpen(true)
      return
    }
    void promptInstall()
  }

  const dialog = <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />

  if (variant === "footer") {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "flex items-center gap-2 text-sm text-white/70 hover:text-white hover:underline",
            className,
          )}
        >
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          Pasang Aplikasi HNS
        </button>
        {dialog}
      </>
    )
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold">Pasang aplikasi HNS</p>
            <p className="text-sm text-muted-foreground">
              Buka toko lebih cepat langsung dari layar utama perangkat Anda.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Pasang
        </button>
      </div>
      {dialog}
    </>
  )
}
