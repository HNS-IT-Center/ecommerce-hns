"use client"

import { Share2 } from "lucide-react"

import { useToastManager } from "@/components/ui/toast"

/**
 * Tombol "Bagikan" di kartu info promo.
 *
 * Perilakunya mengikuti `ShareButton` di header mobile: lembar berbagi bawaan
 * ponsel lewat `navigator.share`, dan salin tautan di desktop. Bedanya hanya
 * wujud — yang ini pil berlabel, karena di desktop header tidak punya tombol
 * bagikan sama sekali.
 */
export function PromoShareButton({ title, url }: { title: string; url: string }) {
  const toastManager = useToastManager()

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch (error) {
        // Pembeli menutup lembar berbagi — pembatalan, bukan kegagalan.
        if (error instanceof DOMException && error.name === "AbortError") return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      toastManager.add({ title: "Tautan promo disalin" })
    } catch {
      toastManager.add({ title: "Gagal menyalin tautan", description: url })
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 text-xs font-semibold transition-colors hover:bg-muted"
    >
      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
      {/* Satu span pembungkus: `gap` flex di tombol ikut berlaku di antara
          teks dan span, dan menghasilkan spasi ganda. */}
      <span>
        Bagikan<span className="hidden sm:inline"> promo</span>
      </span>
    </button>
  )
}
