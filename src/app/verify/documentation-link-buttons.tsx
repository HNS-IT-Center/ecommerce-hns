"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Copy, Images } from "lucide-react"

import { useToastManager } from "@/components/ui/toast"

/**
 * "Lihat dokumentasi rakitan" + "Salin link dokumentasi" di /verify/[code]
 * (docs/17 §21). Link yang disalin ditempel kasir di catatan faktur Accurate.
 *
 * Alamatnya dibentuk dari `window.location.origin`, bukan dari env: yang
 * disalin selalu domain yang sedang dibuka kasir, jadi tidak bisa tertukar
 * dengan domain cadangan seperti yang terjadi pada `resolveSiteUrl()`.
 */
export function DocumentationLinkButtons({ code }: { code: string }) {
  const toastManager = useToastManager()
  const [tersalin, setTersalin] = useState(false)
  const path = `/dokumentasi-rakitan/${encodeURIComponent(code)}`

  const handleCopy = async () => {
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      setTersalin(true)
      setTimeout(() => setTersalin(false), 2000)
    } catch {
      // Clipboard bisa ditolak; link-nya ditampilkan supaya tetap bisa disalin manual.
      toastManager.add({
        title: "Gagal menyalin otomatis",
        description: url,
        priority: "low",
        timeout: 8000,
      })
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <Link
        href={path}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-muted"
      >
        <Images className="h-4 w-4" />
        Lihat dokumentasi rakitan
      </Link>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-muted"
      >
        {tersalin ? <Check className="h-4 w-4 text-brand-green" /> : <Copy className="h-4 w-4" />}
        {tersalin ? "Link tersalin" : "Salin link dokumentasi"}
      </button>
    </div>
  )
}
